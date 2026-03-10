"""Add due_date to teacher authored tests.

Revision ID: 20260308_0007
Revises: 20260303_0006
Create Date: 2026-03-08 18:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260308_0007"
down_revision: Union[str, None] = "20260303_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "teacher_authored_tests" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("teacher_authored_tests")}
    if "due_date" not in columns:
        op.add_column("teacher_authored_tests", sa.Column("due_date", sa.Date(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "teacher_authored_tests" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("teacher_authored_tests")}
    if "due_date" in columns:
        op.drop_column("teacher_authored_tests", "due_date")
