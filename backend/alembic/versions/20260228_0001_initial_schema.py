"""Initial schema bootstrap.

Revision ID: 20260228_0001
Revises:
Create Date: 2026-02-28 00:00:00
"""

from typing import Sequence, Union

from alembic import op

from app.db.base import Base
from app.models import entities  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "20260228_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Idempotent bootstrap migration:
    - creates missing tables/indexes/enums on fresh DB
    - is safe to run on existing local DBs that were initialized previously
    """
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind, checkfirst=True)

