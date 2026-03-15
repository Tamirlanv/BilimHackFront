from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from app.core.config import settings
from app.models import DifficultyLevel, PreferredLanguage, TestMode
from app.schemas.teacher_tests import TeacherCustomMaterialQuestion
from app.services.llm import is_llm_provider_configured, llm_chat
from app.services.question_quality import validate_question_payload


class MaterialQualityError(ValueError):
    pass


@dataclass(frozen=True)
class TeacherMaterialResult:
    questions: list[TeacherCustomMaterialQuestion]
    rejected_count: int


class TeacherMaterialService:
    def generate_and_validate(
        self,
        *,
        topic: str,
        difficulty: DifficultyLevel,
        language: PreferredLanguage,
        questions_count: int,
        user_id: int,
    ) -> TeacherMaterialResult:
        if not is_llm_provider_configured(audience="teacher"):
            raise MaterialQualityError("MATERIAL_QUALITY_FAILED: LLM provider is not configured for teacher generation.")

        normalized_topic = str(topic).strip()
        requested = max(1, int(questions_count))
        accepted: list[TeacherCustomMaterialQuestion] = []
        rejected = 0
        seen_prompt_keys: set[str] = set()
        last_error: str | None = None

        max_calls = 6
        for attempt in range(1, max_calls + 1):
            remaining = max(0, requested - len(accepted))
            if remaining <= 0:
                break
            # Ask for a slightly bigger batch than remaining so validation can reject low-quality items.
            oversample = max(2, round(remaining * 0.4))
            batch_size = min(16, remaining + oversample)
            try:
                llm_items = self._generate_raw_with_llm(
                    topic=normalized_topic,
                    difficulty=difficulty,
                    language=language,
                    questions_count=batch_size,
                    target_questions_count=requested,
                    user_id=user_id,
                    attempt=attempt,
                )
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)
                continue

            before_count = len(accepted)
            accepted, rejected = self._validate_batch(
                topic=normalized_topic,
                difficulty=difficulty,
                language=language,
                questions_count=requested,
                raw_items=llm_items,
                seen_prompt_keys=seen_prompt_keys,
                accepted_prefix=accepted,
                rejected_prefix=rejected,
            )
            if len(accepted) == before_count:
                last_error = "LLM returned batch without valid questions."
            if len(accepted) >= requested:
                return TeacherMaterialResult(questions=accepted[:requested], rejected_count=rejected)

        if accepted:
            return TeacherMaterialResult(questions=accepted[:requested], rejected_count=rejected)

        details = last_error or "LLM returned no valid questions."
        raise MaterialQualityError(f"MATERIAL_QUALITY_FAILED: {details}")

    def _generate_raw_with_llm(
        self,
        *,
        topic: str,
        difficulty: DifficultyLevel,
        language: PreferredLanguage,
        questions_count: int,
        target_questions_count: int,
        user_id: int,
        attempt: int,
    ) -> list[dict[str, Any]]:
        language_label = "RU" if language == PreferredLanguage.ru else "KZ"
        blueprint = self._build_blueprint(
            topic=topic,
            difficulty=difficulty,
            language=language,
            batch_size=questions_count,
        )
        system_prompt = (
            "Ты помощник преподавателя. Сгенерируй валидный набор вопросов для теста. "
            "Отвечай строго JSON-объектом без markdown и комментариев. "
            'Формат: {"questions":[{"answer_type":"choice|free_text","prompt":"...","options":[...],'
            '"correct_option_index":0,"sample_answer":"...","topic":"...","explanation":"..."}]}. '
            "Для answer_type=choice: минимум 4 варианта, ровно один правильный индекс. "
            "Для answer_type=free_text: options пустой массив, sample_answer обязателен. "
            "Запрещены пустые или шаблонные формулировки."
        )
        user_prompt = (
            f"Тема: {topic}\n"
            f"Сложность: {difficulty.value}\n"
            f"Язык: {language_label}\n"
            f"Требуемый размер итогового теста: {target_questions_count}\n"
            f"Сгенерировать в этой пачке: {questions_count}\n"
            f"Попытка: {attempt}\n"
            f"User id: {user_id}\n"
            "Требования:\n"
            "1) Вопросы должны быть строго по теме.\n"
            "2) Без дублей формулировок.\n"
            "3) Никаких placeholders.\n"
            "4) Для choice не используй варианты 'все ответы верны' или 'нет правильного ответа'.\n"
            "5) В поле topic у каждого вопроса используй формат '<основная тема>: <подтема>'.\n"
            "6) Если тема короткая (одно слово), раскрой ее через разные подтемы.\n"
            "7) Держи баланс типов вопросов по плану ниже.\n"
            f"{blueprint}\n"
            "8) Приоритет answer_type=choice. free_text допускается, но не более 30% в пачке."
        )
        raw = llm_chat(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.2,
            timeout_seconds=max(15, min(50, int(settings.openai_timeout_seconds))),
            max_tokens=max(900, min(5000, questions_count * 260)),
            audience="teacher",
        )
        payload = self._extract_json(raw)
        questions = payload.get("questions")
        if not isinstance(questions, list):
            raise MaterialQualityError("MATERIAL_QUALITY_FAILED: LLM response must include `questions` array.")
        return [item for item in questions if isinstance(item, dict)]

    def _extract_json(self, content: str) -> dict[str, Any]:
        normalized = str(content or "").strip()
        if not normalized:
            raise MaterialQualityError("MATERIAL_QUALITY_FAILED: empty LLM response.")
        try:
            return json.loads(normalized)
        except json.JSONDecodeError:
            pass

        fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", normalized, flags=re.DOTALL | re.IGNORECASE)
        if fenced:
            return json.loads(fenced.group(1))

        start = normalized.find("{")
        end = normalized.rfind("}")
        if start >= 0 and end > start:
            return json.loads(normalized[start : end + 1])
        raise MaterialQualityError("MATERIAL_QUALITY_FAILED: non-JSON LLM response.")

    def _validate_batch(
        self,
        *,
        topic: str,
        difficulty: DifficultyLevel,
        language: PreferredLanguage,
        questions_count: int,
        raw_items: list[dict[str, Any]],
        seen_prompt_keys: set[str],
        accepted_prefix: list[TeacherCustomMaterialQuestion],
        rejected_prefix: int,
    ) -> tuple[list[TeacherCustomMaterialQuestion], int]:
        accepted = list(accepted_prefix)
        rejected = int(rejected_prefix)

        for raw in raw_items:
            converted = self._normalize_raw_question(raw, topic_fallback=topic)
            if not converted:
                rejected += 1
                continue

            prompt = str(converted.get("prompt", "")).strip()
            prompt_key = _prompt_key(prompt)
            if prompt_key in seen_prompt_keys:
                rejected += 1
                continue
            if not self._is_topic_relevant(
                topic=topic,
                prompt=prompt,
                sample_answer=str(converted.get("sample_answer", "")),
                explanation=str(converted.get("explanation", "")),
                topic_tags=converted.get("topic_tags"),
            ):
                rejected += 1
                continue

            validation = validate_question_payload(
                payload=converted,
                language=language,
                mode=TestMode.text,
                difficulty=difficulty,
            )
            if not validation.is_valid:
                rejected += 1
                continue

            normalized = validation.payload
            question = self._to_schema_item(normalized)
            if question is None:
                rejected += 1
                continue

            accepted.append(question)
            seen_prompt_keys.add(prompt_key)
            if len(accepted) >= questions_count:
                break

        return accepted, rejected

    def _normalize_raw_question(
        self,
        raw: dict[str, Any],
        *,
        topic_fallback: str,
    ) -> dict[str, Any] | None:
        prompt = str(raw.get("prompt", "")).strip()
        if not prompt:
            return None
        topic_value = str(raw.get("topic") or "").strip() or str(topic_fallback).strip()
        topic_tags = [topic_value] if topic_value else []

        answer_type = str(raw.get("answer_type", "choice")).strip().lower()
        if answer_type in {"free_text", "short_text", "text"}:
            sample_answer = str(raw.get("sample_answer", "")).strip()
            if not sample_answer:
                return None
            return {
                "type": "short_text",
                "prompt": prompt,
                "sample_answer": sample_answer,
                "keywords": [str(item).strip() for item in (raw.get("keywords") or []) if str(item).strip()],
                "topic_tags": topic_tags,
                "explanation": str(raw.get("explanation") or sample_answer).strip(),
            }

        options = [str(option).strip() for option in (raw.get("options") or []) if str(option).strip()]
        if len(options) < 2:
            return None
        raw_correct_index = raw.get("correct_option_index")
        try:
            correct_index = int(raw_correct_index) if raw_correct_index is not None else None
        except (TypeError, ValueError):
            correct_index = None
        if correct_index is None or correct_index < 0 or correct_index >= len(options):
            return None
        return {
            "type": "single_choice",
            "prompt": prompt,
            "options": options,
            "correct_option_ids": [correct_index + 1],
            "topic_tags": topic_tags,
            "explanation": str(raw.get("explanation") or prompt).strip(),
        }

    def _to_schema_item(self, normalized_payload: dict[str, Any]) -> TeacherCustomMaterialQuestion | None:
        question_type = str(normalized_payload.get("type", "single_choice"))
        if question_type == "short_text":
            sample_answer = str((normalized_payload.get("correct_answer_json") or {}).get("sample_answer", "")).strip()
            if not sample_answer:
                return None
            return TeacherCustomMaterialQuestion(
                prompt=str(normalized_payload.get("prompt", "")).strip(),
                answer_type="free_text",
                options=[],
                correct_option_index=None,
                sample_answer=sample_answer,
                image_data_url=None,
            )

        options = [
            str(item.get("text", "")).strip()
            for item in (normalized_payload.get("options_json") or {}).get("options", [])
            if isinstance(item, dict) and str(item.get("text", "")).strip()
        ]
        correct_ids = [
            int(item)
            for item in (normalized_payload.get("correct_answer_json") or {}).get("correct_option_ids", [])
            if isinstance(item, (int, float, str)) and str(item).lstrip("-").isdigit()
        ]
        if len(options) < 2 or len(correct_ids) != 1:
            return None
        return TeacherCustomMaterialQuestion(
            prompt=str(normalized_payload.get("prompt", "")).strip(),
            answer_type="choice",
            options=options,
            correct_option_index=correct_ids[0] - 1,
            sample_answer=None,
            image_data_url=None,
        )

    def _is_topic_relevant(
        self,
        *,
        topic: str,
        prompt: str,
        sample_answer: str,
        explanation: str,
        topic_tags: Any,
    ) -> bool:
        topic_tokens = _tokens(topic)
        if not topic_tokens:
            return True
        tags_text = " ".join(str(tag).strip() for tag in (topic_tags or []) if str(tag).strip())
        joined = f"{prompt} {sample_answer} {explanation} {tags_text}".strip().lower()
        content_tokens = _tokens(joined)
        if not content_tokens:
            return False
        overlap = topic_tokens.intersection(content_tokens)
        if (len(overlap) / max(1, len(topic_tokens))) >= 0.2:
            return True
        if _fuzzy_token_overlap(topic_tokens, content_tokens) >= 0.35:
            return True
        return any(token in joined for token in topic_tokens)

    def _build_blueprint(
        self,
        *,
        topic: str,
        difficulty: DifficultyLevel,
        language: PreferredLanguage,
        batch_size: int,
    ) -> str:
        lang_hint = "русском" if language == PreferredLanguage.ru else "казахском"
        categories = self._difficulty_categories(difficulty=difficulty)
        plan_lines: list[str] = []
        remaining = batch_size
        for idx, (name, weight) in enumerate(categories):
            if idx == len(categories) - 1:
                count = remaining
            else:
                count = max(1, round(batch_size * weight))
                count = min(count, remaining - max(0, (len(categories) - idx - 1)))
            remaining -= count
            plan_lines.append(f"- {name}: {count}")

        return (
            f"Тема: {topic}\n"
            f"Язык: {lang_hint}\n"
            "Распределение по категориям:\n"
            + "\n".join(plan_lines)
            + "\nИзбегай повторения одного и того же шаблона вопроса."
        )

    def _difficulty_categories(self, *, difficulty: DifficultyLevel) -> list[tuple[str, float]]:
        if difficulty == DifficultyLevel.easy:
            return [
                ("термины и определения", 0.28),
                ("базовая теория", 0.24),
                ("свойства и формулы", 0.20),
                ("понимание понятий", 0.16),
                ("простое применение", 0.12),
            ]
        if difficulty == DifficultyLevel.medium:
            return [
                ("термины и определения", 0.18),
                ("теория и свойства", 0.22),
                ("формулы и преобразования", 0.20),
                ("типовые задачи", 0.24),
                ("типичные ошибки", 0.16),
            ]
        return [
            ("продвинутая теория", 0.16),
            ("термины и взаимосвязи", 0.16),
            ("формулы и ограничения", 0.20),
            ("задачи повышенной сложности", 0.26),
            ("ошибки и контрпримеры", 0.22),
        ]


def _prompt_key(prompt: str) -> str:
    normalized = re.sub(r"\s+", " ", prompt.lower()).strip()
    normalized = re.sub(r"[^\wа-яәіңғүұқөһ ]+", "", normalized, flags=re.IGNORECASE)
    return normalized


def _tokens(value: str) -> set[str]:
    parts = re.split(r"[^\wа-яәіңғүұқөһ]+", value.lower(), flags=re.IGNORECASE)
    return {part for part in parts if len(part) >= 3}


def _fuzzy_token_overlap(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    matched = 0
    for left_token in left:
        if any(_tokens_are_related(left_token, right_token) for right_token in right):
            matched += 1
    return matched / max(1, len(left))


def _tokens_are_related(left: str, right: str) -> bool:
    l = _token_stem(left)
    r = _token_stem(right)
    if not l or not r:
        return False
    if l == r:
        return True
    min_len = min(len(l), len(r))
    if min_len < 5:
        return False
    prefix_len = 6 if min_len >= 8 else 5
    return l[:prefix_len] == r[:prefix_len]


def _token_stem(token: str) -> str:
    value = re.sub(r"[^a-zа-яәіңғүұқөһ0-9]", "", str(token or "").lower())
    if len(value) <= 5:
        return value
    endings = (
        "иями",
        "ями",
        "ами",
        "ией",
        "ий",
        "ый",
        "ой",
        "ая",
        "ое",
        "ее",
        "ые",
        "ого",
        "ему",
        "ыми",
        "ими",
        "ать",
        "ять",
        "ить",
        "еть",
        "ться",
        "ция",
        "ции",
        "цию",
        "циям",
        "лардың",
        "лердің",
        "лары",
        "лері",
    )
    for ending in endings:
        if value.endswith(ending) and len(value) - len(ending) >= 4:
            return value[: -len(ending)]
    return value


teacher_material_service = TeacherMaterialService()
