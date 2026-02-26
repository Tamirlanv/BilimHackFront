"use client";

import { useEffect, useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { getHistory, getProgress, getSubjects } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { HistoryItem, StudentProgress, Subject } from "@/lib/types";
import { readBlitzResultHistory } from "@/lib/blitz";
import { assetPaths } from "@/src/assets";
import styles from "@/app/progress/progress.module.css";

interface MetricItem {
  id: string;
  label: string;
  meta: string;
  value: string;
}

interface SubjectMetricItem {
  id: string;
  name: string;
  value: string;
}

interface ExtraMetricItem {
  id: string;
  label: string;
  meta: string;
  value: string;
}

const SUBJECT_FALLBACK = [
  "Математика",
  "Алгебра",
  "Геометрия",
  "Физика",
  "Английский язык",
  "Русский язык",
  "Всемирная история",
  "Биология",
  "Химия",
];

export default function ProgressPage() {
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blitzHistory, setBlitzHistory] = useState<Array<{ percent: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let isCancelled = false;
    setBlitzHistory(readBlitzResultHistory().map((item) => ({ percent: item.percent })));

    (async () => {
      try {
        const [progressPayload, historyPayload] = await Promise.all([getProgress(token), getHistory(token)]);
        if (isCancelled) return;
        setProgress(progressPayload);
        setHistory(historyPayload);
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Не удалось загрузить аналитику");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }

      try {
        const subjectsPayload = await getSubjects(token);
        if (!isCancelled) {
          setSubjects(subjectsPayload);
        }
      } catch (err) {
        console.warn("Не удалось загрузить список предметов для аналитики:", err);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  const sortedByPercent = useMemo(
    () => history.slice().sort((left, right) => right.percent - left.percent),
    [history],
  );

  const bestAttempt = sortedByPercent[0] || null;
  const worstAttempt = sortedByPercent[sortedByPercent.length - 1] || null;

  const favoriteSubject = useMemo(() => {
    if (history.length === 0) return "Нет данных";
    const counter = new Map<string, number>();
    for (const item of history) {
      const title = attemptTitle(item);
      counter.set(title, (counter.get(title) || 0) + 1);
    }
    return [...counter.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "Нет данных";
  }, [history]);

  const alignmentPercent = useMemo(() => {
    const avg = progress?.avg_percent ?? 0;
    const warningPenalty = Math.min(progress?.total_warnings ?? 0, 15);
    return Math.max(0, Math.min(100, Math.round(avg * 0.8 + 50 - warningPenalty)));
  }, [progress?.avg_percent, progress?.total_warnings]);

  const testsToday = useMemo(() => {
    const today = new Date();
    const todayKey = dateKey(today);
    return history.filter((item) => dateKey(new Date(item.created_at)) === todayKey).length;
  }, [history]);

  const streakDays = useMemo(() => {
    if (history.length === 0) return 0;
    const uniqueDays = [...new Set(history.map((item) => dateKey(new Date(item.created_at))))].sort((a, b) =>
      b.localeCompare(a),
    );
    if (uniqueDays.length === 0) return 0;

    let streak = 1;
    let current = parseDateKey(uniqueDays[0]);
    for (let i = 1; i < uniqueDays.length; i += 1) {
      const next = parseDateKey(uniqueDays[i]);
      if (!current || !next) break;
      const expected = new Date(current);
      expected.setDate(expected.getDate() - 1);
      if (dateKey(expected) !== uniqueDays[i]) break;
      streak += 1;
      current = next;
    }
    return streak;
  }, [history]);

  const metrics = useMemo<MetricItem[]>(() => {
    return [
      {
        id: "avg",
        label: "Средняя успеваемость",
        meta: "По всем попыткам",
        value: formatPercent(progress?.avg_percent ?? 0),
      },
      {
        id: "best",
        label: "Лучший результат",
        meta: bestAttempt ? `${attemptTitle(bestAttempt)} (${difficultyLabel(bestAttempt.difficulty)})` : "Пока нет данных",
        value: formatPercent(progress?.best_percent ?? 0),
      },
      {
        id: "total",
        label: "Всего тестов",
        meta: "За все время",
        value: String(progress?.total_tests ?? 0),
      },
      {
        id: "alignment",
        label: "Соответствие",
        meta: "Относительно образования",
        value: `${alignmentPercent}%`,
      },
      {
        id: "worst",
        label: "Худший результат",
        meta: worstAttempt ? `${attemptTitle(worstAttempt)} (${difficultyLabel(worstAttempt.difficulty)})` : "Пока нет данных",
        value: worstAttempt ? formatPercent(worstAttempt.percent) : "0%",
      },
      {
        id: "favorite",
        label: "Любимчик",
        meta: "Наиболее часто проходимый",
        value: formatSubjectTitle(favoriteSubject),
      },
      {
        id: "warnings",
        label: "Предупреждения",
        meta: "Подозрение в спекуляции",
        value: String(progress?.total_warnings ?? 0),
      },
      {
        id: "streak",
        label: "Дней в ударе",
        meta: "Дней подряд проходите тесты",
        value: String(streakDays),
      },
      {
        id: "today",
        label: "Тесты за сегодня",
        meta: "Пройденных тестов",
        value: String(testsToday),
      },
    ];
  }, [alignmentPercent, bestAttempt, favoriteSubject, progress?.avg_percent, progress?.best_percent, progress?.total_tests, progress?.total_warnings, streakDays, testsToday, worstAttempt]);

  const subjectMetrics = useMemo<SubjectMetricItem[]>(() => {
    const byNormalizedName = new Map<string, number>();
    for (const item of progress?.subject_stats || []) {
      byNormalizedName.set(normalizeName(item.subject_name), item.avg_percent);
    }

    const allNames: string[] = [];
    const seen = new Set<string>();

    const namesFromApi =
      subjects.length > 0
        ? subjects.map((subject) => subject.name_ru || subject.name_kz || `Предмет #${subject.id}`)
        : SUBJECT_FALLBACK;

    for (const name of namesFromApi) {
      const key = normalizeName(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      allNames.push(name);
    }

    for (const item of progress?.subject_stats || []) {
      const key = normalizeName(item.subject_name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      allNames.push(item.subject_name);
    }

    return allNames.map((subject) => {
      const normalizedSubject = normalizeName(subject);
      const hasResult = byNormalizedName.has(normalizedSubject);
      const value = byNormalizedName.get(normalizedSubject);
      return {
        id: normalizedSubject,
        name: subject,
        value: hasResult && typeof value === "number" ? formatPercent(value) : "–",
      };
    });
  }, [progress?.subject_stats, subjects]);

  const examMetrics = useMemo<ExtraMetricItem[]>(() => {
    const createExamMetric = (examKind: "ent" | "ielts", title: string): ExtraMetricItem => {
      const examHistory = history.filter((item) => item.exam_kind === examKind);
      if (examHistory.length === 0) {
        return {
          id: examKind,
          label: title,
          meta: "Пока нет попыток",
          value: "–",
        };
      }

      const best = Math.max(...examHistory.map((item) => item.percent));
      const avg = examHistory.reduce((acc, item) => acc + item.percent, 0) / examHistory.length;

      return {
        id: examKind,
        label: title,
        meta: `Попыток: ${examHistory.length} · Средний: ${formatPercent(avg)}`,
        value: formatPercent(best),
      };
    };

    return [createExamMetric("ent", "ЕНТ"), createExamMetric("ielts", "IELTS")];
  }, [history]);

  const blitzMetrics = useMemo<ExtraMetricItem[]>(() => {
    if (blitzHistory.length === 0) {
      return [
        { id: "blitz-best", label: "Лучший результат", meta: "Быстрые вопросы Да/Нет", value: "–" },
        { id: "blitz-avg", label: "Средний результат", meta: "По всем блиц-сессиям", value: "–" },
        { id: "blitz-attempts", label: "Всего блицев", meta: "Завершенных сессий", value: "0" },
      ];
    }

    const best = Math.max(...blitzHistory.map((item) => item.percent));
    const avg = blitzHistory.reduce((acc, item) => acc + item.percent, 0) / blitzHistory.length;

    return [
      { id: "blitz-best", label: "Лучший результат", meta: "Быстрые вопросы Да/Нет", value: formatPercent(best) },
      { id: "blitz-avg", label: "Средний результат", meta: "По всем блиц-сессиям", value: formatPercent(avg) },
      { id: "blitz-attempts", label: "Всего блицев", meta: "Завершенных сессий", value: String(blitzHistory.length) },
    ];
  }, [blitzHistory]);

  const exportRows = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [];
    for (const item of metrics) {
      rows.push({ label: item.label, value: item.value });
    }
    for (const subject of subjectMetrics) {
      rows.push({ label: `Предмет: ${subject.name}`, value: subject.value });
    }
    for (const exam of examMetrics) {
      rows.push({ label: `Подготовка: ${exam.label}`, value: exam.value });
    }
    for (const blitz of blitzMetrics) {
      rows.push({ label: `Блиц: ${blitz.label}`, value: blitz.value });
    }
    return rows;
  }, [blitzMetrics, examMetrics, metrics, subjectMetrics]);

  const exportCsv = () => {
    const rows = ["Показатель,Значение", ...exportRows.map((item) => `${toCsvCell(item.label)},${toCsvCell(item.value)}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "oku-analytics.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <AuthGuard roles={["student"]}>
        <AppShell>
          <div className={styles.page}>
            <Card title="Аналитика">Загрузка...</Card>
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard roles={["student"]}>
      <AppShell>
        <div className={styles.page}>
          <section className={`${styles.section} ${styles.primarySection}`}>
            <div className={styles.sectionHeaderCentered}>
              <h2 className={styles.sectionTitle}>Аналитика</h2>
              <p className={styles.sectionSubtitle}>Краткий пересказ вашего текущего прогресса</p>
            </div>

            <div className={styles.metricsGrid}>
              {metrics.map((item) => (
                <article className={styles.metricItem} key={item.id}>
                  <h3 className={styles.metricLabel}>{item.label}</h3>
                  <p className={styles.metricMeta}>{item.meta}</p>
                  <p className={styles.metricValue}>{item.value}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeaderCentered}>
              <h2 className={styles.sectionTitle}>По предметам</h2>
              <p className={styles.sectionSubtitle}>Ваша статистика по отдельным предметам</p>
            </div>

            {error && <div className="errorText">{error}</div>}

            <div className={styles.subjectGrid}>
              {subjectMetrics.map((item) => (
                <article className={styles.subjectItem} key={item.id}>
                  <h3 className={styles.metricLabel}>{item.name}</h3>
                  <p className={styles.metricMeta}>По всем попыткам</p>
                  <p className={styles.metricValue}>{item.value}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeaderCentered}>
              <h2 className={styles.sectionTitle}>Подготовка к важному</h2>
              <p className={styles.sectionSubtitle}>Статистика по экзаменационным режимам ЕНТ и IELTS</p>
            </div>

            <div className={styles.extraGrid}>
              {examMetrics.map((item) => (
                <article className={styles.extraCard} key={item.id}>
                  <h3 className={styles.metricLabel}>{item.label}</h3>
                  <p className={styles.metricMeta}>{item.meta}</p>
                  <p className={styles.metricValue}>{item.value}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeaderCentered}>
              <h2 className={styles.sectionTitle}>Блиц</h2>
              <p className={styles.sectionSubtitle}>Краткая статистика по быстрым сессиям</p>
            </div>

            <div className={styles.extraGrid}>
              {blitzMetrics.map((item, index) => (
                <article className={styles.extraCard} key={item.id}>
                  {index === 0 ? (
                    <div className={styles.iconRow}>
                      <img className={styles.blitzIcon} src={assetPaths.icons.blitz} alt="Блиц" />
                    </div>
                  ) : null}
                  <h3 className={styles.metricLabel}>{item.label}</h3>
                  <p className={styles.metricMeta}>{item.meta}</p>
                  <p className={styles.metricValue}>{item.value}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.exportSection}>
            <h3 className={styles.exportTitle}>Экспортировать статистику</h3>
            <div className={styles.exportActions}>
              <Button className={styles.exportButton} onClick={exportCsv}>
                Скачать .csv
              </Button>
            </div>
          </section>

          <footer className={styles.footer}>OKU.com</footer>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9әіңғүұқөһ]/gi, "");
}

function difficultyLabel(value: HistoryItem["difficulty"]): string {
  if (value === "easy") return "Легкий";
  if (value === "hard") return "Сложный";
  return "Средний";
}

function attemptTitle(item: Pick<HistoryItem, "subject_name" | "exam_kind">): string {
  if (item.exam_kind === "ielts") return "IELTS";
  if (item.exam_kind === "ent") return "ЕНТ";
  return item.subject_name;
}

function formatPercent(value: number): string {
  const rounded = Math.round((value || 0) * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded.toFixed(0)}%`;
  return `${rounded.toFixed(1)}%`;
}

function formatSubjectTitle(value: string): string {
  if (!value || value === "Нет данных") return "Нет данных";
  const normalized = normalizeName(value);
  if (normalized.includes("ielts")) return "IELTS";
  if (normalized.includes("ент") || normalized.includes("ent")) return "ЕНТ";
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function dateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): Date | null {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function toCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
