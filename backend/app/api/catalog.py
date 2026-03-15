from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from app.core.deps import DBSession, require_role
from app.models import CatalogQuestion, CatalogQuestionStatus, User, UserRole
from app.schemas.test_pipeline import (
    CatalogImportRequest,
    CatalogImportResponse,
    CatalogPublishRequest,
    CatalogPublishResponse,
    CatalogValidateRequest,
    CatalogValidateResponse,
)
from app.services.question_catalog import question_catalog_service

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.post("/import", response_model=CatalogImportResponse)
def catalog_import(
    payload: CatalogImportRequest,
    db: DBSession,
    current_user: User = Depends(require_role(UserRole.teacher)),
) -> CatalogImportResponse:
    _ = current_user.id
    stats = question_catalog_service.import_from_question_bank(
        db=db,
        min_questions_per_subject=payload.min_questions_per_subject,
        subject_id=payload.subject_id,
    )

    query = select(func.count(CatalogQuestion.id)).where(CatalogQuestion.status == CatalogQuestionStatus.published)
    if payload.subject_id is not None:
        query = query.where(CatalogQuestion.subject_id == int(payload.subject_id))
    published_questions = int(db.scalar(query) or 0)

    return CatalogImportResponse(
        imported=int(stats.imported),
        updated=int(stats.updated),
        skipped=int(stats.skipped),
        invalid=int(stats.invalid),
        published_questions=published_questions,
    )


@router.post("/validate", response_model=CatalogValidateResponse)
def catalog_validate(
    payload: CatalogValidateRequest,
    db: DBSession,
    current_user: User = Depends(require_role(UserRole.teacher)),
) -> CatalogValidateResponse:
    _ = current_user.id
    validated = question_catalog_service.validate_subject_questions(db=db, subject_id=payload.subject_id)
    return CatalogValidateResponse(validated=int(validated))


@router.post("/publish", response_model=CatalogPublishResponse)
def catalog_publish(
    payload: CatalogPublishRequest,
    db: DBSession,
    current_user: User = Depends(require_role(UserRole.teacher)),
) -> CatalogPublishResponse:
    _ = current_user.id
    published = question_catalog_service.publish_subject_questions(db=db, subject_id=payload.subject_id)
    return CatalogPublishResponse(published=int(published))

