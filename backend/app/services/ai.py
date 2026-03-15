from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.models import DifficultyLevel, PreferredLanguage, Subject
from app.services.recommendation_service import (
    RecommendationFacts,
    RecommendationPayload,
    recommendation_service,
)
from app.services.teacher_material_service import TeacherMaterialResult, teacher_material_service


@dataclass(frozen=True)
class TeacherGenerationPayload:
    prompt: str
    answer_type: str
    options: list[str]
    correct_option_index: int | None
    sample_answer: str | None
    image_data_url: str | None


class AIService:
    """
    Thin compatibility adapter.

    Runtime student test generation is intentionally removed from this service.
    Student pipeline must use catalog retrieval + runtime services.
    """

    def generate_teacher_custom_material(
        self,
        *,
        topic: str,
        difficulty: DifficultyLevel,
        language: PreferredLanguage,
        questions_count: int,
        user_id: int,
    ) -> list[dict[str, Any]]:
        result: TeacherMaterialResult = teacher_material_service.generate_and_validate(
            topic=topic,
            difficulty=difficulty,
            language=language,
            questions_count=questions_count,
            user_id=user_id,
        )
        return [
            {
                "prompt": item.prompt,
                "answer_type": item.answer_type,
                "options": list(item.options),
                "correct_option_index": item.correct_option_index,
                "sample_answer": item.sample_answer,
                "image_data_url": item.image_data_url,
            }
            for item in result.questions
        ]

    def build_recommendation_bilingual(
        self,
        *,
        subject: Subject,
        percent: float,
        warning_count: int,
        weak_topics: list[str],
    ) -> tuple[dict[PreferredLanguage, RecommendationPayload], list[str]]:
        facts = RecommendationFacts(
            percent=float(percent),
            warning_count=int(warning_count),
            weak_topics=list(weak_topics),
        )
        return recommendation_service.build_bilingual(subject=subject, facts=facts)


ai_service = AIService()

