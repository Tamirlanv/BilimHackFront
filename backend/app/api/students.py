from fastapi import APIRouter, Depends

from app.core.config import settings
from app.core.deps import DBSession, require_role
from app.models import User, UserRole
from app.schemas.tests import HistoryItemResponse, StudentDashboardResponse, StudentProgressResponse
from app.services.cache import cache
from app.services.progress import build_student_history, build_student_progress

router = APIRouter(prefix="/students/me", tags=["students"])


@router.get("/history", response_model=list[HistoryItemResponse])
def my_history(db: DBSession, current_user: User = Depends(require_role(UserRole.student))) -> list[HistoryItemResponse]:
    cache_key = f"student:{current_user.id}:history:v1"
    cached = cache.get_json(cache_key)
    if isinstance(cached, list):
        return [HistoryItemResponse.model_validate(item) for item in cached]

    payload = build_student_history(db, current_user.id)
    cache.set_json(cache_key, [item.model_dump(mode="json") for item in payload], ttl_seconds=settings.cache_history_ttl_seconds)
    return payload


@router.get("/progress", response_model=StudentProgressResponse)
def my_progress(db: DBSession, current_user: User = Depends(require_role(UserRole.student))) -> StudentProgressResponse:
    cache_key = f"student:{current_user.id}:progress:v1"
    cached = cache.get_json(cache_key)
    if isinstance(cached, dict):
        return StudentProgressResponse.model_validate(cached)

    payload = build_student_progress(db, current_user.id)
    cache.set_json(cache_key, payload.model_dump(mode="json"), ttl_seconds=settings.cache_progress_ttl_seconds)
    return payload


@router.get("/dashboard", response_model=StudentDashboardResponse)
def my_dashboard(db: DBSession, current_user: User = Depends(require_role(UserRole.student))) -> StudentDashboardResponse:
    cache_key = f"student:{current_user.id}:dashboard:v1"
    cached = cache.get_json(cache_key)
    if isinstance(cached, dict):
        return StudentDashboardResponse.model_validate(cached)

    progress = build_student_progress(db, current_user.id)
    history = build_student_history(db, current_user.id)
    payload = StudentDashboardResponse(progress=progress, history=history)
    cache.set_json(
        cache_key,
        payload.model_dump(mode="json"),
        ttl_seconds=min(settings.cache_progress_ttl_seconds, settings.cache_history_ttl_seconds),
    )
    return payload
