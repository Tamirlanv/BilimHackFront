"use client";

import { PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Button from "@/components/ui/Button";
import {
  BLITZ_LAST_RESULT_KEY,
  BLITZ_QUESTION_TIME_LIMIT_SECONDS,
  BLITZ_SESSION_SIZE,
  BlitzAnswerRecord,
  BlitzQuestion,
  appendBlitzResultToHistory,
  buildBlitzResultPayload,
  createBlitzQuestionSet,
} from "@/lib/blitz";
import { assetPaths } from "@/src/assets";
import styles from "@/app/blitz/blitz.module.css";

type AnswerSource = "button" | "swipe" | "timeout";
type ExitDirection = -1 | 0 | 1;

const SWIPE_THRESHOLD_PX = 90;

export default function BlitzPage() {
  const router = useRouter();

  const [questions] = useState<BlitzQuestion[]>(() => createBlitzQuestionSet(BLITZ_SESSION_SIZE));
  const [answers, setAnswers] = useState<BlitzAnswerRecord[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(BLITZ_QUESTION_TIME_LIMIT_SECONDS);
  const [isStarted, setIsStarted] = useState(false);

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [exitDirection, setExitDirection] = useState<ExitDirection>(0);

  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);

  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);

  const pointerStartX = useRef<number | null>(null);
  const questionStartedAt = useRef(Date.now());
  const timeoutHandled = useRef(false);

  const question = questions[activeIndex] ?? null;

  const timerProgressPercent = useMemo(() => {
    return Math.round((secondsLeft / BLITZ_QUESTION_TIME_LIMIT_SECONDS) * 100);
  }, [secondsLeft]);

  useEffect(() => {
    try {
      sessionStorage.removeItem(BLITZ_LAST_RESULT_KEY);
    } catch {
      // ignore
    }
  }, []);

  const finishBlitz = useCallback(
    (nextAnswers: BlitzAnswerRecord[]) => {
      const startedAt = sessionStartedAt ?? Date.now();
      const totalElapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const payload = buildBlitzResultPayload(nextAnswers, totalElapsedSeconds);
      try {
        sessionStorage.setItem(BLITZ_LAST_RESULT_KEY, JSON.stringify(payload));
        appendBlitzResultToHistory(payload);
      } catch {
        // ignore storage errors
      }
      router.push("/blitz/result");
    },
    [router, sessionStartedAt],
  );

  const submitAnswer = useCallback(
    (value: boolean | null, source: AnswerSource) => {
      if (!question || isTransitioning) return;

      const elapsedSeconds = Math.min(
        BLITZ_QUESTION_TIME_LIMIT_SECONDS,
        Math.max(0, Math.round((Date.now() - questionStartedAt.current) / 1000)),
      );

      const nextAnswer: BlitzAnswerRecord = {
        questionId: question.id,
        prompt: question.prompt,
        topic: question.topic,
        correctAnswer: question.answer,
        userAnswer: value,
        isCorrect: value !== null && value === question.answer,
        timedOut: source === "timeout",
        elapsedSeconds,
      };

      const nextAnswers = [...answers, nextAnswer];

      setAnswers(nextAnswers);
      setIsDragging(false);
      setDragX(0);
      pointerStartX.current = null;

      setIsTransitioning(true);
      if (source === "timeout" || value === null) {
        setExitDirection(0);
      } else {
        setExitDirection(value ? 1 : -1);
      }

      window.setTimeout(() => {
        const nextIndex = activeIndex + 1;

        if (nextIndex >= questions.length) {
          finishBlitz(nextAnswers);
          return;
        }

        setActiveIndex(nextIndex);
        setIsTransitioning(false);
        setExitDirection(0);
      }, 240);
    },
    [activeIndex, answers, finishBlitz, isTransitioning, question, questions.length],
  );

  useEffect(() => {
    if (!isStarted || !question || isTransitioning) return;

    questionStartedAt.current = Date.now();
    timeoutHandled.current = false;
    setSecondsLeft(BLITZ_QUESTION_TIME_LIMIT_SECONDS);

    const timerId = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - questionStartedAt.current) / 1000);
      const nextSeconds = Math.max(BLITZ_QUESTION_TIME_LIMIT_SECONDS - elapsed, 0);
      setSecondsLeft(nextSeconds);

      if (nextSeconds === 0 && !timeoutHandled.current) {
        timeoutHandled.current = true;
        submitAnswer(null, "timeout");
      }
    }, 120);

    return () => {
      window.clearInterval(timerId);
    };
  }, [activeIndex, isStarted, isTransitioning, question, submitAnswer]);

  const finishDrag = useCallback(() => {
    if (!isDragging || isTransitioning) return;

    setIsDragging(false);
    pointerStartX.current = null;

    if (Math.abs(dragX) >= SWIPE_THRESHOLD_PX) {
      submitAnswer(dragX > 0, "swipe");
      return;
    }

    setDragX(0);
  }, [dragX, isDragging, isTransitioning, submitAnswer]);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!isStarted || isTransitioning) return;
    pointerStartX.current = event.clientX;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!isDragging || pointerStartX.current === null || isTransitioning) return;
    const delta = event.clientX - pointerStartX.current;
    const limited = Math.max(-180, Math.min(180, delta));
    setDragX(limited);
  };

  const cardClassName = [
    styles.questionCard,
    isDragging ? styles.questionCardDragging : "",
    isTransitioning && exitDirection < 0 ? styles.questionCardExitLeft : "",
    isTransitioning && exitDirection > 0 ? styles.questionCardExitRight : "",
    isTransitioning && exitDirection === 0 ? styles.questionCardExitFade : "",
  ]
    .filter(Boolean)
    .join(" ");

  const decisionLabel = dragX > 28 ? "ДА" : dragX < -28 ? "НЕТ" : "";
  const decisionClass = dragX > 28 ? styles.decisionYes : dragX < -28 ? styles.decisionNo : "";

  if (!question) {
    return (
      <AuthGuard roles={["student"]}>
        <AppShell>
          <div className={styles.page}>
            <section className={styles.stateCard}>
              <h2 className={styles.stateTitle}>Не удалось запустить блиц</h2>
              <p className={styles.stateText}>Список вопросов пуст. Перезапустите страницу и попробуйте снова.</p>
              <Button onClick={() => router.push("/dashboard")}>На главную</Button>
            </section>
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard roles={["student"]}>
      <AppShell>
        <div className={styles.page}>
          {!isStarted ? (
            <section className={styles.startWrap}>
              <article className={styles.startCard}>
                <h2 className={styles.startTitle}>Вы готовы начать?</h2>
                <p className={styles.startText}>Блиц состоит из 30 вопросов. На каждый вопрос дается 15 секунд.</p>
                <div className={styles.startMeta}>
                  <span>30 вопросов</span>
                  <span>15 секунд на вопрос</span>
                  <span>Формат: Да / Нет</span>
                </div>
                <div className={styles.startActions}>
                  <Button
                    className={styles.startPrimary}
                    onClick={() => {
                      setSessionStartedAt(Date.now());
                      setSecondsLeft(BLITZ_QUESTION_TIME_LIMIT_SECONDS);
                      setIsStarted(true);
                    }}
                  >
                    Начать блиц
                  </Button>
                  <button className={styles.startCancel} type="button" onClick={() => router.push("/dashboard")}>
                    Отмена
                  </button>
                </div>
              </article>
            </section>
          ) : (
            <>
              <header className={styles.header}>
                <h2 className={styles.title}>Блиц</h2>
                <p className={styles.subtitle}>Устрой быстрый тест своим знаниям</p>
              </header>

              <section className={styles.progressSection}>
                <div className={styles.timerRow}>
                  <img className={styles.timerIcon} src={assetPaths.icons.blitz} alt="Таймер" />
                  <p className={styles.timerValue}>{formatTimer(secondsLeft)}</p>
                </div>
                <div className={styles.progressBar}>
                  <span style={{ width: `${timerProgressPercent}%` }} />
                </div>
                <p className={styles.counterText}>{activeIndex + 1} из {questions.length}</p>
              </section>

              <section className={styles.blitzArea}>
                <Button
                  className={`${styles.sideButton} ${styles.sideButtonNo}`}
                  variant="primary"
                  onClick={() => submitAnswer(false, "button")}
                  disabled={isTransitioning}
                >
                  Нет
                </Button>

                <div className={styles.stack}>
                  <div className={`${styles.stackShadow} ${styles.stackShadowBack}`} aria-hidden="true" />
                  <div className={`${styles.stackShadow} ${styles.stackShadowMid}`} aria-hidden="true" />

                  <article
                    className={cardClassName}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                    onLostPointerCapture={finishDrag}
                    style={!isTransitioning ? { transform: `translateX(${dragX}px) rotate(${dragX / 24}deg)` } : undefined}
                  >
                    {decisionLabel ? <span className={`${styles.decisionBadge} ${decisionClass}`}>{decisionLabel}</span> : null}
                    <p className={styles.topic}>{question.topic}</p>
                    <p className={styles.prompt}>{question.prompt}</p>
                    <p className={styles.cardHint}>На мобильном можно отвечать свайпом влево/вправо.</p>
                  </article>
                </div>

                <Button
                  className={`${styles.sideButton} ${styles.sideButtonYes}`}
                  variant="primary"
                  onClick={() => submitAnswer(true, "button")}
                  disabled={isTransitioning}
                >
                  Да
                </Button>
              </section>
            </>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function formatTimer(value: number): string {
  const safe = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
