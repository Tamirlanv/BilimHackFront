from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any

from app.models import DifficultyLevel, PreferredLanguage, QuestionType, TestMode


class QuestionQualityError(ValueError):
    pass


@dataclass(frozen=True)
class QuestionValidationResult:
    payload: dict[str, Any]
    issues: list[str]

    @property
    def is_valid(self) -> bool:
        return len(self.issues) == 0


_ALLOWED_TYPES = {
    QuestionType.single_choice.value,
    QuestionType.multi_choice.value,
    QuestionType.short_text.value,
    QuestionType.oral_answer.value,
}


def normalize_text(value: Any) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text


def sanitize_prompt_text(value: Any) -> str:
    text = normalize_text(value)
    # Remove imported numbering suffixes like "(28)" that should not be shown in UI.
    text = re.sub(r"\s*\(\d+\)\s*$", "", text)
    return text.strip()


def normalize_topic_tags(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    output: list[str] = []
    seen: set[str] = set()
    for item in values:
        normalized = normalize_text(item)
        key = normalized.lower()
        if not normalized or key in seen:
            continue
        seen.add(key)
        output.append(normalized)
    return output


def normalize_choice_options(options: Any) -> list[str]:
    if not isinstance(options, list):
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for option in options:
        text = normalize_text(option)
        key = text.lower()
        if not text or key in seen:
            continue
        seen.add(key)
        normalized.append(text)
    return normalized


def _normalize_correct_option_ids(value: Any) -> list[int]:
    if not isinstance(value, list):
        return []
    output: list[int] = []
    seen: set[int] = set()
    for item in value:
        try:
            idx = int(item)
        except (TypeError, ValueError):
            continue
        if idx in seen:
            continue
        seen.add(idx)
        output.append(idx)
    return output


def _build_options_json(options: list[str]) -> dict[str, Any]:
    return {
        "options": [{"id": idx + 1, "text": option} for idx, option in enumerate(options)]
    }


def build_question_content_hash(payload: dict[str, Any]) -> str:
    fingerprint = {
        "type": str(payload.get("type", "")).strip(),
        "prompt": normalize_text(payload.get("prompt", "")).lower(),
        "options": [
            normalize_text(item).lower()
            for item in (payload.get("options") or [])
            if normalize_text(item)
        ],
        "sample_answer": normalize_text(payload.get("sample_answer", "")).lower(),
        "keywords": [
            normalize_text(item).lower()
            for item in (payload.get("keywords") or [])
            if normalize_text(item)
        ],
        "topic_tags": [
            normalize_text(item).lower()
            for item in (payload.get("topic_tags") or [])
            if normalize_text(item)
        ],
    }
    encoded = json.dumps(fingerprint, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def validate_question_payload(
    *,
    payload: dict[str, Any],
    language: PreferredLanguage,
    mode: TestMode,
    difficulty: DifficultyLevel,
) -> QuestionValidationResult:
    issues: list[str] = []

    question_type = str(payload.get("type", payload.get("answer_type", "single_choice"))).strip()
    if question_type == "choice":
        question_type = QuestionType.single_choice.value
    elif question_type == "free_text":
        question_type = QuestionType.short_text.value

    if question_type not in _ALLOWED_TYPES:
        issues.append(f"unsupported question type: {question_type}")
        question_type = QuestionType.single_choice.value

    prompt = normalize_text(payload.get("prompt"))
    prompt = sanitize_prompt_text(prompt)
    if len(prompt) < 6:
        issues.append("prompt is too short")

    topic = normalize_text(payload.get("topic") or payload.get("topic_tag") or "")
    topic_tags = normalize_topic_tags(payload.get("topic_tags") or ([topic] if topic else []))

    explanation = normalize_text(payload.get("explanation") or payload.get("correct_explanation"))
    if not explanation:
        explanation = prompt

    normalized_payload: dict[str, Any] = {
        "type": question_type,
        "prompt": prompt,
        "topic_tags": topic_tags,
        "language": language,
        "mode": mode,
        "difficulty": difficulty,
    }

    if question_type in {QuestionType.single_choice.value, QuestionType.multi_choice.value}:
        options = normalize_choice_options(payload.get("options") or payload.get("options_json", {}).get("options", []))
        if len(options) < 2:
            issues.append("choice question must have at least 2 unique options")

        correct_option_ids = _normalize_correct_option_ids(
            payload.get("correct_option_ids")
            or payload.get("correct_answer_json", {}).get("correct_option_ids")
            or payload.get("correct_answer", [])
        )
        if question_type == QuestionType.single_choice.value and len(correct_option_ids) != 1:
            issues.append("single_choice must have exactly one correct option")
        if question_type == QuestionType.multi_choice.value and len(correct_option_ids) < 1:
            issues.append("multi_choice must have at least one correct option")

        if options:
            max_id = len(options)
            if any(option_id < 1 or option_id > max_id for option_id in correct_option_ids):
                issues.append("correct option id is out of range")

            prompt_lower = prompt.lower()
            asks_comma_in_sentence = (
                "запят" in prompt_lower
                and ("предложен" in prompt_lower or "вариант" in prompt_lower)
            )
            if asks_comma_in_sentence and all("," not in option for option in options):
                issues.append("punctuation prompt expects comma-bearing options")

        normalized_payload.update(
            {
                "options": options,
                "options_json": _build_options_json(options),
                "correct_answer_json": {"correct_option_ids": correct_option_ids},
                "correct_options_count": len(correct_option_ids),
                "sample_answer": "",
                "keywords": [],
                "explanation_json": {
                    "topic": topic_tags[0] if topic_tags else "General",
                    "correct_explanation": explanation,
                },
            }
        )
    else:
        sample_answer = normalize_text(
            payload.get("sample_answer")
            or payload.get("correct_answer_json", {}).get("sample_answer")
        )
        if len(sample_answer) < 2:
            issues.append("short_text question must have sample_answer")

        raw_keywords = payload.get("keywords") or payload.get("correct_answer_json", {}).get("keywords") or []
        keywords = normalize_topic_tags(raw_keywords)

        normalized_payload.update(
            {
                "options": [],
                "options_json": None,
                "correct_answer_json": {
                    "sample_answer": sample_answer,
                    "keywords": keywords,
                },
                "correct_options_count": 0,
                "sample_answer": sample_answer,
                "keywords": keywords,
                "explanation_json": {
                    "topic": topic_tags[0] if topic_tags else "General",
                    "correct_explanation": explanation,
                },
            }
        )

    normalized_payload["content_hash"] = build_question_content_hash(normalized_payload)
    return QuestionValidationResult(payload=normalized_payload, issues=issues)


def ensure_question_payload(
    *,
    payload: dict[str, Any],
    language: PreferredLanguage,
    mode: TestMode,
    difficulty: DifficultyLevel,
) -> dict[str, Any]:
    validation = validate_question_payload(
        payload=payload,
        language=language,
        mode=mode,
        difficulty=difficulty,
    )
    if not validation.is_valid:
        raise QuestionQualityError("; ".join(validation.issues))
    return validation.payload
