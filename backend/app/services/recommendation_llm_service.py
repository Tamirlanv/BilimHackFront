from __future__ import annotations

import json
import re
from typing import Any

from app.core.config import settings
from app.models import PreferredLanguage, Subject
from app.services.llm import LLMProviderError, is_llm_provider_configured, llm_chat


class RecommendationLLMService:
    def is_configured(self) -> bool:
        return is_llm_provider_configured(audience="student")

    def generate(
        self,
        *,
        subject: Subject,
        language: PreferredLanguage,
        weak_topics: list[str],
        percent: float,
        warning_count: int,
    ) -> tuple[str, list[dict[str, str]]]:
        if not self.is_configured():
            raise LLMProviderError("Student LLM provider is not configured", retryable=False)

        language_label = "русском" if language == PreferredLanguage.ru else "казахском"
        response_language = "RU" if language == PreferredLanguage.ru else "KZ"
        system_prompt = (
            "Ты методист образовательной платформы. "
            "Сформируй короткие персональные рекомендации по результату теста. "
            "Ответ только JSON-объектом, без markdown и текста вокруг. "
            'Формат: {"advice_text": "...", "generated_tasks": [{"topic": "...", "task": "..."}]}. '
            "generated_tasks: 2-5 элементов, каждая task конкретная и проверяемая."
        )
        user_prompt = (
            f"Язык ответа: {response_language} ({language_label}).\n"
            f"Предмет: {subject.name_ru} / {subject.name_kz}\n"
            f"Результат: {round(float(percent), 2)}%\n"
            f"Предупреждения: {max(0, int(warning_count))}\n"
            f"Слабые темы: {', '.join(weak_topics)}\n"
            "Сфокусируйся на ближайших шагах на 1-3 дня."
        )
        content = llm_chat(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.2,
            timeout_seconds=max(12, min(40, int(settings.openai_timeout_seconds))),
            audience="student",
        )

        payload = self._extract_json(content)
        advice_text = str(payload.get("advice_text", "")).strip()
        if not advice_text:
            raise ValueError("LLM recommendation: empty advice_text")

        raw_tasks = payload.get("generated_tasks", [])
        if not isinstance(raw_tasks, list):
            raise ValueError("LLM recommendation: generated_tasks must be a list")

        tasks: list[dict[str, str]] = []
        for task in raw_tasks:
            if not isinstance(task, dict):
                continue
            topic = str(task.get("topic", "")).strip()
            text = str(task.get("task", "")).strip()
            if not topic or not text:
                continue
            tasks.append({"topic": topic, "task": text})
            if len(tasks) >= 5:
                break
        return advice_text, tasks

    def _extract_json(self, content: str) -> dict[str, Any]:
        normalized = str(content or "").strip()
        if not normalized:
            raise ValueError("LLM returned empty recommendation payload")
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
        raise ValueError("LLM returned non-JSON recommendation payload")


recommendation_llm_service = RecommendationLLMService()

