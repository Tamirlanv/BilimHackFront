"""Unified pipeline constraints, indexes and runtime metadata.

Revision ID: 20260314_0010
Revises: 20260313_0009
Create Date: 2026-03-14 15:05:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260314_0010"
down_revision: Union[str, None] = "20260313_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _has_unique(inspector: sa.Inspector, table_name: str, constraint_name: str) -> bool:
    return any(item.get("name") == constraint_name for item in inspector.get_unique_constraints(table_name))


def _has_index(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(item.get("name") == index_name for item in inspector.get_indexes(table_name))


def _has_check(inspector: sa.Inspector, table_name: str, constraint_name: str) -> bool:
    return any(item.get("name") == constraint_name for item in inspector.get_check_constraints(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_column(inspector, "test_sessions", "pipeline_version"):
        op.add_column(
            "test_sessions",
            sa.Column("pipeline_version", sa.String(length=32), nullable=False, server_default="unified_v1"),
        )
        op.execute("UPDATE test_sessions SET pipeline_version = 'unified_v1' WHERE pipeline_version IS NULL")
        op.alter_column("test_sessions", "pipeline_version", server_default=None)

    inspector = sa.inspect(bind)
    if not _has_column(inspector, "catalog_questions", "correct_options_count"):
        op.add_column(
            "catalog_questions",
            sa.Column("correct_options_count", sa.Integer(), nullable=False, server_default="0"),
        )
        op.alter_column("catalog_questions", "correct_options_count", server_default=None)

    # Backfill deterministic count of correct options.
    op.execute(
        sa.text(
            """
            UPDATE catalog_questions
            SET correct_options_count = CASE
                WHEN jsonb_typeof((correct_answer_json::jsonb)->'correct_option_ids') = 'array'
                    THEN jsonb_array_length((correct_answer_json::jsonb)->'correct_option_ids')
                ELSE 0
            END
            """
        )
    )

    # Move invalid questions out of published/validated flow.
    op.execute(
        sa.text(
            """
            UPDATE catalog_questions
            SET status = 'draft', validated_at = NULL, published_at = NULL
            WHERE
                (
                    type = 'single_choice'
                    AND (
                        correct_options_count <> 1
                        OR COALESCE(
                            CASE
                                WHEN jsonb_typeof((options_json::jsonb)->'options') = 'array'
                                    THEN jsonb_array_length((options_json::jsonb)->'options')
                                ELSE 0
                            END,
                            0
                        ) < 2
                    )
                )
                OR (
                    type = 'multi_choice'
                    AND (
                        correct_options_count < 1
                        OR COALESCE(
                            CASE
                                WHEN jsonb_typeof((options_json::jsonb)->'options') = 'array'
                                    THEN jsonb_array_length((options_json::jsonb)->'options')
                                ELSE 0
                            END,
                            0
                        ) < 2
                    )
                )
                OR (
                    type NOT IN ('single_choice', 'multi_choice')
                    AND (
                        correct_options_count <> 0
                        OR COALESCE(TRIM((correct_answer_json::jsonb->>'sample_answer')), '') = ''
                    )
                )
            """
        )
    )

    inspector = sa.inspect(bind)
    if not _has_check(inspector, "catalog_questions", "ck_catalog_correct_options_count"):
        op.create_check_constraint(
            "ck_catalog_correct_options_count",
            "catalog_questions",
            "("
            "(type = 'single_choice' AND correct_options_count = 1) OR "
            "(type = 'multi_choice' AND correct_options_count >= 1) OR "
            "(type NOT IN ('single_choice', 'multi_choice') AND correct_options_count = 0)"
            ")",
        )

    # Deduplicate answers by question_id before adding unique constraint.
    op.execute(
        sa.text(
            """
            DELETE FROM answers a
            USING (
                SELECT id
                FROM (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY id DESC) AS rn
                    FROM answers
                ) ranked
                WHERE ranked.rn > 1
            ) d
            WHERE a.id = d.id
            """
        )
    )

    inspector = sa.inspect(bind)
    if not _has_unique(inspector, "answers", "uq_answer_question"):
        op.create_unique_constraint("uq_answer_question", "answers", ["question_id"])

    inspector = sa.inspect(bind)
    if not _has_index(inspector, "student_question_coverage", "ix_student_question_coverage_student_catalog"):
        op.create_index(
            "ix_student_question_coverage_student_catalog",
            "student_question_coverage",
            ["student_id", "catalog_question_id"],
        )

    inspector = sa.inspect(bind)
    if not _has_index(inspector, "attempt_question_events", "ix_attempt_question_events_test_created_at"):
        op.create_index(
            "ix_attempt_question_events_test_created_at",
            "attempt_question_events",
            ["test_id", "created_at"],
        )

    inspector = sa.inspect(bind)
    if not _has_index(
        inspector,
        "catalog_questions",
        "ix_catalog_questions_subject_language_mode_difficulty_status",
    ):
        op.create_index(
            "ix_catalog_questions_subject_language_mode_difficulty_status",
            "catalog_questions",
            ["subject_id", "language", "mode", "difficulty", "status"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_index(inspector, "catalog_questions", "ix_catalog_questions_subject_language_mode_difficulty_status"):
        op.drop_index("ix_catalog_questions_subject_language_mode_difficulty_status", table_name="catalog_questions")

    inspector = sa.inspect(bind)
    if _has_index(inspector, "attempt_question_events", "ix_attempt_question_events_test_created_at"):
        op.drop_index("ix_attempt_question_events_test_created_at", table_name="attempt_question_events")

    inspector = sa.inspect(bind)
    if _has_index(inspector, "student_question_coverage", "ix_student_question_coverage_student_catalog"):
        op.drop_index("ix_student_question_coverage_student_catalog", table_name="student_question_coverage")

    inspector = sa.inspect(bind)
    if _has_unique(inspector, "answers", "uq_answer_question"):
        op.drop_constraint("uq_answer_question", "answers", type_="unique")

    inspector = sa.inspect(bind)
    if _has_check(inspector, "catalog_questions", "ck_catalog_correct_options_count"):
        op.drop_constraint("ck_catalog_correct_options_count", "catalog_questions", type_="check")

    inspector = sa.inspect(bind)
    if _has_column(inspector, "catalog_questions", "correct_options_count"):
        op.drop_column("catalog_questions", "correct_options_count")

    inspector = sa.inspect(bind)
    if _has_column(inspector, "test_sessions", "pipeline_version"):
        op.drop_column("test_sessions", "pipeline_version")
