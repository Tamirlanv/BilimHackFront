from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.models import DifficultyLevel, PreferredLanguage, TestMode
from app.schemas.teacher_tests import TeacherCustomMaterialQuestion


class CatalogImportRequest(BaseModel):
    subject_id: int | None = None
    min_questions_per_subject: int = Field(default=50, ge=10, le=5000)


class CatalogImportResponse(BaseModel):
    imported: int
    updated: int
    skipped: int
    invalid: int
    published_questions: int


class CatalogValidateRequest(BaseModel):
    subject_id: int


class CatalogValidateResponse(BaseModel):
    validated: int


class CatalogPublishRequest(BaseModel):
    subject_id: int


class CatalogPublishResponse(BaseModel):
    published: int


class AssembleTestRequest(BaseModel):
    subject_id: int
    difficulty: DifficultyLevel
    language: PreferredLanguage
    mode: TestMode
    num_questions: int = Field(default=10, ge=3, le=40)
    time_limit_minutes: int | None = Field(default=None, ge=5, le=180)
    warning_limit: int = Field(default=10, ge=0, le=20)

    @field_validator("time_limit_minutes")
    @classmethod
    def validate_time_limit_minutes(cls, value: int | None) -> int | None:
        if value is None:
            return value
        if value not in {5, 10, 15, 20, 30, 45, 60, 90, 120, 180}:
            raise ValueError("time_limit_minutes должен быть одним из: 5, 10, 15, 20, 30, 45, 60, 90, 120, 180")
        return value


class TestWarningSignal(BaseModel):
    type: str
    at_seconds: int = Field(default=0, ge=0)
    question_id: int | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class TestTelemetryPayload(BaseModel):
    elapsed_seconds: int | None = Field(default=None, ge=0)
    warnings: list[TestWarningSignal] = Field(default_factory=list)


class RuntimeAnswerRequest(BaseModel):
    question_id: int
    student_answer_json: dict[str, Any]
    latency_ms: int | None = Field(default=None, ge=0)


class RuntimeAnswerResponse(BaseModel):
    question_id: int
    is_correct: bool
    score: float
    answered_count: int
    total_questions: int
    warning_count: int


class RuntimeSubmitAnswerItem(BaseModel):
    question_id: int
    student_answer_json: dict[str, Any]


class RuntimeSubmitRequest(BaseModel):
    answers: list[RuntimeSubmitAnswerItem] = Field(default_factory=list)
    telemetry: TestTelemetryPayload | None = None


class RuntimeStateAnswer(BaseModel):
    question_id: int
    answered: bool
    score: float | None = None
    is_correct: bool | None = None


class RuntimeStateResponse(BaseModel):
    test_id: int
    submitted: bool
    created_at: datetime
    started_at: datetime
    submitted_at: datetime | None = None
    elapsed_seconds: int
    time_limit_seconds: int | None = None
    warning_limit: int | None = None
    warning_count: int
    warning_events: list[dict[str, Any]]
    answered_count: int
    total_questions: int
    answers: list[RuntimeStateAnswer]


class RuntimeResultResponse(BaseModel):
    total_score: float
    max_score: float
    percent: float
    elapsed_seconds: int
    time_limit_seconds: int | None = None
    warning_count: int


class RuntimeRecommendationResponse(BaseModel):
    weak_topics: list[str]
    advice_text: str
    generated_tasks: list[dict[str, Any]]
    advice_text_ru: str | None = None
    advice_text_kz: str | None = None
    generated_tasks_ru: list[dict[str, Any]] | None = None
    generated_tasks_kz: list[dict[str, Any]] | None = None


class RuntimeQuestionFeedbackResponse(BaseModel):
    question_id: int
    prompt: str
    topic: str
    student_answer: dict[str, Any]
    expected_hint: dict[str, Any]
    is_correct: bool
    score: float
    explanation: str


class RuntimeSubmitResponse(BaseModel):
    test_id: int
    submitted_at: datetime
    result: RuntimeResultResponse
    integrity_warnings: list[dict[str, Any]]
    feedback: list[RuntimeQuestionFeedbackResponse]
    recommendation: RuntimeRecommendationResponse


class TeacherMaterialGenerateV2Request(BaseModel):
    topic: str = Field(min_length=2, max_length=160)
    difficulty: DifficultyLevel = DifficultyLevel.medium
    questions_count: int = Field(ge=1, le=120, default=10)
    language: PreferredLanguage = PreferredLanguage.ru


class TeacherMaterialGenerateV2Response(BaseModel):
    topic: str
    difficulty: DifficultyLevel
    questions_count: int
    rejected_count: int
    questions: list[TeacherCustomMaterialQuestion]


class CatalogQuestionCreateItem(BaseModel):
    subject_id: int
    language: PreferredLanguage
    mode: TestMode
    difficulty: DifficultyLevel
    question: dict[str, Any]
    source: str = "manual_import"
    source_ref: str | None = None


class CatalogValidateItemResponse(BaseModel):
    is_valid: bool
    issues: list[str] = Field(default_factory=list)
    content_hash: str | None = None


class CatalogValidateBatchRequest(BaseModel):
    items: list[CatalogQuestionCreateItem] = Field(default_factory=list, min_length=1, max_length=1000)


class CatalogValidateBatchResponse(BaseModel):
    results: list[CatalogValidateItemResponse]


class CatalogPublishBatchRequest(BaseModel):
    subject_id: int
    due_date: date | None = None
