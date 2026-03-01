"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Button from "@/components/ui/Button";
import { generateExamTest, generateTest, getSubjects } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { tr, useUiLanguage } from "@/lib/i18n";
import { Difficulty, Language, Mode, Subject } from "@/lib/types";
import { assetPaths } from "@/src/assets";
import styles from "@/app/test/test-setup.module.css";

type SubjectIconKey =
  | "math"
  | "algebra"
  | "geometry"
  | "physics"
  | "english"
  | "russian"
  | "history"
  | "biology"
  | "chemistry"
  | "informatics"
  | "soon";

type ExamType = "ent" | "ielts";

interface ModeInfo {
  value: Mode;
  title_ru: string;
  title_kz: string;
  description_ru: string;
  description_kz: string;
  icon: string;
}

interface SubjectCatalogItem {
  key: string;
  name_ru: string;
  name_kz: string;
  description_ru: string;
  description_kz: string;
  iconKey: SubjectIconKey;
  aliases: string[];
  subject_id: number | null;
  available: boolean;
}

interface ExamCard {
  key: ExamType;
  title_ru: string;
  title_kz: string;
  description_ru: string;
  description_kz: string;
  icon: string;
}

const MODES: ModeInfo[] = [
  {
    value: "text",
    title_ru: "Стандартный",
    title_kz: "Стандартты",
    description_ru: "Классический режим: чтение вопроса и ответы в текстовом формате.",
    description_kz: "Классикалық режим: сұрақты оқу және мәтін түрінде жауап беру.",
    icon: assetPaths.icons.text,
  },
  {
    value: "audio",
    title_ru: "Аудио",
    title_kz: "Аудио",
    description_ru: "Режим, где вы можете воспроизводить вопросы в аудио формате.",
    description_kz: "Сұрақтарды аудио форматта тыңдауға болатын режим.",
    icon: assetPaths.icons.headphones,
  },
  {
    value: "oral",
    title_ru: "Устный",
    title_kz: "Ауызша",
    description_ru: "Режим для устных ответов: вы говорите, а система оценивает ответ.",
    description_kz: "Ауызша жауап беру режимі: сіз сөйлейсіз, жүйе жауапты бағалайды.",
    icon: assetPaths.icons.microphone,
  },
];

const EXAM_CARDS: ExamCard[] = [
  {
    key: "ent",
    title_ru: "ЕНТ",
    title_kz: "ҰБТ",
    description_ru: "Национальный экзаменационный режим с фиксированной структурой заданий и таймером.",
    description_kz: "Белгіленген құрылымы мен таймері бар ұлттық емтихан режимі.",
    icon: assetPaths.icons.ent,
  },
  {
    key: "ielts",
    title_ru: "IELTS",
    title_kz: "IELTS",
    description_ru: "Режим международного экзамена с частями Listening, Reading, Writing и Speaking.",
    description_kz: "Listening, Reading, Writing және Speaking бөлімдері бар халықаралық емтихан режимі.",
    icon: assetPaths.icons.ielts,
  },
];

const SUBJECT_TEMPLATE: Array<Omit<SubjectCatalogItem, "subject_id" | "available">> = [
  {
    key: "math",
    name_ru: "Математика",
    name_kz: "Математика",
    description_ru: "Математика для средних классов",
    description_kz: "Орта сыныптарға арналған математика",
    iconKey: "math",
    aliases: ["математика"],
  },
  {
    key: "algebra",
    name_ru: "Алгебра",
    name_kz: "Алгебра",
    description_ru: "Математика для старших классов",
    description_kz: "Жоғары сыныптарға арналған математика",
    iconKey: "algebra",
    aliases: ["алгебра"],
  },
  {
    key: "geometry",
    name_ru: "Геометрия",
    name_kz: "Геометрия",
    description_ru: "Материал для старших классов",
    description_kz: "Жоғары сыныптарға арналған материал",
    iconKey: "geometry",
    aliases: ["геометрия"],
  },
  {
    key: "physics",
    name_ru: "Физика",
    name_kz: "Физика",
    description_ru: "Естественные науки для старших классов",
    description_kz: "Жаратылыстану жоғары сыныптарға",
    iconKey: "physics",
    aliases: ["физика"],
  },
  {
    key: "english",
    name_ru: "Английский язык",
    name_kz: "Ағылшын тілі",
    description_ru: "Языковая практика и грамматика",
    description_kz: "Тілдік практика мен грамматика",
    iconKey: "english",
    aliases: ["английскийязык", "агылшынтили"],
  },
  {
    key: "russian",
    name_ru: "Русский язык",
    name_kz: "Орыс тілі",
    description_ru: "Грамматика, лексика и чтение",
    description_kz: "Грамматика, сөздік және оқу",
    iconKey: "russian",
    aliases: ["русскийязык", "орыстили"],
  },
  {
    key: "history",
    name_ru: "Всемирная история",
    name_kz: "Дүниежүзі тарихы",
    description_ru: "Ключевые события и даты",
    description_kz: "Негізгі оқиғалар мен даталар",
    iconKey: "history",
    aliases: ["история", "тарих", "всемирнаяистория"],
  },
  {
    key: "biology",
    name_ru: "Биология",
    name_kz: "Биология",
    description_ru: "Живые системы и процессы",
    description_kz: "Тірі жүйелер мен үдерістер",
    iconKey: "biology",
    aliases: ["биология"],
  },
  {
    key: "chemistry",
    name_ru: "Химия",
    name_kz: "Химия",
    description_ru: "Основы веществ и реакций",
    description_kz: "Заттар мен реакциялар негізі",
    iconKey: "chemistry",
    aliases: ["химия"],
  },
  {
    key: "informatics",
    name_ru: "Информатика",
    name_kz: "Информатика",
    description_ru: "Алгоритмы и цифровая грамотность",
    description_kz: "Алгоритмдер және цифрлық сауат",
    iconKey: "informatics",
    aliases: ["информатика"],
  },
  {
    key: "soon",
    name_ru: "Скоро новое...",
    name_kz: "Жақында жаңа...",
    description_ru: "Здесь скоро будут новые материалы",
    description_kz: "Мұнда жақында жаңа материалдар болады",
    iconKey: "soon",
    aliases: [],
  },
];

const DIFFICULTIES: Array<{ value: Difficulty; title_ru: string; title_kz: string }> = [
  { value: "easy", title_ru: "Лёгкий", title_kz: "Жеңіл" },
  { value: "medium", title_ru: "Средний", title_kz: "Орташа" },
  { value: "hard", title_ru: "Сложный", title_kz: "Күрделі" },
];

const QUESTION_COUNTS = [5, 10, 15, 20, 25] as const;
const TIME_LIMIT_OPTIONS = [5, 10, 20, 30, 60] as const;

const ENT_PROFILE_SUBJECTS = [
  { key: "математика", title_ru: "Математика", title_kz: "Математика", iconKey: "math" as const },
  { key: "физика", title_ru: "Физика", title_kz: "Физика", iconKey: "physics" as const },
  { key: "биология", title_ru: "Биология", title_kz: "Биология", iconKey: "biology" as const },
  { key: "химия", title_ru: "Химия", title_kz: "Химия", iconKey: "chemistry" as const },
  { key: "информатика", title_ru: "Информатика", title_kz: "Информатика", iconKey: "informatics" as const },
];

const ICON_BY_SUBJECT: Record<SubjectIconKey, string> = {
  math: assetPaths.icons.math,
  algebra: assetPaths.icons.algebra,
  geometry: assetPaths.icons.geometry,
  physics: assetPaths.icons.physics,
  english: assetPaths.icons.english,
  russian: assetPaths.icons.russian,
  history: assetPaths.icons.history,
  biology: assetPaths.icons.biology,
  chemistry: assetPaths.icons.chemistry,
  informatics: assetPaths.icons.informatics,
  soon: assetPaths.icons.soon,
};

function normalizeSubjectName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9әіңғүұқөһ]/gi, "");
}

export default function TestSetupPage() {
  const router = useRouter();
  const uiLanguage = useUiLanguage();
  const t = (ru: string, kz: string) => tr(uiLanguage, ru, kz);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [language, setLanguage] = useState<Language>(uiLanguage);
  const [mode, setMode] = useState<Mode>("text");
  const [numQuestions, setNumQuestions] = useState(10);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<(typeof TIME_LIMIT_OPTIONS)[number]>(20);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [selectedExamType, setSelectedExamType] = useState<ExamType | null>(null);
  const [entProfileSubjectId, setEntProfileSubjectId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    getSubjects(token)
      .then((data) => {
        setSubjects(data);
        setSubjectId(null);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("Не удалось загрузить предметы", "Пәндерді жүктеу мүмкін болмады")),
      );
  }, [uiLanguage]);

  useEffect(() => {
    setLanguage(uiLanguage);
  }, [uiLanguage]);

  useEffect(() => {
    if (!isSettingsModalOpen && !isExamModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || loading) return;
      closeAllModals();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isSettingsModalOpen, isExamModalOpen, loading]);

  const subjectCatalog = useMemo<SubjectCatalogItem[]>(() => {
    const apiByNormalizedName = new Map<string, Subject>();
    for (const subject of subjects) {
      apiByNormalizedName.set(normalizeSubjectName(subject.name_ru), subject);
      apiByNormalizedName.set(normalizeSubjectName(subject.name_kz), subject);
    }

    const catalog = SUBJECT_TEMPLATE.map((item) => {
      if (item.key === "soon") {
        return {
          ...item,
          subject_id: null,
          available: false,
        };
      }

      const match = item.aliases
        .map((alias) => apiByNormalizedName.get(normalizeSubjectName(alias)))
        .find(Boolean);

      return {
        ...item,
        subject_id: match?.id ?? null,
        available: Boolean(match),
      };
    });

    const used = new Set(catalog.filter((item) => item.subject_id !== null).map((item) => item.subject_id as number));
    const extras: SubjectCatalogItem[] = subjects
      .filter((subject) => !used.has(subject.id))
      .map((subject) => ({
        key: `api-${subject.id}`,
        name_ru: subject.name_ru,
        name_kz: subject.name_kz,
        description_ru: "Дополнительный предмет",
        description_kz: "Қосымша пән",
        iconKey: "soon",
        aliases: [],
        subject_id: subject.id,
        available: true,
      }));

    return [...catalog, ...extras];
  }, [subjects]);

  const entProfileOptions = useMemo(() => {
    const lookup = new Map<string, Subject>();
    for (const subject of subjects) {
      lookup.set(normalizeSubjectName(subject.name_ru), subject);
      lookup.set(normalizeSubjectName(subject.name_kz), subject);
    }

    return ENT_PROFILE_SUBJECTS.map((item) => ({
      ...item,
      subject: lookup.get(item.key) || null,
    })).filter((item) => item.subject !== null);
  }, [subjects]);

  useEffect(() => {
    if (entProfileSubjectId) return;
    const first = entProfileOptions[0]?.subject?.id;
    if (first) {
      setEntProfileSubjectId(first);
    }
  }, [entProfileOptions, entProfileSubjectId]);

  const selectedSubject = useMemo(() => subjects.find((item) => item.id === subjectId) || null, [subjects, subjectId]);
  const selectedSubjectTitle = selectedSubject ? (uiLanguage === "RU" ? selectedSubject.name_ru : selectedSubject.name_kz) : "";

  const closeAllModals = () => {
    if (loading) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsSettingsModalOpen(false);
    setIsExamModalOpen(false);
    setSelectedExamType(null);
    setError("");
    setSubjectId(null);
  };

  const openSubjectSettings = (nextSubjectId: number) => {
    setError("");
    setSubjectId(nextSubjectId);
    setIsExamModalOpen(false);
    setSelectedExamType(null);
    setIsSettingsModalOpen(true);
  };

  const openExamSettings = (examType: ExamType) => {
    setError("");
    setSelectedExamType(examType);
    setIsSettingsModalOpen(false);
    setIsExamModalOpen(true);
  };

  const createTest = async () => {
    const token = getToken();
    if (!token) return;

    if (!subjectId) {
      setError(t("Сначала выберите предмет.", "Алдымен пәнді таңдаңыз."));
      return;
    }

    try {
      setLoading(true);
      setError("");

      const test = await generateTest(token, {
        subject_id: subjectId,
        difficulty,
        language,
        mode,
        num_questions: numQuestions,
        time_limit_minutes: timeLimitMinutes,
      });

      router.push(`/test/${test.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Не удалось сгенерировать тест", "Тестті генерациялау мүмкін болмады"));
    } finally {
      setLoading(false);
    }
  };

  const createExam = async () => {
    const token = getToken();
    if (!token) return;
    if (!selectedExamType) {
      setError(t("Выберите экзамен.", "Емтиханды таңдаңыз."));
      return;
    }

    if (selectedExamType === "ent" && !entProfileSubjectId) {
      setError(t("Для ЕНТ выберите профильный предмет.", "ҰБТ үшін бейіндік пәнді таңдаңыз."));
      return;
    }

    try {
      setLoading(true);
      setError("");

      const test = await generateExamTest(token, {
        exam_type: selectedExamType,
        language,
        ent_profile_subject_id: selectedExamType === "ent" ? entProfileSubjectId ?? undefined : undefined,
      });

      router.push(`/test/${test.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("Не удалось создать экзаменационный тест", "Емтихан тестін құру мүмкін болмады"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard roles={["student"]}>
      <AppShell>
        <div className={styles.page}>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{t("Режим прохождения", "Өту режимі")}</h2>
              <p className={styles.sectionSubtitle}>{t("Выберите формат, в котором вам удобнее сдавать тест.", "Тестті қай форматта тапсырған ыңғайлы екенін таңдаңыз.")}</p>
            </div>
            <div className={styles.modeGrid}>
              {MODES.map((item) => (
                <article className={styles.modeItem} key={item.value}>
                  <img
                    className={styles.modeIcon}
                    src={item.icon}
                    alt={uiLanguage === "RU" ? item.title_ru : item.title_kz}
                  />
                  <div>
                    <h3 className={styles.modeTitle}>{uiLanguage === "RU" ? item.title_ru : item.title_kz}</h3>
                    <p className={styles.modeText}>
                      {uiLanguage === "RU" ? item.description_ru : item.description_kz}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{t("Общеобразовательные предметы", "Жалпы білім беру пәндері")}</h2>
              <p className={styles.sectionSubtitle}>{t("Сначала определите предмет, затем настройте параметры теста.", "Алдымен пәнді таңдаңыз, содан кейін тест параметрлерін баптаңыз.")}</p>
            </div>

            <div className={styles.subjectGrid}>
              {subjectCatalog.map((item) => {
                const isActive = item.subject_id === subjectId && item.available;
                const title = uiLanguage === "RU" ? item.name_ru : item.name_kz;
                const description = uiLanguage === "RU" ? item.description_ru : item.description_kz;

                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`${styles.subjectCard} ${isActive ? styles.subjectCardActive : ""} ${!item.available ? styles.subjectCardDisabled : ""}`}
                    onClick={() => {
                      if (!item.available || !item.subject_id) {
                        setError(t("Этот предмет скоро станет доступен.", "Бұл пән жақында қолжетімді болады."));
                        return;
                      }
                      openSubjectSettings(item.subject_id);
                    }}
                  >
                    <img className={styles.subjectIcon} src={ICON_BY_SUBJECT[item.iconKey]} alt={title} />
                    <div className={styles.subjectBody}>
                      <h3 className={styles.subjectTitle}>{title}</h3>
                      <p className={styles.subjectDescription}>{description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{t("Подготовка к важному", "Маңыздысына дайындық")}</h2>
              <p className={styles.sectionSubtitle}>{t("Специальные сценарии ЕНТ и IELTS с отдельными правилами прохождения.", "ЕНТ және IELTS үшін жеке өту ережелері бар арнайы сценарийлер.")}</p>
            </div>

            <div className={styles.examGrid}>
              {EXAM_CARDS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={styles.examCard}
                  onClick={() => openExamSettings(item.key)}
                >
                  <img className={styles.examIcon} src={item.icon} alt={uiLanguage === "RU" ? item.title_ru : item.title_kz} />
                  <div className={styles.subjectBody}>
                    <h3 className={styles.subjectTitle}>{uiLanguage === "RU" ? item.title_ru : item.title_kz}</h3>
                    <p className={styles.subjectDescription}>
                      {uiLanguage === "RU" ? item.description_ru : item.description_kz}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {error && !isSettingsModalOpen && !isExamModalOpen && <div className="errorText">{error}</div>}

          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => router.push("/history")}>
              {t("История попыток", "Талпыныстар тарихы")}
            </Button>
          </div>
        </div>

        {isSettingsModalOpen && (
          <div className={styles.modalOverlay} role="presentation" onClick={closeAllModals}>
            <section
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-label={t("Настройки теста", "Тест баптаулары")}
              onClick={(event) => event.stopPropagation()}
            >
              <header className={styles.modalHeader}>
                <h3>{t("Настройки теста", "Тест баптаулары")}</h3>
                <p>{selectedSubjectTitle ? `${t("Предмет", "Пән")}: ${selectedSubjectTitle}` : t("Настройте тест под свои задачи", "Тестті өз мақсаттарыңызға сай баптаңыз")}</p>
              </header>

              <div className={styles.modalBlock}>
                <span className={styles.settingLabel}>{t("Сложность", "Күрделілік")}</span>
                <div className={styles.choiceRow}>
                  {DIFFICULTIES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`${styles.choiceButton} ${difficulty === item.value ? styles.choiceButtonActive : ""}`}
                      onClick={() => setDifficulty(item.value)}
                    >
                      {uiLanguage === "RU" ? item.title_ru : item.title_kz}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.modalBlock}>
                <span className={styles.settingLabel}>{t("Режим", "Режим")}</span>
                <div className={styles.choiceRow}>
                  {MODES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`${styles.choiceButton} ${mode === item.value ? styles.choiceButtonActive : ""}`}
                      onClick={() => setMode(item.value)}
                    >
                      {uiLanguage === "RU" ? item.title_ru : item.title_kz}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.modalBlock}>
                <span className={styles.settingLabel}>{t("Язык", "Тіл")}</span>
                <div className={styles.choiceRow}>
                  {([
                    { value: "RU", title: t("Русский", "Орысша") },
                    { value: "KZ", title: t("Казахский", "Қазақша") },
                  ] as const).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`${styles.choiceButton} ${language === item.value ? styles.choiceButtonActive : ""}`}
                      onClick={() => setLanguage(item.value)}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.modalBlock}>
                <span className={styles.settingLabel}>{t("Количество вопросов", "Сұрақ саны")}</span>
                <div className={styles.choiceRow}>
                  {QUESTION_COUNTS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`${styles.choiceButton} ${numQuestions === value ? styles.choiceButtonActive : ""}`}
                      onClick={() => setNumQuestions(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.modalBlock}>
                <span className={styles.settingLabel}>{t("Лимит времени", "Уақыт лимиті")}</span>
                <div className={styles.choiceRow}>
                  {TIME_LIMIT_OPTIONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`${styles.choiceButton} ${timeLimitMinutes === value ? styles.choiceButtonActive : ""}`}
                      onClick={() => setTimeLimitMinutes(value)}
                    >
                      {value < 60 ? `${value} ${t("мин", "мин")}` : t("1 час", "1 сағат")}
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="errorText">{error}</div>}

              <div className={styles.modalActions}>
                <Button disabled={loading || !subjectId} onClick={createTest}>
                  {loading ? t("Генерируем тест...", "Тест жасалып жатыр...") : t("Начать тест", "Тестті бастау")}
                </Button>
                <Button variant="ghost" onClick={closeAllModals}>
                  {t("Отмена", "Бас тарту")}
                </Button>
              </div>
            </section>
          </div>
        )}

        {isExamModalOpen && selectedExamType && (
          <div className={styles.modalOverlay} role="presentation" onClick={closeAllModals}>
            <section
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-label={t("Настройки экзамена", "Емтихан баптаулары")}
              onClick={(event) => event.stopPropagation()}
            >
              <header className={styles.modalHeader}>
                <h3>{selectedExamType === "ent" ? t("ЕНТ", "ҰБТ") : "IELTS"}</h3>
                <p>
                  {selectedExamType === "ent"
                    ? t(
                        "Экзаменационный режим: 120 заданий, 240 минут, библиотека вопросов, 1 предупреждение = автозавершение.",
                        "Емтихан режимі: 120 тапсырма, 240 минут, сұрақтар кітапханасы, 1 ескерту = автоматты аяқтау.",
                      )
                    : t(
                        "Экзаменационный режим: Listening (30), Reading (60), Writing (60), Speaking (11-14). 1 предупреждение = автозавершение.",
                        "Емтихан режимі: Listening (30), Reading (60), Writing (60), Speaking (11-14). 1 ескерту = автоматты аяқтау.",
                      )}
                </p>
              </header>

              <div className={styles.modalBlock}>
                <span className={styles.settingLabel}>{t("Язык", "Тіл")}</span>
                <div className={styles.choiceRow}>
                  {([
                    { value: "RU", title: t("Русский", "Орысша") },
                    { value: "KZ", title: t("Казахский", "Қазақша") },
                  ] as const).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`${styles.choiceButton} ${language === item.value ? styles.choiceButtonActive : ""}`}
                      onClick={() => setLanguage(item.value)}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>

              {selectedExamType === "ent" && (
                <>
                  <div className={styles.modalBlock}>
                    <span className={styles.settingLabel}>{t("Профильный предмет (1 из 5)", "Бейіндік пән (5-тен 1)")}</span>
                    <div className={styles.choiceRow}>
                      {entProfileOptions.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          className={`${styles.choiceButton} ${entProfileSubjectId === item.subject?.id ? styles.choiceButtonActive : ""}`}
                          onClick={() => setEntProfileSubjectId(item.subject?.id || null)}
                        >
                          {uiLanguage === "RU" ? item.title_ru : item.title_kz}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.examInfo}>
                    <p><b>{t("Структура ЕНТ (120):", "ҰБТ құрылымы (120):")}</b> {t("История Казахстана (20), Математическая грамотность (10), Грамотность чтения (10), 2 профильных блока по 40.", "Қазақстан тарихы (20), Математикалық сауаттылық (10), Оқу сауаттылығы (10), 2 бейіндік блок 40-тан.")}</p>
                    <p><b>{t("Оценивание:", "Бағалау:")}</b> {t("максимальный балл 140, пороговый балл 50.", "максималды балл 140, шекті балл 50.")}</p>
                    <p><b>{t("Таймер:", "Таймер:")}</b> {t("240 минут с обратным отсчетом.", "240 минут, кері санау.")}</p>
                  </div>
                </>
              )}

              {selectedExamType === "ielts" && (
                <div className={styles.examInfo}>
                  <p><b>{t("Структура IELTS:", "IELTS құрылымы:")}</b> Listening (30 {t("мин", "мин")}), Reading (60 {t("мин", "мин")}), Writing (60 {t("мин", "мин")}), Speaking (11-14 {t("мин", "мин")}).</p>
                  <p>{t("Listening/Reading/Writing выполняются подряд, Speaking выделяется отдельно внутри одного теста.", "Listening/Reading/Writing қатар орындалады, Speaking бір тест ішінде бөлек бөлім ретінде беріледі.")}</p>
                </div>
              )}

              {error && <div className="errorText">{error}</div>}

              <div className={styles.modalActions}>
                <Button disabled={loading} onClick={createExam}>
                  {loading ? t("Готовим экзамен...", "Емтихан дайындалып жатыр...") : t("Начать экзамен", "Емтиханды бастау")}
                </Button>
                <Button variant="ghost" onClick={closeAllModals}>
                  {t("Отмена", "Бас тарту")}
                </Button>
              </div>
            </section>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}
