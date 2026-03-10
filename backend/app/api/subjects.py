from fastapi import APIRouter
from sqlalchemy import select

from app.core.config import settings
from app.core.deps import CurrentUser, DBSession
from app.models import Subject, UserRole
from app.schemas.subjects import SubjectResponse
from app.services.cache import cache

router = APIRouter(prefix="/subjects", tags=["subjects"])


@router.get("", response_model=list[SubjectResponse])
def list_subjects(current_user: CurrentUser, db: DBSession) -> list[SubjectResponse]:
    cache_key = f"subjects:all:v1:{current_user.role.value}"
    cached_subjects = cache.get_json(cache_key)
    if isinstance(cached_subjects, list):
        return [SubjectResponse.model_validate(item) for item in cached_subjects]

    subjects = db.scalars(select(Subject).order_by(Subject.id.asc())).all()
    if current_user.role == UserRole.student:
        subjects = [
            item
            for item in subjects
            if not (
                (item.name_ru or "").strip().lower() == "групповой тест"
                or (item.name_kz or "").strip().lower() == "топтық тест"
            )
        ]
    payload = [SubjectResponse.model_validate(item).model_dump(mode="json") for item in subjects]
    cache.set_json(cache_key, payload, ttl_seconds=settings.cache_subjects_ttl_seconds)
    return [SubjectResponse.model_validate(item) for item in payload]
