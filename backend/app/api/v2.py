from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api import catalog as catalog_api
from app.api import teacher as teacher_api
from app.api import tests as tests_api
from app.core.deps import DBSession, require_role
from app.models import User, UserRole
from app.schemas.teacher_tests import (
    TeacherCustomMaterialGenerateRequest,
    TeacherCustomMaterialGenerateResponse,
)
from app.schemas.test_pipeline import (
    AssembleTestRequest,
    CatalogImportRequest,
    CatalogImportResponse,
    CatalogPublishRequest,
    CatalogPublishResponse,
    CatalogValidateRequest,
    CatalogValidateResponse,
    RuntimeAnswerRequest,
    RuntimeAnswerResponse,
    RuntimeQuestionFeedbackResponse,
    RuntimeRecommendationResponse,
    RuntimeResultResponse,
    RuntimeStateResponse,
    RuntimeSubmitRequest,
    RuntimeSubmitResponse,
    TeacherMaterialGenerateV2Request,
    TeacherMaterialGenerateV2Response,
)
from app.schemas.tests import GenerateTestRequest, SubmitAnswerItem, SubmitTestRequest, TestResponse

router = APIRouter(prefix="/api/v2", tags=["v2"])


@router.post("/catalog/import", response_model=CatalogImportResponse)
def catalog_import(
    payload: CatalogImportRequest,
    db: DBSession,
    current_user: User = Depends(require_role(UserRole.teacher)),
) -> CatalogImportResponse:
    return catalog_api.catalog_import(payload=payload, db=db, current_user=current_user)


@router.post("/catalog/validate", response_model=CatalogValidateResponse)
def catalog_validate(
    payload: CatalogValidateRequest,
    db: DBSession,
    current_user: User = Depends(require_role(UserRole.teacher)),
) -> CatalogValidateResponse:
    return catalog_api.catalog_validate(payload=payload, db=db, current_user=current_user)


@router.post("/catalog/publish", response_model=CatalogPublishResponse)
def catalog_publish(
    payload: CatalogPublishRequest,
    db: DBSession,
    current_user: User = Depends(require_role(UserRole.teacher)),
) -> CatalogPublishResponse:
    return catalog_api.catalog_publish(payload=payload, db=db, current_user=current_user)


@router.post("/tests/assemble", response_model=TestResponse)
@router.post("/tests/generate", response_model=TestResponse)
def assemble_test(
    payload: AssembleTestRequest,
    db: DBSession,
    current_user: User = Depends(require_role(UserRole.student)),
) -> TestResponse:
    canonical_payload = GenerateTestRequest(
        subject_id=payload.subject_id,
        difficulty=payload.difficulty,
        language=payload.language,
        mode=payload.mode,
        num_questions=payload.num_questions,
        time_limit_minutes=payload.time_limit_minutes,
        warning_limit=payload.warning_limit,
    )
    return tests_api.generate_test(payload=canonical_payload, db=db, current_user=current_user)


@router.post("/tests/{session_id}/answer", response_model=RuntimeAnswerResponse)
def runtime_answer(
    session_id: int,
    payload: RuntimeAnswerRequest,
    db: DBSession,
    current_user: User = Depends(require_role(UserRole.student)),
) -> RuntimeAnswerResponse:
    return tests_api.answer_test_question(
        test_id=session_id,
        payload=payload,
        db=db,
        current_user=current_user,
    )


@router.get("/tests/{session_id}/state", response_model=RuntimeStateResponse)
def runtime_state(
    session_id: int,
    db: DBSession,
    current_user: User = Depends(require_role(UserRole.student)),
) -> RuntimeStateResponse:
    return tests_api.get_test_state(
        test_id=session_id,
        db=db,
        current_user=current_user,
    )


@router.post("/tests/{session_id}/submit", response_model=RuntimeSubmitResponse)
def runtime_submit(
    session_id: int,
    payload: RuntimeSubmitRequest,
    db: DBSession,
    current_user: User = Depends(require_role(UserRole.student)),
) -> RuntimeSubmitResponse:
    canonical_payload = SubmitTestRequest(
        answers=[
            SubmitAnswerItem(
                question_id=int(item.question_id),
                student_answer_json=dict(item.student_answer_json or {}),
            )
            for item in payload.answers
        ],
        telemetry=payload.telemetry,
    )
    submitted = tests_api.submit_test(
        test_id=session_id,
        payload=canonical_payload,
        db=db,
        current_user=current_user,
    )
    details = tests_api.get_test_result(
        test_id=session_id,
        db=db,
        current_user=current_user,
    )
    return RuntimeSubmitResponse(
        test_id=submitted.test_id,
        submitted_at=details.submitted_at,
        result=RuntimeResultResponse(**submitted.result.model_dump()),
        integrity_warnings=[item.model_dump() for item in submitted.integrity_warnings],
        feedback=[RuntimeQuestionFeedbackResponse(**item.model_dump()) for item in submitted.feedback],
        recommendation=RuntimeRecommendationResponse(**submitted.recommendation.model_dump()),
    )


@router.post("/teacher/material/generate", response_model=TeacherMaterialGenerateV2Response)
def teacher_material_generate(
    payload: TeacherMaterialGenerateV2Request,
    current_user: User = Depends(require_role(UserRole.teacher)),
) -> TeacherMaterialGenerateV2Response:
    canonical_payload = TeacherCustomMaterialGenerateRequest(
        topic=payload.topic,
        difficulty=payload.difficulty,
        questions_count=payload.questions_count,
        language=payload.language,
    )
    generated: TeacherCustomMaterialGenerateResponse = teacher_api.generate_custom_test_material(
        payload=canonical_payload,
        current_user=current_user,
    )
    return TeacherMaterialGenerateV2Response(
        topic=generated.topic,
        difficulty=generated.difficulty,
        questions_count=generated.questions_count,
        rejected_count=int(generated.rejected_count),
        questions=generated.questions,
    )
