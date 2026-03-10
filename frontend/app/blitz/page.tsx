"use client";

import { MouseEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Button from "@/components/ui/Button";
import {
  BLITZ_LAST_RESULT_KEY,
  BLITZ_QUESTION_COUNT_OPTIONS,
  BLITZ_QUESTION_TIME_LIMIT_SECONDS,
  BLITZ_SESSION_SIZE,
  BlitzAnswerRecord,
  BlitzDifficulty,
  BlitzQuestion,
  appendBlitzResultToHistory,
  buildBlitzResultPayload,
  createBlitzQuestionSet,
} from "@/lib/blitz";
import { getUiLanguage, tr, useUiLanguage } from "@/lib/i18n";
import { assetPaths } from "@/src/assets";
import styles from "@/app/blitz/blitz.module.css";

type AnswerSource = "button" | "swipe" | "timeout";
type ExitDirection = -1 | 0 | 1;
type BlitzSettings = { difficulty: BlitzDifficulty; questionCount: number };

const SWIPE_THRESHOLD_PX = 90;
const BLITZ_DIFFICULTY_OPTIONS: BlitzDifficulty[] = ["easy", "medium", "hard"];

export default function BlitzPage() {
  const router = useRouter();
  const uiLanguage = useUiLanguage();
  const t = (ru: string, kz: string) => tr(uiLanguage, ru, kz);

  const [settings, setSettings] = useState<BlitzSettings>({ difficulty: "easy", questionCount: BLITZ_SESSION_SIZE });
  const [pendingSettings, setPendingSettings] = useState<BlitzSettings>(settings);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [questions, setQuestions] = useState<BlitzQuestion[]>(() => createBlitzQuestionSet(BLITZ_SESSION_SIZE, getUiLanguage(), "easy"));
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

  const setWheelSpacer = (row: HTMLElement) => {
    row.style.setProperty("--wheel-spacer", `${Math.max(0, row.clientWidth / 2)}px`);
  };

  const centerChoiceButton = (button: HTMLElement, behavior: ScrollBehavior = "auto") => {
    const row = button.parentElement as HTMLElement | null;
    if (!row) return;
    const rowCenter = row.clientWidth / 2;
    const target = button.offsetLeft + button.offsetWidth / 2 - rowCenter;
    const maxLeft = Math.max(0, row.scrollWidth - row.clientWidth);
    const nextLeft = Math.min(maxLeft, Math.max(0, target));
    row.scrollTo({ left: nextLeft, behavior });
  };

  const handleWheelChoice = <T,>(
    setter: (value: T) => void,
    value: T,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    const button = event.currentTarget;
    setter(value);
    requestAnimationFrame(() => {
      centerChoiceButton(button, "smooth");
    });
  };

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

  useEffect(() => {
    if (!isStarted && !isSettingsModalOpen) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehaviorY;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehaviorY;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehaviorY = "none";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehaviorY = "none";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehaviorY = prevBodyOverscroll;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.documentElement.style.overscrollBehaviorY = prevHtmlOverscroll;
    };
  }, [isSettingsModalOpen, isStarted]);

  useEffect(() => {
    if (!isSettingsModalOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isSettingsModalOpen]);

  useEffect(() => {
    if (!isSettingsModalOpen) return;
    const rows = Array.from(document.querySelectorAll<HTMLElement>(`.${styles.choiceRow}`));

    const alignActive = () => {
      rows.forEach((row) => {
        setWheelSpacer(row);
        const active = row.querySelector<HTMLElement>(`.${styles.choiceButtonActive}`);
        if (active) {
          centerChoiceButton(active, "auto");
        }
      });
    };

    const frameA = requestAnimationFrame(() => {
      requestAnimationFrame(alignActive);
    });

    const onTransitionEnd = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target || !target.classList.contains(styles.choiceButton)) return;
      requestAnimationFrame(alignActive);
    };

    rows.forEach((row) => row.addEventListener("transitionend", onTransitionEnd));
    return () => {
      cancelAnimationFrame(frameA);
      rows.forEach((row) => row.removeEventListener("transitionend", onTransitionEnd));
    };
  }, [isSettingsModalOpen, pendingSettings.difficulty, pendingSettings.questionCount]);

  useEffect(() => {
    if (!isSettingsModalOpen) return;
    const onResize = () => {
      const rows = document.querySelectorAll<HTMLElement>(`.${styles.choiceRow}`);
      rows.forEach((row) => {
        setWheelSpacer(row);
        const active = row.querySelector<HTMLElement>(`.${styles.choiceButtonActive}`);
        if (active) {
          centerChoiceButton(active, "auto");
        }
      });
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [isSettingsModalOpen]);

  const finishBlitz = useCallback(
    (nextAnswers: BlitzAnswerRecord[]) => {
      const startedAt = sessionStartedAt ?? Date.now();
      const totalElapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const payload = buildBlitzResultPayload(nextAnswers, totalElapsedSeconds, uiLanguage);
      try {
        sessionStorage.setItem(BLITZ_LAST_RESULT_KEY, JSON.stringify(payload));
        appendBlitzResultToHistory(payload);
      } catch {
        // ignore storage errors
      }
      router.push("/blitz/result");
    },
    [router, sessionStartedAt, uiLanguage],
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

  const decisionLabel = dragX > 28 ? t("ДА", "ИӘ") : dragX < -28 ? t("НЕТ", "ЖОҚ") : "";
  const decisionClass = dragX > 28 ? styles.decisionYes : dragX < -28 ? styles.decisionNo : "";
  if (!question) {
    return (
      <AuthGuard roles={["student"]}>
        <AppShell>
          <div className={styles.page}>
            <section className={styles.stateCard}>
              <h2 className={styles.stateTitle}>{t("Не удалось запустить блиц", "Блицті іске қосу мүмкін болмады")}</h2>
              <p className={styles.stateText}>{t("Список вопросов пуст. Перезапустите страницу и попробуйте снова.", "Сұрақтар тізімі бос. Бетті қайта жүктеп, тағы көріңіз.")}</p>
              <Button onClick={() => router.push("/dashboard")}>{t("На главную", "Басты бетке")}</Button>
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
            <>
              <header className={styles.header}>
                <h2 className={styles.title}>{t("Блиц", "Блиц")}</h2>
                <p className={styles.subtitle}>{t("Устрой быстрый тест своим знаниям", "Біліміңізді жылдам тексеріңіз")}</p>
              </header>

              <section className={styles.startWrap}>
                <div className={styles.startStack}>
                  <div className={`${styles.startStackLayer} ${styles.startStackLayerBack}`} />
                  <div className={`${styles.startStackLayer} ${styles.startStackLayerMid}`} />
                  <article className={styles.startCard}>
                    <p className={styles.startCardLead}>{t("15 секунд на 1 вопрос", "1 сұраққа 15 секунд")}</p>
                    <h3 className={styles.startTitle}>{t("Быстрые вопросы ответы на которые Да/Нет", "Иә/Жоқ форматындағы жедел сұрақтар")}</h3>
                    <div className={styles.startCardHintRow}>
                      <span>{t("Нет", "Жоқ")}</span>
                      <span>{t("Да", "Иә")}</span>
                    </div>
                  </article>
                </div>

                <div className={styles.startActions}>
                  <Button
                    className={styles.startPrimary}
                    onClick={() => {
                      const nextQuestions = createBlitzQuestionSet(settings.questionCount, uiLanguage, settings.difficulty);
                      setQuestions(nextQuestions);
                      setAnswers([]);
                      setActiveIndex(0);
                      setIsTransitioning(false);
                      setExitDirection(0);
                      setIsDragging(false);
                      setDragX(0);
                      pointerStartX.current = null;
                      setSessionStartedAt(Date.now());
                      setSecondsLeft(BLITZ_QUESTION_TIME_LIMIT_SECONDS);
                      setIsStarted(true);
                    }}
                  >
                    {t("Начать блиц", "Блицті бастау")}
                  </Button>
                  <button
                    className={styles.startSettingsButton}
                    type="button"
                    onClick={() => {
                      setPendingSettings(settings);
                      setIsSettingsModalOpen(true);
                    }}
                  >
                    {t("Параметры", "Параметрлер")}
                  </button>
                </div>
              </section>

              {isSettingsModalOpen ? (
                <div
                  className={styles.modalOverlay}
                  role="presentation"
                  onClick={() => setIsSettingsModalOpen(false)}
                >
                  <article
                    className={styles.modal}
                    role="dialog"
                    aria-modal="true"
                    aria-label={t("Параметры блица", "Блиц параметрлері")}
                    onClick={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}
                  >
                    <header className={styles.modalHeader}>
                      <h3>{t("Параметры блица", "Блиц параметрлері")}</h3>
                      <p>{t("Настройте сложность и количество вопросов.", "Күрделілік пен сұрақ санын таңдаңыз.")}</p>
                    </header>

                    <section className={styles.modalBlock}>
                      <p className={styles.modalLabel}>{t("Сложность", "Күрделілік")}</p>
                      <div className={styles.choiceWheel}>
                        <div className={styles.choiceRow}>
                          <span className={styles.wheelSpacer} aria-hidden="true" />
                          {BLITZ_DIFFICULTY_OPTIONS.map((option) => (
                            <button
                              key={option}
                              type="button"
                              className={`${styles.choiceButton} ${pendingSettings.difficulty === option ? styles.choiceButtonActive : ""}`}
                              onClick={(event) => handleWheelChoice((value) => setPendingSettings((prev) => ({ ...prev, difficulty: value })), option, event)}
                            >
                              {difficultyLabel(option, uiLanguage)}
                            </button>
                          ))}
                          <span className={styles.wheelSpacer} aria-hidden="true" />
                        </div>
                      </div>
                    </section>

                    <section className={styles.modalBlock}>
                      <p className={styles.modalLabel}>{t("Количество вопросов", "Сұрақ саны")}</p>
                      <div className={styles.choiceWheel}>
                        <div className={styles.choiceRow}>
                          <span className={styles.wheelSpacer} aria-hidden="true" />
                          {BLITZ_QUESTION_COUNT_OPTIONS.map((option) => (
                            <button
                              key={option}
                              type="button"
                              className={`${styles.choiceButton} ${pendingSettings.questionCount === option ? styles.choiceButtonActive : ""}`}
                              onClick={(event) => handleWheelChoice((value) => setPendingSettings((prev) => ({ ...prev, questionCount: value })), option, event)}
                            >
                              {option}
                            </button>
                          ))}
                          <span className={styles.wheelSpacer} aria-hidden="true" />
                        </div>
                      </div>
                    </section>

                    <div className={styles.modalActions}>
                      <Button
                        onClick={() => {
                          setSettings(pendingSettings);
                          setIsSettingsModalOpen(false);
                        }}
                      >
                        {t("Готово", "Дайын")}
                      </Button>
                      <button className={styles.modalCancel} type="button" onClick={() => setIsSettingsModalOpen(false)}>
                        {t("Отмена", "Бас тарту")}
                      </button>
                    </div>
                  </article>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <header className={styles.header}>
                <h2 className={styles.title}>{t("Блиц", "Блиц")}</h2>
                <p className={styles.subtitle}>{t("Устрой быстрый тест своим знаниям", "Біліміңізді жылдам тексеріңіз")}</p>
              </header>

              <section className={styles.progressSection}>
                <div className={styles.timerRow}>
                  <img className={styles.timerIcon} src={assetPaths.icons.blitz} alt={t("Таймер", "Таймер")} />
                  <p className={styles.timerValue}>{formatTimer(secondsLeft)}</p>
                </div>
                <div className={styles.progressBar}>
                  <span style={{ width: `${timerProgressPercent}%` }} />
                </div>
                <p className={styles.counterText}>{activeIndex + 1} {t("из", "ішінен")} {questions.length}</p>
              </section>

              <section className={styles.blitzArea}>
                <Button
                  className={`${styles.sideButton} ${styles.sideButtonNo}`}
                  variant="primary"
                  onClick={() => submitAnswer(false, "button")}
                  disabled={isTransitioning}
                >
                  {t("Нет", "Жоқ")}
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
                    <p className={styles.cardHint}>{t("На мобильном можно отвечать свайпом влево/вправо.", "Мобильді нұсқада солға/оңға свайппен жауап беруге болады.")}</p>
                  </article>
                </div>

                <Button
                  className={`${styles.sideButton} ${styles.sideButtonYes}`}
                  variant="primary"
                  onClick={() => submitAnswer(true, "button")}
                  disabled={isTransitioning}
                >
                  {t("Да", "Иә")}
                </Button>
              </section>
            </>
          )}
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function difficultyLabel(value: BlitzDifficulty, language: "RU" | "KZ"): string {
  if (value === "hard") return language === "KZ" ? "Күрделі" : "Сложная";
  if (value === "medium") return language === "KZ" ? "Орташа" : "Средняя";
  return language === "KZ" ? "Жеңіл" : "Лёгкая";
}

function formatTimer(value: number): string {
  const safe = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
