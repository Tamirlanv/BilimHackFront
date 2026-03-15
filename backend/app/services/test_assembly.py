from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
import re
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Answer,
    AttemptQuestionEvent,
    CatalogQuestion,
    DifficultyLevel,
    PreferredLanguage,
    Question,
    QuestionType,
    StudentQuestionCoverage,
    Subject,
    Test,
    TestMode,
    TestSession,
    User,
)
from app.services.question_catalog import question_catalog_service
from app.services.subject_selector import subject_selector_registry


class TestAssemblyService:
    def assemble_from_catalog(
        self,
        *,
        db: Session,
        student: User,
        subject: Subject,
        difficulty: DifficultyLevel,
        language: PreferredLanguage,
        mode: TestMode,
        num_questions: int,
        time_limit_minutes: int | None,
        warning_limit: int,
    ) -> Test:
        if num_questions <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Количество вопросов должно быть больше 0")

        question_catalog_service.ensure_subject_catalog_ready(db=db, subject=subject)
        candidates = self._collect_candidates(
            db=db,
            subject=subject,
            difficulty=difficulty,
            language=language,
            mode=mode,
            min_required=num_questions,
        )
        if not candidates:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "INSUFFICIENT_QUESTION_POOL",
                    "message": "Для этого предмета пока нет опубликованных вопросов в банке.",
                },
            )
        candidates = self._exclude_recently_answered_candidates(
            db=db,
            student_id=student.id,
            candidates=candidates,
            lookback_days=14,
        )
        if len(candidates) < num_questions:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "INSUFFICIENT_QUESTION_POOL",
                    "message": (
                        "Недостаточно уникальных вопросов с учетом недавних попыток. "
                        f"Доступно {len(candidates)} из {num_questions}."
                    ),
                },
            )

        coverage_map = self._load_coverage_map(db=db, student_id=student.id, candidates=candidates)
        weak_topics = self._collect_weak_topics_from_attempts(db=db, student_id=student.id, subject_id=subject.id)
        strong_topics = self._collect_strong_topics_from_attempts(
            db=db,
            student_id=student.id,
            subject_id=subject.id,
        )

        selector = subject_selector_registry.get(subject=subject)
        ranked_candidates = selector.select(
            subject=subject,
            candidates=candidates,
            coverage_map=coverage_map,
            weak_topics=weak_topics,
            limit=len(candidates),
            seed=f"{student.id}:{subject.id}:{difficulty.value}:{language.value}:{mode.value}:{num_questions}",
        )
        selected = self._select_with_quota(
            ranked_candidates=ranked_candidates,
            coverage_map=coverage_map,
            weak_topics=weak_topics,
            strong_topics=strong_topics,
            limit=num_questions,
        )

        if len(selected) < num_questions:
            selected_ids = {item.id for item in selected}
            selected_hashes = {
                _question_fingerprint(item)
                for item in selected
                if _question_fingerprint(item)
            }
            for item in candidates:
                if item.id in selected_ids:
                    continue
                item_hash = _question_fingerprint(item)
                if item_hash and item_hash in selected_hashes:
                    continue
                selected.append(item)
                selected_ids.add(item.id)
                if item_hash:
                    selected_hashes.add(item_hash)
                if len(selected) >= num_questions:
                    break

        if len(selected) < num_questions:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "INSUFFICIENT_QUESTION_POOL",
                    "message": (
                        f"Недостаточно валидированных вопросов в банке: "
                        f"доступно {len(selected)} из {num_questions}."
                    ),
                },
            )

        now = datetime.now(timezone.utc)
        test = Test(
            student_id=student.id,
            subject_id=subject.id,
            difficulty=difficulty,
            language=language,
            mode=mode,
        )
        db.add(test)
        db.flush()

        session = TestSession(
            test_id=test.id,
            time_limit_seconds=(int(time_limit_minutes) * 60) if time_limit_minutes else None,
            warning_limit=max(0, int(warning_limit)),
            pipeline_version="unified_v1",
            started_at=now,
            elapsed_seconds=0,
            warning_count=0,
            warning_events_json=[],
        )
        db.add(session)

        for catalog_item in selected[:num_questions]:
            question = Question(
                test_id=test.id,
                type=QuestionType(str(catalog_item.type.value)),
                prompt=str(catalog_item.prompt or "").strip(),
                options_json=dict(catalog_item.options_json) if catalog_item.options_json else None,
                correct_answer_json=dict(catalog_item.correct_answer_json or {}),
                explanation_json=self._build_explanation_json(catalog_item),
                tts_text=str(catalog_item.prompt or "").strip(),
            )
            db.add(question)

        self._mark_seen_in_coverage(
            db=db,
            student_id=student.id,
            selected=selected[:num_questions],
            existing_coverage=coverage_map,
            now=now,
        )

        db.commit()
        db.refresh(test)
        return test

    def _collect_candidates(
        self,
        *,
        db: Session,
        subject: Subject,
        difficulty: DifficultyLevel,
        language: PreferredLanguage,
        mode: TestMode,
        min_required: int,
    ) -> list[CatalogQuestion]:
        output: list[CatalogQuestion] = []
        seen_ids: set[int] = set()
        rows = question_catalog_service.get_published_candidates(
            db=db,
            subject_id=subject.id,
            difficulty=difficulty,
            language=language,
            mode=mode,
            limit=max(200, min_required * 12),
            allow_mode_fallback=False,
        )
        for row in rows:
            if row.id in seen_ids:
                continue
            seen_ids.add(row.id)
            output.append(row)
        return output

    def _build_explanation_json(self, catalog_item: CatalogQuestion) -> dict[str, Any]:
        explanation = dict(catalog_item.explanation_json or {})
        if not explanation.get("topic"):
            topic_tags = [str(item).strip() for item in (catalog_item.topic_tags_json or []) if str(item).strip()]
            explanation["topic"] = topic_tags[0] if topic_tags else "General"
        explanation["catalog_question_id"] = int(catalog_item.id)
        explanation["catalog_content_hash"] = str(catalog_item.content_hash)
        explanation["catalog_source"] = str(catalog_item.source)
        return explanation

    def _load_coverage_map(
        self,
        *,
        db: Session,
        student_id: int,
        candidates: list[CatalogQuestion],
    ) -> dict[int, StudentQuestionCoverage]:
        candidate_ids = [int(item.id) for item in candidates]
        if not candidate_ids:
            return {}

        rows = db.scalars(
            select(StudentQuestionCoverage).where(
                StudentQuestionCoverage.student_id == student_id,
                StudentQuestionCoverage.catalog_question_id.in_(candidate_ids),
            )
        ).all()
        return {int(row.catalog_question_id): row for row in rows}

    def _mark_seen_in_coverage(
        self,
        *,
        db: Session,
        student_id: int,
        selected: list[CatalogQuestion],
        existing_coverage: dict[int, StudentQuestionCoverage],
        now: datetime,
    ) -> None:
        for item in selected:
            catalog_question_id = int(item.id)
            row = existing_coverage.get(catalog_question_id)
            if row is None:
                row = StudentQuestionCoverage(
                    student_id=student_id,
                    catalog_question_id=catalog_question_id,
                    seen_count=1,
                    solved_count=0,
                    correct_count=0,
                    wrong_count=0,
                    last_seen_at=now,
                )
                db.add(row)
                existing_coverage[catalog_question_id] = row
            else:
                row.seen_count = int(row.seen_count or 0) + 1
                row.last_seen_at = now

    def _exclude_recently_answered_candidates(
        self,
        *,
        db: Session,
        student_id: int,
        candidates: list[CatalogQuestion],
        lookback_days: int,
    ) -> list[CatalogQuestion]:
        if not candidates:
            return []

        candidate_ids = [int(item.id) for item in candidates]
        candidate_hashes = {
            str(item.content_hash or "").strip().lower()
            for item in candidates
            if str(item.content_hash or "").strip()
        }
        lookback_from = datetime.now(timezone.utc) - timedelta(days=max(1, int(lookback_days)))
        recent_ids = db.scalars(
            select(AttemptQuestionEvent.catalog_question_id)
            .where(
                AttemptQuestionEvent.student_id == student_id,
                AttemptQuestionEvent.catalog_question_id.is_not(None),
                AttemptQuestionEvent.catalog_question_id.in_(candidate_ids),
                AttemptQuestionEvent.created_at >= lookback_from,
            )
            .order_by(AttemptQuestionEvent.created_at.desc())
            .limit(3000)
        ).all()
        recent_set = {int(item) for item in recent_ids if isinstance(item, int)}
        recent_hash_set: set[str] = set()
        if candidate_hashes:
            recent_hashes = db.scalars(
                select(CatalogQuestion.content_hash)
                .join(AttemptQuestionEvent, AttemptQuestionEvent.catalog_question_id == CatalogQuestion.id)
                .where(
                    AttemptQuestionEvent.student_id == student_id,
                    AttemptQuestionEvent.created_at >= lookback_from,
                    CatalogQuestion.content_hash.in_(candidate_hashes),
                )
                .order_by(AttemptQuestionEvent.created_at.desc())
                .limit(3000)
            ).all()
            recent_hash_set = {
                str(item).strip().lower()
                for item in recent_hashes
                if str(item or "").strip()
            }

        if not recent_set and not recent_hash_set:
            return candidates

        filtered = [
            item
            for item in candidates
            if int(item.id) not in recent_set
            and str(item.content_hash or "").strip().lower() not in recent_hash_set
        ]
        return filtered

    def _collect_weak_topics_from_attempts(
        self,
        *,
        db: Session,
        student_id: int,
        subject_id: int,
    ) -> list[str]:
        rows = db.execute(
            select(Question.explanation_json)
            .join(Answer, Answer.question_id == Question.id)
            .join(Test, Test.id == Question.test_id)
            .where(
                Test.student_id == student_id,
                Test.subject_id == subject_id,
                Answer.is_correct.is_(False),
            )
            .order_by(Question.id.desc())
            .limit(400)
        ).all()

        counter: Counter[str] = Counter()
        for (explanation_json,) in rows:
            if not isinstance(explanation_json, dict):
                continue
            topic = str(explanation_json.get("topic", "")).strip()
            if topic:
                counter[topic] += 1

        return [topic for topic, _ in counter.most_common(6)]

    def _collect_strong_topics_from_attempts(
        self,
        *,
        db: Session,
        student_id: int,
        subject_id: int,
    ) -> list[str]:
        rows = db.execute(
            select(CatalogQuestion.topic_tags_json, AttemptQuestionEvent.is_correct)
            .join(AttemptQuestionEvent, AttemptQuestionEvent.catalog_question_id == CatalogQuestion.id)
            .where(
                AttemptQuestionEvent.student_id == student_id,
                AttemptQuestionEvent.is_correct.is_not(None),
                CatalogQuestion.subject_id == subject_id,
            )
            .order_by(AttemptQuestionEvent.created_at.desc())
            .limit(1200)
        ).all()

        topic_total: Counter[str] = Counter()
        topic_correct: Counter[str] = Counter()
        for topic_tags_json, is_correct in rows:
            topic = ""
            if isinstance(topic_tags_json, list):
                for raw_topic in topic_tags_json:
                    value = str(raw_topic).strip()
                    if value:
                        topic = value
                        break
            if not topic:
                continue
            topic_key = re.sub(r"\s+", " ", topic.lower()).strip()
            if not topic_key:
                continue
            topic_total[topic_key] += 1
            if bool(is_correct):
                topic_correct[topic_key] += 1

        scored: list[tuple[str, float, int]] = []
        for topic_key, total in topic_total.items():
            if total < 3:
                continue
            accuracy = topic_correct[topic_key] / total
            if accuracy >= 0.8:
                scored.append((topic_key, accuracy, total))

        scored.sort(key=lambda item: (item[1], item[2]), reverse=True)
        return [topic_key for topic_key, _, _ in scored[:10]]

    def _select_with_quota(
        self,
        *,
        ranked_candidates: list[CatalogQuestion],
        coverage_map: dict[int, StudentQuestionCoverage],
        weak_topics: list[str],
        strong_topics: list[str],
        limit: int,
    ) -> list[CatalogQuestion]:
        if limit <= 0:
            return []

        target_unseen = max(0, round(limit * 0.5))
        target_weak = max(0, round(limit * 0.3))
        target_strong = max(0, round(limit * 0.1))
        target_reinforcement = max(0, limit - target_unseen - target_weak - target_strong)

        unseen_pool: list[CatalogQuestion] = []
        weak_pool: list[CatalogQuestion] = []
        reinforcement_pool: list[CatalogQuestion] = []
        strong_pool: list[CatalogQuestion] = []

        weak_tokens = _tokenize(" ".join(weak_topics))
        strong_topic_keys = {
            re.sub(r"\s+", " ", str(topic).lower()).strip()
            for topic in strong_topics
            if str(topic).strip()
        }
        for item in ranked_candidates:
            coverage = coverage_map.get(int(item.id))
            candidate_topic = _primary_topic_key(item)
            is_strong_topic = candidate_topic in strong_topic_keys
            is_unseen = coverage is None or int(coverage.seen_count or 0) == 0
            if is_unseen:
                if is_strong_topic:
                    strong_pool.append(item)
                    continue
                unseen_pool.append(item)
                continue

            if self._is_weak_candidate(item=item, coverage=coverage, weak_tokens=weak_tokens):
                weak_pool.append(item)
                continue

            if self._is_strong_candidate(
                item=item,
                coverage=coverage,
                weak_tokens=weak_tokens,
                is_strong_topic=is_strong_topic,
            ):
                strong_pool.append(item)
                continue

            reinforcement_pool.append(item)

        unseen_pool = self._interleave_by_topic(unseen_pool)
        weak_pool = self._interleave_by_topic(weak_pool)
        reinforcement_pool = self._interleave_by_topic(reinforcement_pool)
        strong_pool = self._interleave_by_topic(strong_pool)
        strong_ids = {int(item.id) for item in strong_pool}

        available_topics_count = len({_primary_topic_key(item) for item in ranked_candidates})
        max_per_topic = self._max_per_topic(limit=limit, available_topics_count=available_topics_count)
        strong_topic_max = max(1, min(max_per_topic, round(limit * 0.2)))

        selected: list[CatalogQuestion] = []
        seen_hashes: set[str] = set()
        seen_ids: set[int] = set()
        selected_topics_counter: Counter[str] = Counter()

        def _take(pool: list[CatalogQuestion], amount: int, *, enforce_topic_caps: bool) -> int:
            nonlocal selected
            if amount <= 0:
                return 0
            left_to_take = amount
            for candidate in pool:
                if len(selected) >= limit or left_to_take <= 0:
                    break
                candidate_id = int(candidate.id)
                if candidate_id in seen_ids:
                    continue
                candidate_hash = _question_fingerprint(candidate)
                if candidate_hash and candidate_hash in seen_hashes:
                    continue
                candidate_topic = _primary_topic_key(candidate)
                if enforce_topic_caps and available_topics_count > 1:
                    if selected_topics_counter[candidate_topic] >= max_per_topic:
                        continue
                    if int(candidate.id) in strong_ids and selected_topics_counter[candidate_topic] >= strong_topic_max:
                        continue
                selected.append(candidate)
                seen_ids.add(candidate_id)
                selected_topics_counter[candidate_topic] += 1
                if candidate_hash:
                    seen_hashes.add(candidate_hash)
                left_to_take -= 1
            return left_to_take

        remaining = _take(unseen_pool, target_unseen, enforce_topic_caps=True)
        if remaining > 0:
            _take(unseen_pool, remaining, enforce_topic_caps=False)
        remaining = _take(weak_pool, target_weak, enforce_topic_caps=True)
        if remaining > 0:
            _take(weak_pool, remaining, enforce_topic_caps=False)
        remaining = _take(reinforcement_pool, target_reinforcement, enforce_topic_caps=True)
        if remaining > 0:
            _take(reinforcement_pool, remaining, enforce_topic_caps=False)
        remaining = _take(strong_pool, target_strong, enforce_topic_caps=True)
        if remaining > 0:
            _take(strong_pool, remaining, enforce_topic_caps=False)

        if len(selected) < limit:
            leftovers = [*unseen_pool, *weak_pool, *reinforcement_pool, *strong_pool]
            _take(leftovers, limit - len(selected), enforce_topic_caps=False)

        return selected

    def _is_weak_candidate(
        self,
        *,
        item: CatalogQuestion,
        coverage: StudentQuestionCoverage,
        weak_tokens: set[str],
    ) -> bool:
        wrong_count = int(coverage.wrong_count or 0)
        solved_count = int(coverage.solved_count or 0)
        if wrong_count <= 0:
            return False

        if solved_count > 0 and (wrong_count / solved_count) >= 0.4:
            return True

        if not weak_tokens:
            return False
        topic_tokens = _tokenize(" ".join(str(tag) for tag in (item.topic_tags_json or [])))
        if not topic_tokens:
            return False
        overlap = topic_tokens.intersection(weak_tokens)
        return len(overlap) > 0

    def _is_strong_candidate(
        self,
        *,
        item: CatalogQuestion,
        coverage: StudentQuestionCoverage,
        weak_tokens: set[str],
        is_strong_topic: bool = False,
    ) -> bool:
        if is_strong_topic and not self._topic_overlaps_tokens(item=item, tokens=weak_tokens):
            return True

        solved_count = int(coverage.solved_count or 0)
        correct_count = int(coverage.correct_count or 0)
        if solved_count < 4:
            return False
        mastery = (correct_count / solved_count) if solved_count > 0 else 0.0
        if mastery < 0.8:
            return False
        if not weak_tokens:
            return True
        return not self._topic_overlaps_tokens(item=item, tokens=weak_tokens)

    def _topic_overlaps_tokens(self, *, item: CatalogQuestion, tokens: set[str]) -> bool:
        if not tokens:
            return False
        topic_tokens = _tokenize(" ".join(str(tag) for tag in (item.topic_tags_json or [])))
        if not topic_tokens:
            topic_tokens = _tokenize(str((item.explanation_json or {}).get("topic", "")))
        if not topic_tokens:
            return False
        return len(topic_tokens.intersection(tokens)) > 0

    def _interleave_by_topic(self, pool: list[CatalogQuestion]) -> list[CatalogQuestion]:
        if len(pool) <= 2:
            return list(pool)

        by_topic: dict[str, list[CatalogQuestion]] = {}
        topic_order: list[str] = []
        for item in pool:
            topic = _primary_topic_key(item)
            if topic not in by_topic:
                by_topic[topic] = []
                topic_order.append(topic)
            by_topic[topic].append(item)

        if len(topic_order) <= 1:
            return list(pool)

        result: list[CatalogQuestion] = []
        has_items = True
        while has_items:
            has_items = False
            for topic in topic_order:
                bucket = by_topic.get(topic) or []
                if not bucket:
                    continue
                has_items = True
                result.append(bucket.pop(0))
        return result

    def _max_per_topic(self, *, limit: int, available_topics_count: int) -> int:
        if limit <= 0:
            return 0
        if available_topics_count <= 1:
            return limit
        capped_topics = min(max(2, available_topics_count), 4)
        # 10 вопросов при 4+ темах -> максимум 3 вопроса на одну тему.
        return max(2, (limit + capped_topics - 1) // capped_topics)


def _tokenize(value: str) -> set[str]:
    parts = re.split(r"[^\wа-яәіңғүұқөһ]+", str(value or "").lower(), flags=re.IGNORECASE)
    return {part for part in parts if len(part) >= 3}


def _question_fingerprint(question: CatalogQuestion) -> str:
    content_hash = str(question.content_hash or "").strip().lower()
    if content_hash:
        return f"ch::{content_hash}"

    prompt_key = re.sub(r"\s+", " ", str(question.prompt or "").strip().lower())
    prompt_key = re.sub(r"^\s*вопрос\s*\d+\s*[:.\-]\s*", "", prompt_key).strip()
    prompt_key = re.sub(r"^\s*\d+\s*[-.)]\s*", "", prompt_key).strip()
    prompt_key = re.sub(r"[.!?…]+$", "", prompt_key).strip()
    if prompt_key:
        return f"pr::{prompt_key}"
    return f"id::{int(question.id)}"


def _primary_topic_key(question: CatalogQuestion) -> str:
    tags = [str(item).strip() for item in (question.topic_tags_json or []) if str(item).strip()]
    if tags:
        return re.sub(r"\s+", " ", tags[0].strip().lower())
    explanation_topic = str((question.explanation_json or {}).get("topic", "")).strip()
    if explanation_topic:
        return re.sub(r"\s+", " ", explanation_topic.lower())
    return "general"


def extract_catalog_question_id(question: Question) -> int | None:
    explanation_json = question.explanation_json or {}
    raw_id = explanation_json.get("catalog_question_id")
    if isinstance(raw_id, int):
        return raw_id
    if isinstance(raw_id, str) and raw_id.isdigit():
        return int(raw_id)
    return None


test_assembly_service = TestAssemblyService()
