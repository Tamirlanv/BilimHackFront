from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Answer,
    AttemptQuestionEvent,
    PreferredLanguage,
    Question,
    Recommendation,
    Result,
    StudentQuestionCoverage,
    Test,
    TestSession,
    User,
)
from app.schemas.tests import QuestionFeedback, TestTelemetryPayload, TestWarningSignal
from app.services.evaluation import EvaluationSummary, evaluate_answers
from app.services.recommendation_service import RecommendationFacts, recommendation_service
from app.services.test_assembly import extract_catalog_question_id


@dataclass(frozen=True)
class RuntimeAnswerOutcome:
    question_id: int
    is_correct: bool
    score: float
    answered_count: int
    total_questions: int
    warning_count: int


@dataclass(frozen=True)
class RuntimeStateOutcome:
    test: Test
    submitted: bool
    elapsed_seconds: int
    warning_events: list[dict[str, Any]]


@dataclass(frozen=True)
class RuntimeSubmitOutcome:
    test: Test
    evaluation: EvaluationSummary
    warning_events: list[dict[str, Any]]


class AttemptRuntimeService:
    def answer_question(
        self,
        *,
        db: Session,
        student: User,
        test_id: int,
        question_id: int,
        student_answer_json: dict[str, Any],
        latency_ms: int | None,
    ) -> RuntimeAnswerOutcome:
        test = self._load_student_test(db=db, student_id=student.id, test_id=test_id)
        if test.result is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Тест уже завершён.")

        question = next((item for item in test.questions if int(item.id) == int(question_id)), None)
        if question is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вопрос не найден")

        evaluation = evaluate_answers([question], {question.id: dict(student_answer_json or {})})
        feedback = evaluation.feedback[0]

        answer = db.scalar(select(Answer).where(Answer.question_id == question.id))
        if answer is None:
            answer = Answer(
                question_id=question.id,
                student_answer_json=dict(student_answer_json or {}),
                is_correct=feedback.is_correct,
                score=feedback.score,
            )
            db.add(answer)
        else:
            answer.student_answer_json = dict(student_answer_json or {})
            answer.is_correct = feedback.is_correct
            answer.score = feedback.score

        session = test.session or TestSession(test_id=test.id, pipeline_version="unified_v1", started_at=test.created_at)
        if test.session is None:
            db.add(session)
        now = datetime.now(timezone.utc)
        session.elapsed_seconds = max(
            int(session.elapsed_seconds or 0),
            int(max(0, (now - session.started_at).total_seconds())),
        )

        db.add(
            AttemptQuestionEvent(
                test_id=test.id,
                question_id=question.id,
                catalog_question_id=extract_catalog_question_id(question),
                student_id=student.id,
                event_type="answered",
                student_answer_json=dict(student_answer_json or {}),
                is_correct=feedback.is_correct,
                score=float(feedback.score),
                latency_ms=int(latency_ms) if latency_ms is not None else None,
                warning_count_snapshot=int(session.warning_count or 0),
            )
        )

        db.commit()

        answered_count = int(
            db.scalar(
                select(func.count(Answer.id))
                .join(Question, Question.id == Answer.question_id)
                .where(Question.test_id == test.id)
            )
            or 0
        )

        return RuntimeAnswerOutcome(
            question_id=question.id,
            is_correct=feedback.is_correct,
            score=round(float(feedback.score), 2),
            answered_count=answered_count,
            total_questions=len(test.questions),
            warning_count=int(session.warning_count or 0),
        )

    def get_state(
        self,
        *,
        db: Session,
        student: User,
        test_id: int,
    ) -> RuntimeStateOutcome:
        test = self._load_student_test(db=db, student_id=student.id, test_id=test_id)
        session = test.session or TestSession(test_id=test.id, pipeline_version="unified_v1", started_at=test.created_at)
        if test.session is None:
            db.add(session)
            db.commit()
            db.refresh(test)
            session = test.session or session

        submitted = bool(test.result is not None or session.submitted_at is not None)
        now = datetime.now(timezone.utc)
        if submitted:
            submitted_at = session.submitted_at or now
            calculated_elapsed = int(max(0, (submitted_at - session.started_at).total_seconds()))
            elapsed_seconds = max(int(session.elapsed_seconds or 0), calculated_elapsed)
        else:
            elapsed_seconds = max(
                int(session.elapsed_seconds or 0),
                int(max(0, (now - session.started_at).total_seconds())),
            )

        warning_events = self._normalize_warning_events_json(session.warning_events_json or [])
        return RuntimeStateOutcome(
            test=test,
            submitted=submitted,
            elapsed_seconds=elapsed_seconds,
            warning_events=warning_events,
        )

    def submit_test(
        self,
        *,
        db: Session,
        student: User,
        test_id: int,
        answers: list[dict[str, Any]],
        telemetry: TestTelemetryPayload | None,
    ) -> RuntimeSubmitOutcome:
        test = self._load_student_test(db=db, student_id=student.id, test_id=test_id)
        session = test.session or TestSession(test_id=test.id, pipeline_version="unified_v1", started_at=test.created_at)
        if test.session is None:
            db.add(session)

        if test.result is not None:
            warning_events = self._normalize_warning_events_json(session.warning_events_json or [])
            persisted_feedback, _ = self._build_feedback_from_answers(test)
            evaluation = EvaluationSummary(
                total_score=float(test.result.total_score),
                max_score=float(test.result.max_score),
                feedback=persisted_feedback,
                weak_topics=list(test.recommendation.weak_topics_json if test.recommendation else []),
            )
            return RuntimeSubmitOutcome(test=test, evaluation=evaluation, warning_events=warning_events)

        answers_map = {
            int(item.get("question_id")): dict(item.get("student_answer_json") or {})
            for item in answers
            if isinstance(item.get("question_id"), int)
        }

        # Keep already saved step-by-step answers if they are not in the submit payload.
        persisted_answers = db.scalars(
            select(Answer)
            .join(Question, Question.id == Answer.question_id)
            .where(Question.test_id == test.id)
        ).all()
        for persisted in persisted_answers:
            if int(persisted.question_id) in answers_map:
                continue
            answers_map[int(persisted.question_id)] = dict(persisted.student_answer_json or {})

        evaluation = evaluate_answers(test.questions, answers_map)

        feedback_map = {item.question_id: item for item in evaluation.feedback}
        existing_answers = {item.question_id: item for item in persisted_answers}
        for question in test.questions:
            feedback = feedback_map.get(question.id)
            if feedback is None:
                continue
            existing = existing_answers.get(question.id)
            if existing is None:
                existing = Answer(question_id=question.id)
                db.add(existing)
            existing.student_answer_json = dict(answers_map.get(question.id, {}))
            existing.is_correct = bool(feedback.is_correct)
            existing.score = float(feedback.score)

            db.add(
                AttemptQuestionEvent(
                    test_id=test.id,
                    question_id=question.id,
                    catalog_question_id=extract_catalog_question_id(question),
                    student_id=student.id,
                    event_type="submitted_answer",
                    student_answer_json=dict(answers_map.get(question.id, {})),
                    is_correct=feedback.is_correct,
                    score=float(feedback.score),
                    latency_ms=None,
                    warning_count_snapshot=int(session.warning_count or 0),
                )
            )

        now = datetime.now(timezone.utc)
        elapsed_from_telemetry = None
        if telemetry is not None and telemetry.elapsed_seconds is not None:
            elapsed_from_telemetry = int(max(0, telemetry.elapsed_seconds))

        calculated_elapsed = int(max(0, (now - session.started_at).total_seconds()))
        session.elapsed_seconds = max(int(session.elapsed_seconds or 0), elapsed_from_telemetry or 0, calculated_elapsed)

        merged_warnings = self._merge_warning_events(
            session.warning_events_json or [],
            list(telemetry.warnings) if telemetry else [],
            elapsed_seconds=session.elapsed_seconds,
            time_limit_seconds=session.time_limit_seconds,
        )
        session.warning_events_json = merged_warnings
        session.warning_count = len(merged_warnings)
        session.submitted_at = now

        total_score_value, max_score_value = self._resolve_result_scores(
            evaluation=evaluation,
            session=session,
        )
        percent = round((total_score_value / max_score_value) * 100, 2) if max_score_value else 0.0
        result = Result(
            test_id=test.id,
            total_score=total_score_value,
            max_score=max_score_value,
            percent=percent,
        )
        db.add(result)

        facts = RecommendationFacts(
            percent=percent,
            warning_count=int(session.warning_count or 0),
            weak_topics=list(evaluation.weak_topics),
        )
        recommendation_payloads, weak_topics = recommendation_service.build_bilingual(
            subject=test.subject,
            facts=facts,
        )
        selected_payload = recommendation_payloads[test.language]
        ru_payload = recommendation_payloads[PreferredLanguage.ru]
        kz_payload = recommendation_payloads[PreferredLanguage.kz]
        recommendation = Recommendation(
            test_id=test.id,
            weak_topics_json=list(weak_topics),
            advice_text=selected_payload.advice_text,
            advice_text_ru=ru_payload.advice_text,
            advice_text_kz=kz_payload.advice_text,
            generated_tasks_json=list(selected_payload.generated_tasks),
            generated_tasks_ru_json=list(ru_payload.generated_tasks),
            generated_tasks_kz_json=list(kz_payload.generated_tasks),
        )
        db.add(recommendation)

        self._update_coverage_after_submit(
            db=db,
            student_id=student.id,
            feedback=evaluation.feedback,
            questions=test.questions,
            now=now,
        )

        db.commit()
        db.refresh(test)
        return RuntimeSubmitOutcome(
            test=test,
            evaluation=evaluation,
            warning_events=merged_warnings,
        )

    def _resolve_result_scores(
        self,
        *,
        evaluation: EvaluationSummary,
        session: TestSession,
    ) -> tuple[float, float]:
        total_score = round(float(evaluation.total_score), 2)
        max_score = round(float(evaluation.max_score), 2)

        exam_kind = str(session.exam_kind or "").strip().lower()
        if exam_kind != "ent":
            return total_score, max_score

        exam_config = session.exam_config_json if isinstance(session.exam_config_json, dict) else {}
        raw_target_max = exam_config.get("max_score", 140)
        try:
            target_max_score = float(raw_target_max)
        except (TypeError, ValueError):
            target_max_score = 140.0

        if target_max_score <= 0 or max_score <= 0:
            return total_score, max_score

        scaled_total = round((total_score / max_score) * target_max_score, 2)
        return scaled_total, target_max_score

    def _update_coverage_after_submit(
        self,
        *,
        db: Session,
        student_id: int,
        feedback: list[QuestionFeedback],
        questions: list[Question],
        now: datetime,
    ) -> None:
        feedback_map = {item.question_id: item for item in feedback}
        catalog_ids = [
            catalog_id
            for catalog_id in (extract_catalog_question_id(question) for question in questions)
            if catalog_id is not None
        ]
        if not catalog_ids:
            return

        rows = db.scalars(
            select(StudentQuestionCoverage).where(
                StudentQuestionCoverage.student_id == student_id,
                StudentQuestionCoverage.catalog_question_id.in_(catalog_ids),
            )
        ).all()
        coverage_map = {int(row.catalog_question_id): row for row in rows}

        for question in questions:
            catalog_id = extract_catalog_question_id(question)
            if catalog_id is None:
                continue
            item_feedback = feedback_map.get(question.id)
            if item_feedback is None:
                continue

            coverage = coverage_map.get(catalog_id)
            if coverage is None:
                coverage = StudentQuestionCoverage(
                    student_id=student_id,
                    catalog_question_id=catalog_id,
                    seen_count=1,
                    solved_count=0,
                    correct_count=0,
                    wrong_count=0,
                )
                db.add(coverage)
                coverage_map[catalog_id] = coverage

            coverage.solved_count = int(coverage.solved_count or 0) + 1
            coverage.last_answered_at = now
            coverage.last_seen_at = coverage.last_seen_at or now
            if item_feedback.is_correct:
                coverage.correct_count = int(coverage.correct_count or 0) + 1
                coverage.last_correct_at = now
            else:
                coverage.wrong_count = int(coverage.wrong_count or 0) + 1

    def _build_feedback_from_answers(self, test: Test) -> tuple[list[QuestionFeedback], list[str]]:
        feedback: list[QuestionFeedback] = []
        weak_topics: list[str] = []
        seen_topics: dict[str, int] = {}

        for question in sorted(test.questions, key=lambda item: item.id):
            related_answers = [item for item in question.answers if item.question_id == question.id]
            answer = max(related_answers, key=lambda item: item.id) if related_answers else None
            topic = str((question.explanation_json or {}).get("topic", "General"))
            if answer is not None and not answer.is_correct:
                seen_topics[topic] = seen_topics.get(topic, 0) + 1

            feedback.append(
                QuestionFeedback(
                    question_id=question.id,
                    prompt=question.prompt,
                    topic=topic,
                    student_answer=dict(answer.student_answer_json or {}) if answer else {},
                    expected_hint=self._expected_hint(question),
                    is_correct=bool(answer.is_correct) if answer else False,
                    score=float(answer.score) if answer else 0.0,
                    explanation=str((question.explanation_json or {}).get("correct_explanation", "")),
                )
            )

        weak_topics = [topic for topic, _ in sorted(seen_topics.items(), key=lambda pair: pair[1], reverse=True)[:3]]
        return feedback, weak_topics

    def _expected_hint(self, question: Question) -> dict[str, Any]:
        if question.type.value in {"single_choice", "multi_choice"}:
            return {"correct_option_ids": (question.correct_answer_json or {}).get("correct_option_ids", [])}
        return {
            "sample_answer": (question.correct_answer_json or {}).get("sample_answer", ""),
            "keywords": (question.correct_answer_json or {}).get("keywords", []),
        }

    def _load_student_test(self, *, db: Session, student_id: int, test_id: int) -> Test:
        test = db.scalar(
            select(Test)
            .options(
                joinedload(Test.subject),
                joinedload(Test.session),
                joinedload(Test.result),
                joinedload(Test.recommendation),
                joinedload(Test.questions).joinedload(Question.answers),
            )
            .where(Test.id == test_id, Test.student_id == student_id)
        )
        if test is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")
        return test

    def _merge_warning_events(
        self,
        existing: list[dict[str, Any]],
        incoming_signals: list[TestWarningSignal],
        *,
        elapsed_seconds: int,
        time_limit_seconds: int | None,
    ) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = self._normalize_warning_events_json(existing)
        seen = {
            (
                str(item.get("type", "")).strip().lower(),
                int(item.get("at_seconds", 0) or 0),
                int(item.get("question_id")) if isinstance(item.get("question_id"), int) else None,
            )
            for item in normalized
        }

        for signal in incoming_signals:
            key = (
                str(signal.type).strip().lower(),
                int(max(0, signal.at_seconds)),
                int(signal.question_id) if signal.question_id is not None else None,
            )
            if key in seen:
                continue
            seen.add(key)
            normalized.append(
                {
                    "type": key[0],
                    "at_seconds": key[1],
                    "question_id": key[2],
                    "details": dict(signal.details or {}),
                }
            )

        if time_limit_seconds is not None and elapsed_seconds > int(time_limit_seconds):
            key = ("time_limit_exceeded", int(elapsed_seconds), None)
            if key not in seen:
                normalized.append(
                    {
                        "type": "time_limit_exceeded",
                        "at_seconds": int(elapsed_seconds),
                        "question_id": None,
                        "details": {
                            "limit_seconds": int(time_limit_seconds),
                            "elapsed_seconds": int(elapsed_seconds),
                        },
                    }
                )

        normalized.sort(key=lambda item: int(item.get("at_seconds", 0) or 0))
        return normalized

    def _normalize_warning_events_json(self, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
        output: list[dict[str, Any]] = []
        for item in events:
            if not isinstance(item, dict):
                continue
            event_type = str(item.get("type", "")).strip().lower().replace(" ", "_")
            if not event_type:
                continue
            raw_at_seconds = item.get("at_seconds", 0)
            try:
                at_seconds = int(raw_at_seconds or 0)
            except (TypeError, ValueError):
                at_seconds = 0
            output.append(
                {
                    "type": event_type,
                    "at_seconds": max(0, at_seconds),
                    "question_id": int(item["question_id"]) if isinstance(item.get("question_id"), int) else None,
                    "details": dict(item.get("details") or {}),
                }
            )
        return output


attempt_runtime_service = AttemptRuntimeService()
