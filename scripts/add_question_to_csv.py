#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CSV = ROOT_DIR / "backend" / "app" / "db" / "database_question.csv"
CSV_HEADERS = [
    "subject_ru",
    "levels",
    "type",
    "topic_ru",
    "topic_kz",
    "prompt_ru",
    "prompt_kz",
    "options_ru",
    "options_kz",
    "correct_option_ids",
    "sample_answer_ru",
    "sample_answer_kz",
    "keywords_ru",
    "keywords_kz",
    "explanation_ru",
    "explanation_kz",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Append a new question to CSV question bank.")
    parser.add_argument("--csv", default=str(DEFAULT_CSV), help="Path to CSV file.")
    parser.add_argument("--subject-ru", required=True, help="Subject name in RU, e.g. Математика.")
    parser.add_argument(
        "--levels",
        default="medium",
        help="Difficulty level(s): easy|medium|hard. Use | for multiple.",
    )
    parser.add_argument(
        "--type",
        default="single_choice",
        choices=["single_choice", "multi_choice", "short_text"],
        help="Question type.",
    )
    parser.add_argument("--topic-ru", required=True, help="Topic in RU.")
    parser.add_argument("--topic-kz", required=True, help="Topic in KZ.")
    parser.add_argument("--prompt-ru", required=True, help="Question text in RU.")
    parser.add_argument("--prompt-kz", required=True, help="Question text in KZ.")
    parser.add_argument(
        "--options-ru",
        default="",
        help="Options in RU, separator: | (for choice questions).",
    )
    parser.add_argument(
        "--options-kz",
        default="",
        help="Options in KZ, separator: | (for choice questions).",
    )
    parser.add_argument(
        "--correct-option-ids",
        default="",
        help="Correct option ids (1-based), separator: |. Example: 2 or 1|3.",
    )
    parser.add_argument("--sample-answer-ru", default="", help="Sample answer RU for short_text.")
    parser.add_argument("--sample-answer-kz", default="", help="Sample answer KZ for short_text.")
    parser.add_argument("--keywords-ru", default="", help="Keywords RU for short_text, separator: |.")
    parser.add_argument("--keywords-kz", default="", help="Keywords KZ for short_text, separator: |.")
    parser.add_argument("--explanation-ru", default="", help="Explanation RU.")
    parser.add_argument("--explanation-kz", default="", help="Explanation KZ.")
    return parser.parse_args()


def normalize_pipe_list(value: str) -> str:
    if not value:
        return ""
    tokens = [item.strip() for item in value.replace(";", "|").split("|") if item.strip()]
    return "|".join(tokens)


def ensure_file_and_headers(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=CSV_HEADERS)
            writer.writeheader()
        return

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = reader.fieldnames or []
    if headers != CSV_HEADERS:
        raise ValueError(
            "CSV header mismatch. Expected columns:\n"
            + ", ".join(CSV_HEADERS)
            + "\n\nFound:\n"
            + ", ".join(headers)
        )


def validate_payload(payload: dict[str, str]) -> None:
    q_type = payload["type"]
    if q_type in {"single_choice", "multi_choice"}:
        if not payload["options_ru"] or not payload["options_kz"]:
            raise ValueError("Choice question requires --options-ru and --options-kz.")
        if not payload["correct_option_ids"]:
            raise ValueError("Choice question requires --correct-option-ids.")
    if q_type == "short_text":
        if not payload["sample_answer_ru"] and not payload["keywords_ru"]:
            raise ValueError("short_text question requires RU sample answer or RU keywords.")
        if not payload["sample_answer_kz"] and not payload["keywords_kz"]:
            raise ValueError("short_text question requires KZ sample answer or KZ keywords.")


def count_rows(path: Path) -> int:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return sum(1 for _ in reader)


def main() -> int:
    args = parse_args()
    csv_path = Path(args.csv).expanduser().resolve()
    ensure_file_and_headers(csv_path)

    row = {
        "subject_ru": args.subject_ru.strip(),
        "levels": normalize_pipe_list(args.levels),
        "type": args.type.strip(),
        "topic_ru": args.topic_ru.strip(),
        "topic_kz": args.topic_kz.strip(),
        "prompt_ru": args.prompt_ru.strip(),
        "prompt_kz": args.prompt_kz.strip(),
        "options_ru": normalize_pipe_list(args.options_ru),
        "options_kz": normalize_pipe_list(args.options_kz),
        "correct_option_ids": normalize_pipe_list(args.correct_option_ids),
        "sample_answer_ru": args.sample_answer_ru.strip(),
        "sample_answer_kz": args.sample_answer_kz.strip(),
        "keywords_ru": normalize_pipe_list(args.keywords_ru),
        "keywords_kz": normalize_pipe_list(args.keywords_kz),
        "explanation_ru": args.explanation_ru.strip(),
        "explanation_kz": args.explanation_kz.strip(),
    }
    validate_payload(row)

    with csv_path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_HEADERS)
        writer.writerow(row)

    total = count_rows(csv_path)
    print("Question appended to CSV successfully.")
    print(f"file={csv_path}")
    print(f"rows_total={total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

