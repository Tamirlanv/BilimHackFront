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

_LINEAR_INEQUALITY_RE = re.compile(
    r"(?P<a>[+\-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)?)?\s*\*?\s*x"
    r"\s*(?P<b>[+\-]\s*\(?\s*[+\-]?\d+(?:[.,]\d+)?\s*\)?)?"
    r"\s*(?P<op><=|>=|<|>|≤|≥)\s*(?P<c>[+\-]?\d+(?:[.,]\d+)?)",
    flags=re.IGNORECASE,
)
_X_RELATION_OPTION_RE = re.compile(
    r"^\s*x\s*(?P<op><=|>=|<|>|≤|≥)\s*(?P<v>[+\-]?\d+(?:[.,]\d+)?)\s*$",
    flags=re.IGNORECASE,
)


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
        if isinstance(option, dict):
            option_value = option.get("text", option.get("value", ""))
        else:
            option_value = option
        text = normalize_text(option_value)
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


def _normalize_ineq_operator(value: str) -> str:
    return str(value or "").strip().replace("≤", "<=").replace("≥", ">=")


def _reverse_ineq_operator(value: str) -> str:
    normalized = _normalize_ineq_operator(value)
    mapping = {
        "<": ">",
        "<=": ">=",
        ">": "<",
        ">=": "<=",
    }
    return mapping.get(normalized, normalized)


def _parse_number(value: str) -> float | None:
    text = str(value or "").strip().replace(",", ".")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _parse_linear_inequality_from_prompt(prompt: str) -> tuple[str, float] | None:
    match = _LINEAR_INEQUALITY_RE.search(prompt or "")
    if match is None:
        return None

    raw_a = str(match.group("a") or "").strip().replace(" ", "")
    if raw_a in {"", "+"}:
        a = 1.0
    elif raw_a == "-":
        a = -1.0
    else:
        a = _parse_number(raw_a)
        if a is None:
            return None

    raw_b = str(match.group("b") or "").strip().replace(" ", "")
    if not raw_b:
        b = 0.0
    else:
        cleaned_b = raw_b.replace("(", "").replace(")", "")
        b = _parse_number(cleaned_b)
        if b is None:
            return None

    c = _parse_number(str(match.group("c") or ""))
    if c is None or a == 0:
        return None

    op = _normalize_ineq_operator(str(match.group("op") or ""))
    threshold = (c - b) / a
    if a < 0:
        op = _reverse_ineq_operator(op)
    return op, threshold


def _satisfies_inequality(*, value: float, operator: str, threshold: float, eps: float = 1e-9) -> bool:
    if operator == "<":
        return value < threshold - eps
    if operator == "<=":
        return value <= threshold + eps
    if operator == ">":
        return value > threshold + eps
    if operator == ">=":
        return value >= threshold - eps
    return False


def _validate_single_choice_inequality_semantics(
    *,
    prompt: str,
    options: list[str],
    correct_option_ids: list[int],
    issues: list[str],
) -> None:
    if len(options) < 2:
        return

    parsed_prompt = _parse_linear_inequality_from_prompt(prompt)
    if parsed_prompt is None:
        return
    operator, threshold = parsed_prompt

    numeric_values = [_parse_number(option) for option in options]
    if all(value is not None for value in numeric_values):
        satisfying_ids = [
            idx + 1
            for idx, option_value in enumerate(numeric_values)
            if option_value is not None and _satisfies_inequality(value=option_value, operator=operator, threshold=threshold)
        ]
        if len(satisfying_ids) != 1:
            issues.append("inequality single_choice must have exactly one satisfying numeric option")
            return
        if correct_option_ids and correct_option_ids[0] != satisfying_ids[0]:
            issues.append("correct option id does not match inequality solution")
        return

    parsed_relations: list[tuple[str, float] | None] = []
    for option in options:
        match = _X_RELATION_OPTION_RE.match(normalize_text(option))
        if match is None:
            parsed_relations.append(None)
            continue
        rel_op = _normalize_ineq_operator(str(match.group("op") or ""))
        rel_value = _parse_number(str(match.group("v") or ""))
        if rel_value is None:
            parsed_relations.append(None)
            continue
        parsed_relations.append((rel_op, rel_value))

    if any(item is None for item in parsed_relations):
        return

    equivalent_ids = [
        idx + 1
        for idx, relation in enumerate(parsed_relations)
        if relation is not None
        and relation[0] == operator
        and abs(relation[1] - threshold) <= 1e-6
    ]
    if len(equivalent_ids) != 1:
        issues.append("inequality single_choice must have exactly one equivalent inequality option")
        return
    if correct_option_ids and correct_option_ids[0] != equivalent_ids[0]:
        issues.append("correct option id does not match inequality solution")


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

            if question_type == QuestionType.single_choice.value:
                _validate_single_choice_inequality_semantics(
                    prompt=prompt,
                    options=options,
                    correct_option_ids=correct_option_ids,
                    issues=issues,
                )

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
