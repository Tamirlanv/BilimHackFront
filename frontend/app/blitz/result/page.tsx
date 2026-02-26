"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Button from "@/components/ui/Button";
import { BLITZ_LAST_RESULT_KEY, BlitzResultPayload, parseBlitzResultPayload } from "@/lib/blitz";
import styles from "@/app/blitz/result/result.module.css";

export default function BlitzResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<BlitzResultPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parsed = parseBlitzResultPayload(sessionStorage.getItem(BLITZ_LAST_RESULT_KEY));
    setResult(parsed);
    setLoading(false);
  }, []);

  const scoreClass = useMemo(() => {
    const percent = result?.percent ?? 0;
    if (percent >= 80) return styles.scoreGood;
    if (percent >= 55) return styles.scoreMid;
    return styles.scoreLow;
  }, [result?.percent]);

  if (loading) {
    return (
      <AuthGuard roles={["student"]}>
        <AppShell>
          <div className={styles.page}>
            <section className={styles.stateCard}>Загружаем итоги блица...</section>
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  if (!result) {
    return (
      <AuthGuard roles={["student"]}>
        <AppShell>
          <div className={styles.page}>
            <section className={styles.stateCard}>
              <h2 className={styles.stateTitle}>Итоги не найдены</h2>
              <p className={styles.stateText}>Сначала завершите блиц, затем откройте страницу результатов.</p>
              <Button onClick={() => router.push("/blitz")}>Перейти в блиц</Button>
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
          <section className={styles.section}>
            <header className={styles.header}>
              <h2 className={styles.title}>Итоги блица</h2>
              <p className={styles.subtitle}>Результат и персональная рекомендация</p>
            </header>

            <div className={styles.summaryGrid}>
              <article className={styles.scoreCard}>
                <p className={styles.scoreLabel}>Ваш результат</p>
                <p className={`${styles.scoreValue} ${scoreClass}`}>{formatPercent(result.percent)}</p>

                <div className={styles.metrics}>
                  <p className={styles.metricRow}><span>Баллы:</span> <b>{result.correctAnswers} / {result.totalQuestions}</b></p>
                  <p className={styles.metricRow}><span>Время:</span> <b>{formatDuration(result.totalElapsedSeconds)}</b></p>
                  <p className={styles.metricRow}><span>Верных:</span> <b>{result.correctAnswers}</b></p>
                  <p className={styles.metricRow}><span>Ошибок:</span> <b>{result.wrongAnswers}</b></p>
                  <p className={styles.metricRow}><span>Таймаутов:</span> <b>{result.timedOutAnswers}</b></p>
                </div>
              </article>

              <article className={styles.recommendationCard}>
                <h3 className={styles.recommendationTitle}>Рекомендации</h3>
                <p className={styles.recommendationText}>{result.recommendation}</p>
                {result.weakTopics.length > 0 ? (
                  <p className={styles.weakTopics}>Слабые темы: {result.weakTopics.join(", ")}.</p>
                ) : (
                  <p className={styles.weakTopics}>Слабых тем по этому блицу не обнаружено.</p>
                )}
              </article>
            </div>

            <div className={styles.actionsRow}>
              <Button className={styles.homeButton} onClick={() => router.push("/dashboard")}>На главную</Button>
              <button className={styles.retryButton} type="button" onClick={() => router.push("/blitz")}>Пройти заново</button>
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Разбор ответов</h3>
            </header>

            <div className={styles.answerGrid}>
              {result.answers.map((item, index) => {
                const statusClass = item.isCorrect ? styles.answerCorrect : styles.answerWrong;
                const statusText = item.timedOut ? "Время вышло" : item.isCorrect ? "Верно" : "Неверно";

                return (
                  <article className={styles.answerCard} key={`${item.questionId}-${index}`}>
                    <p className={styles.fieldLabel}>Вопрос {index + 1}</p>
                    <p className={styles.questionText}>{item.prompt}</p>

                    <p className={styles.fieldLabel}>Ваш ответ</p>
                    <p className={styles.answerText}>{item.userAnswer === null ? "Нет ответа" : item.userAnswer ? "Да" : "Нет"}</p>

                    <p className={styles.fieldLabel}>Правильный ответ</p>
                    <p className={styles.answerText}>{item.correctAnswer ? "Да" : "Нет"}</p>

                    <p className={styles.fieldLabel}>Статус</p>
                    <p className={`${styles.statusText} ${statusClass}`}>{statusText}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <footer className={styles.footer}>OKU.com</footer>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatPercent(value: number): string {
  const rounded = Math.round((value || 0) * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded.toFixed(0)}%`;
  return `${rounded.toFixed(1)}%`;
}
