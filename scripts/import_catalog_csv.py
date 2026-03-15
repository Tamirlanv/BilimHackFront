#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
import sys


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import func, select  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.models import CatalogQuestion, CatalogQuestionStatus  # noqa: E402
from app.services.question_catalog import question_catalog_service  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import validated catalog questions from CSV file."
    )
    parser.add_argument(
        "--csv",
        required=True,
        help="Path to CSV file (utf-8, utf-8-sig).",
    )
    parser.add_argument(
        "--source",
        default="csv_question_bank",
        help="Source label stored in catalog_questions.source.",
    )
    parser.add_argument(
        "--no-publish",
        action="store_true",
        help="Import as validated only (do not publish immediately).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    csv_path = str(Path(args.csv).expanduser())

    with SessionLocal() as db:
        stats = question_catalog_service.import_from_csv_file(
            db=db,
            csv_path=csv_path,
            source=args.source,
            publish=not args.no_publish,
        )
        published_count = int(
            db.scalar(
                select(func.count(CatalogQuestion.id)).where(
                    CatalogQuestion.status == CatalogQuestionStatus.published
                )
            )
            or 0
        )

    print("CSV import completed.")
    print(f"file={csv_path}")
    print(f"imported={stats.imported}")
    print(f"updated={stats.updated}")
    print(f"skipped={stats.skipped}")
    print(f"invalid={stats.invalid}")
    print(f"published_total={published_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

