"""Add catalog and runtime event tables for v2 pipeline.

Revision ID: 20260313_0009
Revises: 20260313_0008
Create Date: 2026-03-13 00:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db.base import Base
from app.models import entities  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "20260313_0009"
down_revision: Union[str, None] = "20260313_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    metadata_tables = Base.metadata.tables
    for table_name in (
        "catalog_questions",
        "student_question_coverage",
        "attempt_question_events",
    ):
        table = metadata_tables.get(table_name)
        if table is None:
            continue
        table.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    for table_name in (
        "attempt_question_events",
        "student_question_coverage",
        "catalog_questions",
    ):
        if table_name in existing:
            op.drop_table(table_name)
