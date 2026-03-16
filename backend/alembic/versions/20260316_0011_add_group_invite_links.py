"""Add group invite links table.

Revision ID: 20260316_0011
Revises: 20260314_0010
Create Date: 2026-03-16 18:35:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260316_0011"
down_revision: Union[str, None] = "20260314_0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _has_index(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(item.get("name") == index_name for item in inspector.get_indexes(table_name))


def _has_unique(inspector: sa.Inspector, table_name: str, constraint_name: str) -> bool:
    return any(item.get("name") == constraint_name for item in inspector.get_unique_constraints(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_table(inspector, "group_invite_links"):
        op.create_table(
            "group_invite_links",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("teacher_id", sa.Integer(), nullable=False),
            sa.Column("group_id", sa.Integer(), nullable=False),
            sa.Column("token", sa.String(length=128), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("uses_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["teacher_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.alter_column("group_invite_links", "is_active", server_default=None)
        op.alter_column("group_invite_links", "uses_count", server_default=None)

    inspector = sa.inspect(bind)
    if _has_table(inspector, "group_invite_links"):
        if not _has_unique(inspector, "group_invite_links", "uq_group_invite_link_token"):
            op.create_unique_constraint("uq_group_invite_link_token", "group_invite_links", ["token"])

        inspector = sa.inspect(bind)
        if not _has_index(inspector, "group_invite_links", "ix_group_invite_links_group_id"):
            op.create_index("ix_group_invite_links_group_id", "group_invite_links", ["group_id"])

        inspector = sa.inspect(bind)
        if not _has_index(inspector, "group_invite_links", "ix_group_invite_links_teacher_id"):
            op.create_index("ix_group_invite_links_teacher_id", "group_invite_links", ["teacher_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "group_invite_links"):
        if _has_index(inspector, "group_invite_links", "ix_group_invite_links_teacher_id"):
            op.drop_index("ix_group_invite_links_teacher_id", table_name="group_invite_links")

        inspector = sa.inspect(bind)
        if _has_index(inspector, "group_invite_links", "ix_group_invite_links_group_id"):
            op.drop_index("ix_group_invite_links_group_id", table_name="group_invite_links")

        inspector = sa.inspect(bind)
        if _has_unique(inspector, "group_invite_links", "uq_group_invite_link_token"):
            op.drop_constraint("uq_group_invite_link_token", "group_invite_links", type_="unique")

        op.drop_table("group_invite_links")
