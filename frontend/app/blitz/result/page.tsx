"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Button from "@/components/ui/Button";
import { BLITZ_LAST_RESULT_KEY, BlitzResultPayload, parseBlitzResultPayload } from "@/lib/blitz";
import { tr, useUiLanguage } from "@/lib/i18n";
import styles from "@/app/blitz/result/result.module.css";

export default function BlitzResultPage() {
  const router = useRouter();
  const uiLanguage = useUiLanguage();
  const t = (ru: string, kz: string) => tr(uiLanguage, ru, kz);
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
            <section className={styles.stateCard}>{t("Загружаем итоги блица...", "Блиц қорытындысы жүктелуде...")}</section>
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
              <h2 className={styles.stateTitle}>{t("Итоги не найдены", "Қорытынды табылмады")}</h2>
              <p className={styles.stateText}>{t("Сначала завершите блиц, затем откройте страницу результатов.", "Алдымен блицті аяқтап, содан кейін нәтижелер бетін ашыңыз.")}</p>
              <Button onClick={() => router.push("/blitz")}>{t("Перейти в блиц", "Блицке өту")}</Button>
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
              <h2 className={styles.title}>{t("Итоги блица", "Блиц қорытындысы")}</h2>
              <p className={styles.subtitle}>{t("Результат и персональная рекомендация", "Нәтиже және жеке ұсыныс")}</p>
            </header>

            <div className={styles.summaryGrid}>
              <article className={styles.scoreCard}>
                <p className={styles.scoreLabel}>{t("Ваш результат", "Сіздің нәтижеңіз")}</p>
                <p className={`${styles.scoreValue} ${scoreClass}`}>{formatPercent(result.percent)}</p>

                <div className={styles.metrics}>
                  <p className={styles.metricRow}><span>{t("Баллы", "Ұпай")}:</span> <b>{result.correctAnswers} / {result.totalQuestions}</b></p>
                  <p className={styles.metricRow}><span>{t("Время", "Уақыт")}:</span> <b>{formatDuration(result.totalElapsedSeconds)}</b></p>
                  <p className={styles.metricRow}><span>{t("Верных", "Дұрыс")}:</span> <b>{result.correctAnswers}</b></p>
                  <p className={styles.metricRow}><span>{t("Ошибок", "Қате")}:</span> <b>{result.wrongAnswers}</b></p>
                  <p className={styles.metricRow}><span>{t("Таймаутов", "Таймаут")}:</span> <b>{result.timedOutAnswers}</b></p>
                </div>
              </article>

              <article className={styles.recommendationCard}>
                <h3 className={styles.recommendationTitle}>{t("Рекомендации", "Ұсыныстар")}</h3>
                <p className={styles.recommendationText}>{result.recommendation}</p>
                {result.weakTopics.length > 0 ? (
                  <p className={styles.weakTopics}>{t("Слабые темы", "Әлсіз тақырыптар")}: {result.weakTopics.join(", ")}.</p>
                ) : (
                  <p className={styles.weakTopics}>{t("Слабых тем по этому блицу не обнаружено.", "Бұл блиц бойынша әлсіз тақырыптар анықталмады.")}</p>
                )}
              </article>
            </div>

            <div className={styles.actionsRow}>
              <Button className={styles.homeButton} onClick={() => router.push("/dashboard")}>{t("На главную", "Басты бетке")}</Button>
              <button className={styles.retryButton} type="button" onClick={() => router.push("/blitz")}>{t("Пройти заново", "Қайта өту")}</button>
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{t("Разбор ответов", "Жауаптарды талдау")}</h3>
            </header>

            <div className={styles.answerGrid}>
              {result.answers.map((item, index) => {
                const statusClass = item.isCorrect ? styles.answerCorrect : styles.answerWrong;
                const statusText = item.timedOut
                  ? t("Время вышло", "Уақыт бітті")
                  : item.isCorrect
                    ? t("Верно", "Дұрыс")
                    : t("Неверно", "Қате");

                return (
                  <article className={styles.answerCard} key={`${item.questionId}-${index}`}>
                    <p className={styles.fieldLabel}>{t("Вопрос", "Сұрақ")} {index + 1}</p>
                    <p className={styles.questionText}>{item.prompt}</p>

                    <p className={styles.fieldLabel}>{t("Ваш ответ", "Сіздің жауабыңыз")}</p>
                    <p className={styles.answerText}>{item.userAnswer === null ? t("Нет ответа", "Жауап жоқ") : item.userAnswer ? t("Да", "Иә") : t("Нет", "Жоқ")}</p>

                    <p className={styles.fieldLabel}>{t("Правильный ответ", "Дұрыс жауап")}</p>
                    <p className={styles.answerText}>{item.correctAnswer ? t("Да", "Иә") : t("Нет", "Жоқ")}</p>

                    <p className={styles.fieldLabel}>{t("Статус", "Мәртебе")}</p>
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
