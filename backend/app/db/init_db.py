from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import engine
from app.models import Group, GroupMembership, PreferredLanguage, StudentProfile, Subject, User, UserRole


DEMO_SUBJECTS = [
    {"name_ru": "Математика", "name_kz": "Математика"},
    {"name_ru": "Физика", "name_kz": "Физика"},
    {"name_ru": "Русский язык", "name_kz": "Орыс тілі"},
    {"name_ru": "Английский язык", "name_kz": "Ағылшын тілі"},
    {"name_ru": "Биология", "name_kz": "Биология"},
    {"name_ru": "Информатика", "name_kz": "Информатика"},
    {"name_ru": "Алгебра", "name_kz": "Алгебра"},
    {"name_ru": "Геометрия", "name_kz": "Геометрия"},
    {"name_ru": "Химия", "name_kz": "Химия"},
    {"name_ru": "История", "name_kz": "Тарих"},
]


DEMO_USERS = [
    {
        "email": "teacher@oku.local",
        "full_name": "Марина Преподаватель",
        "username": "teacher_demo",
        "password": "teacher123",
        "role": UserRole.teacher,
    },
    {
        "email": "student1@oku.local",
        "full_name": "Студент Демо 1",
        "username": "student_demo_1",
        "password": "student123",
        "role": UserRole.student,
        "preferred_language": PreferredLanguage.ru,
        "education_level": "school",
        "direction": "Общий профиль",
    },
    {
        "email": "student2@oku.local",
        "full_name": "Студент Демо 2",
        "username": "student_demo_2",
        "password": "student123",
        "role": UserRole.student,
        "preferred_language": PreferredLanguage.kz,
        "education_level": "college",
        "direction": "Информатика",
    },
]


def assert_database_ready() -> None:
    """
    Runtime schema mutations are disabled.
    Schema must be prepared explicitly with Alembic migrations.
    """
    try:
        with Session(engine) as db:
            db.execute(select(User.id).limit(1))
    except SQLAlchemyError as exc:
        raise RuntimeError(
            "Database schema is not ready. Run migrations first: "
            "`cd backend && alembic upgrade head`."
        ) from exc


def seed_demo_data_if_enabled() -> None:
    if not settings.seed_demo_data:
        return

    with Session(engine) as db:
        _seed_subjects(db)
        _seed_demo_users(db)
        db.commit()


def _seed_subjects(db: Session) -> None:
    existing = {s.name_ru for s in db.scalars(select(Subject)).all()}
    for subject in DEMO_SUBJECTS:
        if subject["name_ru"] not in existing:
            db.add(Subject(**subject))


def _seed_demo_users(db: Session) -> None:
    group = db.scalar(select(Group).where(Group.name == "A-101"))
    if not group:
        group = Group(name="A-101")
        db.add(group)
        db.flush()

    for user_data in DEMO_USERS:
        existing = db.scalar(select(User).where(User.email == user_data["email"]))
        if existing:
            continue

        user = User(
            email=user_data["email"],
            full_name=user_data.get("full_name"),
            username=user_data["username"],
            password_hash=get_password_hash(user_data["password"]),
            role=user_data["role"],
        )
        db.add(user)
        db.flush()

        if user.role == UserRole.student:
            preferred_language = user_data.get("preferred_language", PreferredLanguage.ru)
            db.add(
                StudentProfile(
                    user_id=user.id,
                    group_id=group.id,
                    preferred_language=preferred_language,
                    education_level=user_data.get("education_level"),
                    direction=user_data.get("direction"),
                )
            )
            db.add(GroupMembership(student_id=user.id, group_id=group.id))

    teacher_demo = db.scalar(select(User).where(User.username == "teacher_demo"))
    if teacher_demo and group.teacher_id is None:
        group.teacher_id = teacher_demo.id
