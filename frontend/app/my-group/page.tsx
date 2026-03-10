"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import { generateGroupAssignedTest, getStudentGroupTests } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { GroupAssignedTest } from "@/lib/types";
import { tr, uiLocale, useUiLanguage } from "@/lib/i18n";
import { assetPaths } from "@/src/assets";
import styles from "@/app/my-group/my-group.module.css";

export default function MyGroupPage() {
  const router = useRouter();
  const uiLanguage = useUiLanguage();
  const t = (ru: string, kz: string) => tr(uiLanguage, ru, kz);

  const [tests, setTests] = useState<GroupAssignedTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingTestId, setStartingTestId] = useState<number | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let isCancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const payload = await getStudentGroupTests(token);
        if (!isCancelled) {
          setTests(payload);
        }
      } catch (requestError) {
        if (!isCancelled) {
          const fallbackText = t(
            "Не удалось загрузить тесты группы.",
            "Топ тесттерін жүктеу мүмкін болмады.",
          );
          if (requestError instanceof Error) {
            const message = requestError.message.toLowerCase();
            if (message.includes("networkerror") || message.includes("failed to fetch")) {
              setError(
                t(
                  "Нет соединения с сервером. Проверьте адрес API и CORS-настройки.",
                  "Серверге қосылу жоқ. API адресін және CORS баптауларын тексеріңіз.",
                ),
              );
            } else {
              setError(requestError.message);
            }
          } else {
            setError(fallbackText);
          }
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  const groupName = useMemo(() => {
    if (tests.length === 0) return t("Моя группа", "Менің тобым");
    return tests[0].group_name;
  }, [tests, t]);

  const startGroupTest = async (customTestId: number) => {
    const token = getToken();
    if (!token) return;
    try {
      setStartingTestId(customTestId);
      const generated = await generateGroupAssignedTest(token, customTestId);
      router.push(`/test/${generated.id}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("Не удалось запустить тест.", "Тестті бастау мүмкін болмады."),
      );
    } finally {
      setStartingTestId(null);
    }
  };

  return (
    <AuthGuard roles={["student"]}>
      <AppShell>
        <div className={styles.page}>
          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{t("Тесты группы", "Топ тесттері")}</h2>
              <p className={styles.sectionSubtitle}>
                {t("Группа", "Топ")}: {groupName}
              </p>
            </header>

            {error && <div className="errorText">{error}</div>}
            {loading ? (
              <p className={styles.empty}>{t("Загрузка...", "Жүктелуде...")}</p>
            ) : tests.length === 0 ? (
              <p className={styles.empty}>
                {t("В вашей группе пока нет назначенных тестов.", "Сіздің тобыңызда әзірге тағайындалған тесттер жоқ.")}
              </p>
            ) : (
              <div className={styles.cards}>
                {tests.map((test) => (
                  <article key={test.custom_test_id} className={styles.card}>
                    <header className={styles.cardTop}>
                      <span className={styles.dayLabel}>{formatRelativeDay(test.created_at, uiLanguage)}</span>
                      <span className={styles.dateLabel}>
                        <img src={assetPaths.icons.schedule} alt="" aria-hidden />
                        {formatCompactDate(test.due_date || test.created_at, uiLanguage)}
                      </span>
                    </header>

                    <div className={styles.cardBody}>
                      <img className={styles.icon} src={assetPaths.icons.informatics} alt="" aria-hidden="true" />
                      <div className={styles.body}>
                        <h3 className={styles.title}>{test.title}</h3>
                        <p className={styles.description}>
                          {t("Вопросов", "Сұрақтар")}: {test.questions_count}
                        </p>
                        <p className={styles.meta}>
                          {t("Предупреждений", "Ескертулер")}: {test.warning_limit}
                        </p>
                        <p className={styles.meta}>
                          {t("Учитель", "Мұғалім")}: {test.teacher_name}
                        </p>
                      </div>
                    </div>

                    {test.is_completed ? (
                      <div className={styles.completedRow}>
                        <span className={styles.completedTag}>
                          <img src={assetPaths.icons.testPassed} alt="" aria-hidden />
                          {t("Пройдено", "Өтілді")}
                        </span>
                        <span className={styles.completedScore}>
                          {t("Результат", "Нәтиже")}: {formatPercent(test.completed_percent)}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.startButton}
                        onClick={() => void startGroupTest(test.custom_test_id)}
                        disabled={startingTestId === test.custom_test_id}
                      >
                        {startingTestId === test.custom_test_id ? t("Запускаем...", "Іске қосылуда...") : t("Пройти тест", "Тест тапсыру")}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <footer className={styles.footer}>oku.com.kz</footer>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function formatPercent(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function formatRelativeDay(input: string, language: "RU" | "KZ"): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return language === "KZ" ? "Бүгін" : "Сегодня";
  const now = new Date();
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const valueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((currentDay.getTime() - valueDay.getTime()) / 86_400_000);
  if (diffDays <= 0) return language === "KZ" ? "Бүгін" : "Сегодня";
  if (diffDays === 1) return language === "KZ" ? "Кеше" : "Вчера";
  return date.toLocaleDateString(uiLocale(language), { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatCompactDate(input: string, language: "RU" | "KZ"): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleDateString(uiLocale(language), {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}
