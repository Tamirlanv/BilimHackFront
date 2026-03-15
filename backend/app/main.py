import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.catalog import router as catalog_router
from app.api.jobs import router as jobs_router
from app.api.profile import router as profile_router
from app.api.students import router as students_router
from app.api.subjects import router as subjects_router
from app.api.teacher import router as teacher_router
from app.api.tests import router as tests_router
from app.api.v2 import router as v2_router
from app.core.config import settings
from app.core.logging_config import configure_logging
from app.core.rate_limit import RateLimitMiddleware
from app.db.init_db import assert_database_ready, seed_demo_data_if_enabled
from app.db.session import engine
from app.services.cache import cache
from app.services.tts import tts_service

logger = logging.getLogger(__name__)
configure_logging()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="OKU prototype: AI-personalized exam and learning assistant",
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)


@app.on_event("startup")
def startup_event() -> None:
    _validate_security_settings()
    assert_database_ready()
    seed_demo_data_if_enabled()

    logger.info("Redis cache enabled: %s", cache.ping())
    logger.info("TTS provider: %s", type(tts_service._provider).__name__)


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "docs": "/docs", "api_prefix": settings.api_prefix_normalized}

_v1_routers = [auth_router, subjects_router, tests_router, students_router, teacher_router, profile_router, catalog_router, jobs_router]
for _router in _v1_routers:
    app.include_router(_router, prefix=settings.api_prefix_normalized)

# v2 routes are mounted with explicit `/api/v2` prefix to keep backward compatibility.
app.include_router(v2_router)

if settings.enable_legacy_routes and settings.api_prefix_normalized:
    for _router in _v1_routers:
        app.include_router(_router)


def _validate_security_settings() -> None:
    if settings.jwt_secret_key.strip() and len(settings.jwt_secret_key.strip()) >= 32:
        return
    if settings.app_env.lower() == "production":
        raise RuntimeError("JWT_SECRET_KEY must be set and at least 32 characters in production.")
    logger.warning("JWT_SECRET_KEY is weak or missing. Set a 32+ chars key before production deploy.")


def _init_sentry() -> None:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            traces_sample_rate=0.1,
            environment=settings.app_env,
            integrations=[FastApiIntegration(), StarletteIntegration()],
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sentry initialization skipped: %s", exc)


def _init_metrics() -> None:
    try:
        from prometheus_fastapi_instrumentator import Instrumentator

        Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Metrics initialization skipped: %s", exc)


def _init_tracing() -> None:
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

        resource = Resource.create({"service.name": settings.otel_service_name})
        provider = TracerProvider(resource=resource)
        trace.set_tracer_provider(provider)

        if settings.otel_exporter_otlp_endpoint.strip():
            exporter = OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint.strip())
        else:
            exporter = ConsoleSpanExporter()
        provider.add_span_processor(BatchSpanProcessor(exporter))

        FastAPIInstrumentor.instrument_app(app)
        SQLAlchemyInstrumentor().instrument(engine=engine)
    except Exception as exc:  # noqa: BLE001
        logger.warning("OpenTelemetry initialization skipped: %s", exc)


if settings.sentry_dsn:
    _init_sentry()
if settings.metrics_enabled:
    _init_metrics()
if settings.otel_enabled:
    _init_tracing()
