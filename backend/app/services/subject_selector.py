from __future__ import annotations

import random
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

from app.models import CatalogQuestion, StudentQuestionCoverage, Subject


class SubjectSelector(Protocol):
    def select(
        self,
        *,
        subject: Subject,
        candidates: list[CatalogQuestion],
        coverage_map: dict[int, StudentQuestionCoverage],
        weak_topics: list[str],
        limit: int,
        seed: str,
    ) -> list[CatalogQuestion]: ...


@dataclass(frozen=True)
class SelectorWeights:
    unseen_bonus: float = 2.6
    wrong_ratio_bonus: float = 1.8
    low_mastery_bonus: float = 1.2
    recency_bonus: float = 0.8
    weak_topic_bonus: float = 1.0


class DefaultSubjectSelector:
    def __init__(self, *, weights: SelectorWeights | None = None) -> None:
        self._weights = weights or SelectorWeights()

    def select(
        self,
        *,
        subject: Subject,
        candidates: list[CatalogQuestion],
        coverage_map: dict[int, StudentQuestionCoverage],
        weak_topics: list[str],
        limit: int,
        seed: str,
    ) -> list[CatalogQuestion]:
        if limit <= 0:
            return []

        weak_tokens = _normalize_tokens(" ".join(weak_topics))
        rng = random.Random(f"selector::{subject.id}::{seed}")
        now = datetime.now(timezone.utc)

        scored: list[tuple[float, CatalogQuestion]] = []
        for item in candidates:
            coverage = coverage_map.get(int(item.id))
            score = 0.0

            if coverage is None or int(coverage.seen_count or 0) == 0:
                score += self._weights.unseen_bonus

            if coverage is not None:
                solved = max(int(coverage.solved_count or 0), 0)
                wrong = max(int(coverage.wrong_count or 0), 0)
                correct = max(int(coverage.correct_count or 0), 0)

                if solved > 0:
                    wrong_ratio = wrong / solved
                    mastery = correct / solved
                    score += wrong_ratio * self._weights.wrong_ratio_bonus
                    score += max(0.0, (1.0 - mastery)) * self._weights.low_mastery_bonus

                last_seen = coverage.last_seen_at
                if last_seen is not None:
                    days = max(0.0, (now - last_seen).total_seconds() / 86400)
                    # Gradual bump for older questions to re-check retention.
                    score += min(1.0, days / 14.0) * self._weights.recency_bonus

            topic_text = " ".join(str(tag) for tag in (item.topic_tags_json or []))
            if weak_tokens and _token_overlap_ratio(_normalize_tokens(topic_text), weak_tokens) >= 0.2:
                score += self._weights.weak_topic_bonus

            # tiny deterministic jitter for stable tie-breaking
            score += rng.random() * 0.01
            scored.append((score, item))

        scored.sort(key=lambda pair: pair[0], reverse=True)
        selected: list[CatalogQuestion] = []
        seen_hashes: set[str] = set()

        for _, item in scored:
            content_hash = str(item.content_hash or "").strip()
            if content_hash and content_hash in seen_hashes:
                continue
            selected.append(item)
            if content_hash:
                seen_hashes.add(content_hash)
            if len(selected) >= limit:
                break
        return selected


class MathSubjectSelector(DefaultSubjectSelector):
    def __init__(self) -> None:
        super().__init__(weights=SelectorWeights(unseen_bonus=2.8, wrong_ratio_bonus=2.1, low_mastery_bonus=1.4, recency_bonus=0.7, weak_topic_bonus=1.1))


class PhysicsSubjectSelector(DefaultSubjectSelector):
    def __init__(self) -> None:
        super().__init__(weights=SelectorWeights(unseen_bonus=2.7, wrong_ratio_bonus=2.0, low_mastery_bonus=1.3, recency_bonus=0.75, weak_topic_bonus=1.0))


class HistorySubjectSelector(DefaultSubjectSelector):
    def __init__(self) -> None:
        super().__init__(weights=SelectorWeights(unseen_bonus=2.5, wrong_ratio_bonus=1.7, low_mastery_bonus=1.1, recency_bonus=0.9, weak_topic_bonus=1.2))


class LanguageSubjectSelector(DefaultSubjectSelector):
    def __init__(self) -> None:
        super().__init__(weights=SelectorWeights(unseen_bonus=2.4, wrong_ratio_bonus=1.6, low_mastery_bonus=1.0, recency_bonus=0.95, weak_topic_bonus=1.3))


class SubjectSelectorRegistry:
    def __init__(self) -> None:
        self._default = DefaultSubjectSelector()
        self._registry: dict[str, SubjectSelector] = {
            "mathematics": MathSubjectSelector(),
            "physics": PhysicsSubjectSelector(),
            "history": HistorySubjectSelector(),
            "language": LanguageSubjectSelector(),
        }

    def get(self, *, subject: Subject) -> SubjectSelector:
        key = _subject_family_key(subject)
        return self._registry.get(key, self._default)


def _subject_family_key(subject: Subject) -> str:
    text = f"{subject.name_ru} {subject.name_kz}".lower()
    if any(token in text for token in ("матем", "алгеб", "геометр", "mathem")):
        return "mathematics"
    if any(token in text for token in ("физ", "physics")):
        return "physics"
    if any(token in text for token in ("истор", "history", "тарих")):
        return "history"
    if any(token in text for token in ("язык", "тіл", "әдебиет", "литератур", "grammar", "reading")):
        return "language"
    return "default"


def _normalize_tokens(value: str) -> set[str]:
    parts = re.split(r"[^\wа-яәіңғүұқөһ]+", value.lower(), flags=re.IGNORECASE)
    return {part for part in parts if len(part) >= 3}


def _token_overlap_ratio(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    intersection = left.intersection(right)
    return len(intersection) / max(len(left), len(right))


subject_selector_registry = SubjectSelectorRegistry()
