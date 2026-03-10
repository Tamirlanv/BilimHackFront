"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import {
  downloadTeacherCustomTestResultsCsv,
  getTeacherCustomTestResults,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { tr, uiLocale, useUiLanguage } from "@/lib/i18n";
import { TeacherCustomTestResultsResponse } from "@/lib/types";
import { assetPaths } from "@/src/assets";
import styles from "@/app/teacher/tests/[id]/results.module.css";

const RESULTS_REQUEST_COOLDOWN_MS = 15_000;
const resultsRequestInFlight = new Map<string, Promise<TeacherCustomTestResultsResponse>>();
const resultsRequestSnapshot = new Map<string, { at: number; payload: TeacherCustomTestResultsResponse }>();

function formatPercent(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}

function formatDateLabel(input?: string | null, language: "RU" | "KZ" = "RU"): string {
  if (!input) return "–";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "–";
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const valueStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((dayStart.getTime() - valueStart.getTime()) / 86_400_000);
  if (diffDays === 0) return language === "KZ" ? "Бүгін" : "Сегодня";
  if (diffDays === 1) return language === "KZ" ? "Кеше" : "Вчера";
  return date.toLocaleDateString(uiLocale(language), {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export default function TeacherCustomTestResultsPage() {
  const uiLanguage = useUiLanguage();
  const t = (ru: string, kz: string) => tr(uiLanguage, ru, kz);
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const customTestId = Number(params?.id || 0);

  const [payload, setPayload] = useState<TeacherCustomTestResultsResponse | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const inFlightRequestKeyRef = useRef<string | null>(null);
  const lastLoadedRequestRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const initialLoadKeyRef = useRef<string>("");
  const loadResultsRef = useRef<
    (groupIds?: number[], options?: { force?: boolean }) => Promise<void>
  >(async () => {});

  const normalizeGroupIds = useCallback((groupIds: number[]) => {
    return [...groupIds]
      .filter((groupId) => Number.isFinite(groupId) && groupId > 0)
      .map((groupId) => Number(groupId))
      .sort((left, right) => left - right);
  }, []);

  const sameGroupSelection = useCallback((left: number[], right: number[]) => {
    if (left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) return false;
    }
    return true;
  }, []);

  const loadResults = useCallback(async (groupIds: number[] = [], options?: { force?: boolean }) => {
    const token = getToken();
    if (!token || !Number.isFinite(customTestId) || customTestId <= 0) return;
    const normalizedGroupIds = normalizeGroupIds(groupIds);
    const requestKey = `${customTestId}:${normalizedGroupIds.join(",") || "all"}`;
    const now = Date.now();

    if (options?.force) {
      resultsRequestSnapshot.delete(requestKey);
      resultsRequestInFlight.delete(requestKey);
    }

    const snapshot = resultsRequestSnapshot.get(requestKey);
    if (!options?.force && snapshot && now - snapshot.at < RESULTS_REQUEST_COOLDOWN_MS) {
      const data = snapshot.payload;
      setPayload(data);
      const nextSelected = normalizeGroupIds(data.groups.filter((item) => item.selected).map((item) => item.id));
      setSelectedGroupIds((prev) => (sameGroupSelection(prev, nextSelected) ? prev : nextSelected));
      lastLoadedRequestRef.current = { key: requestKey, at: now };
      return;
    }

    if (!options?.force && lastLoadedRequestRef.current.key === requestKey && now - lastLoadedRequestRef.current.at < 10_000) {
      return;
    }
    if (inFlightRequestKeyRef.current === requestKey) {
      return;
    }

    inFlightRequestKeyRef.current = requestKey;
    try {
      const existingRequest = resultsRequestInFlight.get(requestKey);
      const request =
        existingRequest ??
        getTeacherCustomTestResults(token, customTestId, normalizedGroupIds, {
          force: Boolean(options?.force),
        });
      if (!existingRequest) {
        resultsRequestInFlight.set(requestKey, request);
      }
      const data = await request;
      resultsRequestSnapshot.set(requestKey, { at: Date.now(), payload: data });
      setPayload(data);
      const nextSelected = normalizeGroupIds(data.groups.filter((item) => item.selected).map((item) => item.id));
      setSelectedGroupIds((prev) => (sameGroupSelection(prev, nextSelected) ? prev : nextSelected));
      lastLoadedRequestRef.current = { key: requestKey, at: Date.now() };
    } finally {
      resultsRequestInFlight.delete(requestKey);
      inFlightRequestKeyRef.current = null;
    }
  }, [customTestId, normalizeGroupIds, sameGroupSelection]);

  useEffect(() => {
    loadResultsRef.current = loadResults;
  }, [loadResults]);

  useEffect(() => {
    let cancelled = false;
    const initialKey = `${customTestId}:all`;
    if (initialLoadKeyRef.current === initialKey) {
      return () => {
        cancelled = true;
      };
    }
    initialLoadKeyRef.current = initialKey;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const token = getToken();
        if (!token) return;
        await loadResultsRef.current();
        if (cancelled) return;
      } catch (requestError) {
        if (cancelled) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : tr(uiLanguage, "Не удалось загрузить результаты теста.", "Тест нәтижелерін жүктеу мүмкін болмады."),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customTestId]);

  const toggleGroup = async (groupId: number) => {
    if (!payload) return;
    const currentlySelected = selectedGroupIds.includes(groupId);
    const nextSelected = currentlySelected
      ? selectedGroupIds.filter((item) => item !== groupId)
      : [...selectedGroupIds, groupId];
    if (nextSelected.length === 0) return;

    try {
      setLoading(true);
      setError("");
      await loadResults(nextSelected);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("Не удалось обновить фильтр групп.", "Топ сүзгісін жаңарту мүмкін болмады."),
      );
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    const token = getToken();
    if (!token || !payload) return;
    try {
      setExporting(true);
      const blob = await downloadTeacherCustomTestResultsCsv(token, payload.custom_test_id, selectedGroupIds);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `custom_test_${payload.custom_test_id}_results.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("Не удалось экспортировать CSV.", "CSV экспорттау мүмкін болмады."),
      );
    } finally {
      setExporting(false);
    }
  };

  const title = useMemo(() => {
    if (!payload) return tr(uiLanguage, "Результаты теста", "Тест нәтижелері");
    return tr(uiLanguage, `Результаты теста: ${payload.title}`, `Тест нәтижелері: ${payload.title}`);
  }, [payload, uiLanguage]);

  return (
    <AuthGuard roles={["teacher"]}>
      <AppShell>
        <div className={styles.page}>
          <header className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.subtitle}>
              {t("Результаты учеников этого теста", "Осы тест бойынша оқушы нәтижелері")}
            </p>
          </header>

          {error && <p className={styles.error}>{error}</p>}

          {payload && (
            <>
              <section className={styles.groups}>
                {payload.groups.map((group) => {
                  const isActive = selectedGroupIds.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={`${styles.groupCard} ${isActive ? styles.groupCardActive : ""}`}
                      onClick={() => void toggleGroup(group.id)}
                    >
                      <img src={assetPaths.icons.group} alt="" aria-hidden className={styles.groupIcon} />
                      <span className={styles.groupText}>
                        <strong title={group.name}>{group.name}</strong>
                        <span>
                          {group.members_count} {t("человек", "адам")}
                        </span>
                      </span>
                      <span className={`${styles.groupDot} ${isActive ? styles.groupDotActive : ""}`} />
                    </button>
                  );
                })}
              </section>

              <section className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t("Имя", "Аты")}</th>
                      <th>{t("Результат", "Нәтиже")}</th>
                      <th>{t("Предупреждения", "Ескертулер")}</th>
                      <th>{t("Сдано", "Тапсырылды")}</th>
                      <th>{t("Группа", "Топ")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {payload.students.map((student, index) => (
                      <tr key={`${student.student_id}-${student.group_id}`}>
                        <td className={styles.nameCell}>
                          <span className={styles.index}>{index + 1}</span>
                          <span title={student.full_name}>{student.full_name}</span>
                        </td>
                        <td>{formatPercent(student.percent)}</td>
                        <td>{student.warning_count ?? "–"}</td>
                        <td>{formatDateLabel(student.submitted_at, uiLanguage)}</td>
                        <td className={styles.groupNameCell}>
                          <span title={student.group_name}>{student.group_name}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.openButton}
                            onClick={() => router.push(`/teacher/students/${student.student_id}`)}
                          >
                            {t("Открыть", "Ашу")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.exportButton}
                  onClick={() => void exportCsv()}
                  disabled={exporting}
                >
                  {exporting ? t("Экспорт...", "Экспорт...") : t("Экспорт .csv", ".csv экспорт")}
                </button>
              </div>
            </>
          )}

          {loading && !payload && <p className={styles.empty}>{t("Загрузка...", "Жүктелуде...")}</p>}
          {!loading && payload && payload.students.length === 0 && (
            <p className={styles.empty}>{t("По выбранным группам пока нет данных.", "Таңдалған топтарда әзірге дерек жоқ.")}</p>
          )}

          <footer className={styles.footer}>oku.com.kz</footer>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
