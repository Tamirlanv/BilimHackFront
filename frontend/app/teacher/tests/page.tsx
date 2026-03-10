"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import { getTeacherCustomTest, getTeacherCustomTests } from "@/lib/api";
import { getToken, getUser } from "@/lib/auth";
import { tr, uiLocale, useUiLanguage } from "@/lib/i18n";
import { TeacherCustomQuestion, TeacherCustomTest, TeacherCustomTestDetails } from "@/lib/types";
import { assetPaths } from "@/src/assets";
import styles from "@/app/teacher/tests/tests.module.css";

function dayLabel(input: string, language: "RU" | "KZ"): string {
  const date = new Date(input);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startInput = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startToday.getTime() - startInput.getTime()) / 86_400_000);
  if (diffDays === 0) return language === "KZ" ? "Бүгін" : "Сегодня";
  if (diffDays === 1) return language === "KZ" ? "Кеше" : "Вчера";
  return date.toLocaleDateString(uiLocale(language), {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function resolveDueDate(input?: string | null, language: "RU" | "KZ" = "RU"): {
  label: string;
  isExpired: boolean;
} {
  if (!input) {
    return { label: "–", isExpired: false };
  }

  const parsed = input.trim();
  let date = new Date(parsed);

  if (Number.isNaN(date.getTime())) {
    const dotMatch = parsed.match(/^(\d{2})\.(\d{2})\.(\d{2,4})$/);
    if (dotMatch) {
      const yearRaw = Number(dotMatch[3]);
      const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
      date = new Date(year, Number(dotMatch[2]) - 1, Number(dotMatch[1]));
    }
  }

  if (Number.isNaN(date.getTime())) {
    return { label: "–", isExpired: false };
  }

  const now = new Date();
  const dueStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return {
    label: date.toLocaleDateString(uiLocale(language), {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }),
    isExpired: dueStart < todayStart,
  };
}

function pluralRu(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function groupsLabel(count: number, language: "RU" | "KZ"): string {
  if (language === "KZ") return `${count} топ`;
  return `${count} ${pluralRu(count, "группа", "группы", "групп")}`;
}

function warningsLabel(count: number, language: "RU" | "KZ"): string {
  if (language === "KZ") return `${count} ескерту`;
  return `${count} ${pluralRu(count, "предупреждение", "предупреждения", "предупреждений")}`;
}

function pickTestIcon(title: string): string {
  const normalized = title.toLowerCase();

  if (/(ооп|код|программ|информ|алгоритм|java|python|frontend|backend|api|devops|it|ai|нейро)/.test(normalized)) {
    return assetPaths.icons.informatics;
  }
  if (/(матем|алгебр|геометр|тригоном|уравн|дискриминант|арифмет)/.test(normalized)) {
    return assetPaths.icons.math;
  }
  if (/(англ|ielts|listening|speaking|reading|writing|english)/.test(normalized)) {
    return assetPaths.icons.english;
  }
  if (/(русс|литер|пушкин|айтмат|тіл|язык|граммат|сочинен)/.test(normalized)) {
    return assetPaths.icons.russian;
  }
  if (/(истор|казахстан|дүние|world)/.test(normalized)) {
    return assetPaths.icons.history;
  }
  if (/(биолог|генет|клетк|анатом)/.test(normalized)) {
    return assetPaths.icons.biology;
  }
  if (/(хим|реакц|молекул|органик)/.test(normalized)) {
    return assetPaths.icons.chemistry;
  }
  if (/(физ|механик|электр|оптик|динам)/.test(normalized)) {
    return assetPaths.icons.physics;
  }
  if (/(ент|экзамен|exam|контрольн)/.test(normalized)) {
    return assetPaths.icons.ent;
  }

  return assetPaths.icons.lesson;
}

function toDraftStorageKey(userId: number): string {
  return `oku_teacher_custom_test_draft:${userId}`;
}

function mapDetailsToDraft(details: TeacherCustomTestDetails) {
  return {
    title: details.title,
    duration_minutes: details.duration_minutes,
    warning_limit: details.warning_limit,
    due_date: details.due_date ?? "",
    questions: details.questions.map((question: TeacherCustomQuestion) => ({
      id: `edit-q-${question.id}`,
      prompt: question.prompt ?? "",
      answer_type: question.answer_type,
      options:
        question.answer_type === "choice"
          ? (question.options?.length ? question.options : ["", "", "", ""])
          : ["", "", "", ""],
      correct_option_index:
        question.answer_type === "choice" ? (question.correct_option_index ?? 0) : null,
      sample_answer: question.sample_answer ?? "",
      image_data_url: question.image_data_url ?? null,
    })),
  };
}

export default function TeacherCustomTestsPage() {
  const uiLanguage = useUiLanguage();
  const t = (ru: string, kz: string) => tr(uiLanguage, ru, kz);
  const router = useRouter();

  const [tests, setTests] = useState<TeacherCustomTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingEditId, setLoadingEditId] = useState<number | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const payload = await getTeacherCustomTests(token);
        if (!cancelled) setTests(payload);
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : t("Не удалось загрузить тесты.", "Тесттерді жүктеу мүмкін болмады."),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedTests = useMemo(
    () => [...tests].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
    [tests],
  );

  const openResults = (testId: number) => {
    router.push(`/teacher/tests/${testId}`);
  };

  const openEdit = async (testId: number) => {
    const token = getToken();
    const user = getUser();
    if (!token || !user) return;
    try {
      setLoadingEditId(testId);
      const details = await getTeacherCustomTest(token, testId);
      localStorage.setItem(toDraftStorageKey(user.id), JSON.stringify(mapDetailsToDraft(details)));
      router.push("/teacher/create-test");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("Не удалось открыть тест для редактирования.", "Тестті өңдеуге ашу мүмкін болмады."),
      );
    } finally {
      setLoadingEditId(null);
    }
  };

  return (
    <AuthGuard roles={["teacher"]}>
      <AppShell>
        <div className={styles.page}>
          <header className={styles.header}>
            <h2 className={styles.title}>{t("Мои тесты", "Менің тесттерім")}</h2>
            <p className={styles.subtitle}>
              {t(
                "Список тестов и групп, в которые они назначены",
                "Тесттер және олар тағайындалған топтар тізімі",
              )}
            </p>
          </header>

          {error && <p className={styles.error}>{error}</p>}

          {loading ? (
            <p className={styles.empty}>{t("Загрузка...", "Жүктелуде...")}</p>
          ) : sortedTests.length === 0 ? (
            <p className={styles.empty}>{t("Пока нет созданных тестов.", "Әзірге құрылған тесттер жоқ.")}</p>
          ) : (
            <section className={styles.cards}>
              {sortedTests.map((test) => {
                const groupsCount = test.groups.length;
                const dueMeta = resolveDueDate(test.due_date, uiLanguage);
                return (
                  <article className={styles.card} key={test.id}>
                    <div className={styles.cardTop}>
                      <span className={styles.cardDayLabel}>{dayLabel(test.created_at, uiLanguage)}</span>
                      <span
                        className={`${styles.cardDeadline} ${dueMeta.isExpired ? styles.cardDeadlineExpired : ""}`}
                      >
                        <img src={assetPaths.icons.schedule} alt="" aria-hidden />
                        {dueMeta.label}
                      </span>
                    </div>

                    <div className={styles.cardBody}>
                      <img className={styles.cardSubjectIcon} src={pickTestIcon(test.title)} alt="" aria-hidden />
                      <div className={styles.cardBodyText}>
                        <h3 className={styles.cardTitle} title={test.title}>
                          {test.title}
                        </h3>
                        <div className={styles.cardMetrics}>
                          <span>
                            <img src={assetPaths.icons.questionAnswer} alt="" aria-hidden />
                            {test.questions_count} {t("вопросов", "сұрақ")}
                          </span>
                          <span>
                            <img src={assetPaths.icons.warningDiamond} alt="" aria-hidden />
                            {warningsLabel(test.warning_limit, uiLanguage)}
                          </span>
                          <span>
                            <img src={assetPaths.icons.group} alt="" aria-hidden />
                            {groupsLabel(groupsCount, uiLanguage)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.resultsButton}
                        onClick={() => openResults(test.id)}
                      >
                        {t("Результаты", "Нәтижелер")}
                      </button>
                      <button
                        type="button"
                        className={styles.editButton}
                        onClick={() => void openEdit(test.id)}
                        disabled={loadingEditId === test.id}
                      >
                        {loadingEditId === test.id
                          ? t("Открываем...", "Ашылуда...")
                          : t("Редактировать", "Өңдеу")}
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          <footer className={styles.footer}>oku.com.kz</footer>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
