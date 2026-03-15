from __future__ import annotations

import logging
from dataclasses import dataclass

from app.models import PreferredLanguage, Subject
from app.services.recommendation_llm_service import recommendation_llm_service

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RecommendationFacts:
    percent: float
    warning_count: int
    weak_topics: list[str]


@dataclass(frozen=True)
class RecommendationPayload:
    advice_text: str
    generated_tasks: list[dict[str, str]]


class RecommendationService:
    def build_bilingual(
        self,
        *,
        subject: Subject,
        facts: RecommendationFacts,
    ) -> tuple[dict[PreferredLanguage, RecommendationPayload], list[str]]:
        weak_topics = [str(topic).strip() for topic in facts.weak_topics if str(topic).strip()]
        if not weak_topics:
            weak_topics = ["Повторение теории", "Практика", "Внимательность"]

        payloads: dict[PreferredLanguage, RecommendationPayload] = {}
        for language in (PreferredLanguage.ru, PreferredLanguage.kz):
            try:
                payload = self._generate_with_llm(
                    subject=subject,
                    language=language,
                    weak_topics=weak_topics,
                    facts=facts,
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Recommendation generation failed for %s, fallback: %s", language.value, exc)
                payload = self._fallback_payload(language=language, weak_topics=weak_topics)

            payloads[language] = RecommendationPayload(
                advice_text=self._inject_attempt_facts(
                    advice=payload.advice_text,
                    language=language,
                    percent=facts.percent,
                    warning_count=facts.warning_count,
                ),
                generated_tasks=list(payload.generated_tasks or []),
            )

        return payloads, weak_topics

    def _generate_with_llm(
        self,
        *,
        subject: Subject,
        language: PreferredLanguage,
        weak_topics: list[str],
        facts: RecommendationFacts,
    ) -> RecommendationPayload:
        advice_text, tasks = recommendation_llm_service.generate(
            subject=subject,
            language=language,
            weak_topics=weak_topics,
            percent=facts.percent,
            warning_count=facts.warning_count,
        )
        if len(tasks) < 2:
            fallback = self._fallback_payload(
                language=language,
                weak_topics=["Повторение теории", "Практика", "Внимательность"],
            )
            tasks = list(fallback.generated_tasks)
        return RecommendationPayload(advice_text=advice_text, generated_tasks=tasks)

    def _fallback_payload(
        self,
        *,
        language: PreferredLanguage,
        weak_topics: list[str],
    ) -> RecommendationPayload:
        if language == PreferredLanguage.kz:
            advice = (
                "Әлсіз тақырыптарды қысқа блоктармен қайталаңыз, "
                "қателескен сұрақтарды талдап, ұқсас тапсырмаларды қайта орындаңыз."
            )
            tasks = [
                {"topic": weak_topics[0], "task": "3 ұқсас сұрақты шешіп, қатесін түсіндіріңіз."},
                {"topic": weak_topics[min(1, len(weak_topics) - 1)], "task": "Тақырып бойынша негізгі формула/ережені жазыңыз."},
            ]
        else:
            advice = (
                "Повторите слабые темы короткими блоками, разберите ошибки по попытке "
                "и выполните 2-3 аналогичных задания для закрепления."
            )
            tasks = [
                {"topic": weak_topics[0], "task": "Решите 3 похожих задания и объясните каждую ошибку."},
                {"topic": weak_topics[min(1, len(weak_topics) - 1)], "task": "Составьте краткий конспект ключевого правила."},
            ]
        return RecommendationPayload(advice_text=advice, generated_tasks=tasks)

    def _inject_attempt_facts(
        self,
        *,
        advice: str,
        language: PreferredLanguage,
        percent: float,
        warning_count: int,
    ) -> str:
        normalized = str(advice or "").strip()
        if language == PreferredLanguage.kz:
            facts_line = f"Нәтиже: {round(percent, 1):g}%, ескертулер: {max(0, int(warning_count))}."
        else:
            facts_line = f"Результат: {round(percent, 1):g}%, предупреждений: {max(0, int(warning_count))}."
        if not normalized:
            return facts_line
        return f"{facts_line} {normalized}"


recommendation_service = RecommendationService()
