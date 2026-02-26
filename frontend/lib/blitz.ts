export const BLITZ_QUESTION_TIME_LIMIT_SECONDS = 15;
export const BLITZ_SESSION_SIZE = 30;
export const BLITZ_LAST_RESULT_KEY = "oku_blitz_last_result";
export const BLITZ_HISTORY_KEY = "oku_blitz_history";

export interface BlitzQuestion {
  id: string;
  prompt: string;
  answer: boolean;
  topic: string;
}

export interface BlitzAnswerRecord {
  questionId: string;
  prompt: string;
  topic: string;
  correctAnswer: boolean;
  userAnswer: boolean | null;
  isCorrect: boolean;
  timedOut: boolean;
  elapsedSeconds: number;
}

export interface BlitzResultPayload {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  timedOutAnswers: number;
  percent: number;
  totalElapsedSeconds: number;
  completedAt: string;
  weakTopics: string[];
  recommendation: string;
  answers: BlitzAnswerRecord[];
}

export const BLITZ_QUESTION_POOL: BlitzQuestion[] = [
  { id: "bq-01", topic: "Математика", prompt: "2 + 2 = 4?", answer: true },
  { id: "bq-02", topic: "Математика", prompt: "Уравнение x² = 9 имеет только один корень?", answer: false },
  { id: "bq-03", topic: "Математика", prompt: "Формула дискриминанта квадратного уравнения: D = b² - 4ac?", answer: true },
  { id: "bq-04", topic: "Математика", prompt: "sin(90°) равен 1?", answer: true },
  { id: "bq-05", topic: "Математика", prompt: "Простое число имеет больше двух делителей?", answer: false },

  { id: "bq-06", topic: "Биология", prompt: "Основной синтез АТФ в клетке происходит в митохондриях?", answer: true },
  { id: "bq-07", topic: "Биология", prompt: "Фотосинтез происходит в хлоропластах?", answer: true },
  { id: "bq-08", topic: "Биология", prompt: "У взрослого человека три легких?", answer: false },

  { id: "bq-09", topic: "Химия", prompt: "Химическая формула воды — H₂O?", answer: true },
  { id: "bq-10", topic: "Физика", prompt: "Звук распространяется в вакууме?", answer: false },

  { id: "bq-11", topic: "Астрономия", prompt: "Земля обращается вокруг Солнца?", answer: true },
  { id: "bq-12", topic: "Астрономия", prompt: "Луна является планетой?", answer: false },

  { id: "bq-13", topic: "География", prompt: "Тихий океан — самый большой океан на Земле?", answer: true },
  { id: "bq-14", topic: "География", prompt: "Казахстан имеет выход к мировому океану?", answer: false },
  { id: "bq-15", topic: "География", prompt: "Столица Казахстана — Астана?", answer: true },
  { id: "bq-16", topic: "География", prompt: "Долгота определяет положение север-юг?", answer: false },

  { id: "bq-17", topic: "История", prompt: "Вторая мировая война закончилась в 1945 году?", answer: true },
  { id: "bq-18", topic: "История", prompt: "Великую китайскую стену видно с Луны невооруженным глазом?", answer: false },
  { id: "bq-19", topic: "История", prompt: "Юрий Гагарин был первым человеком в космосе?", answer: true },
  { id: "bq-20", topic: "История", prompt: "Наполеон победил в битве при Ватерлоо?", answer: false },

  { id: "bq-21", topic: "Русский язык", prompt: "А. С. Пушкин — автор романа в стихах «Евгений Онегин»?", answer: true },
  { id: "bq-22", topic: "Русский язык", prompt: "Слово «жюри» в русском языке обычно не склоняется?", answer: true },

  { id: "bq-23", topic: "Английский язык", prompt: "Прошедшая форма глагола go — went?", answer: true },
  { id: "bq-24", topic: "Английский язык", prompt: "Артикль an ставится перед согласным звуком?", answer: false },

  { id: "bq-25", topic: "Информатика", prompt: "HTML — это язык программирования общего назначения?", answer: false },
  { id: "bq-26", topic: "Информатика", prompt: "Двоичная система счисления использует цифры 0 и 1?", answer: true },
  { id: "bq-27", topic: "Информатика", prompt: "Оперативная память сохраняет данные после выключения питания?", answer: false },
  { id: "bq-28", topic: "Информатика", prompt: "Процессор (CPU) выполняет инструкции программ?", answer: true },

  { id: "bq-29", topic: "Экзамены", prompt: "ЕНТ в Казахстане используется как формат вступительных испытаний в вузы?", answer: true },
  { id: "bq-30", topic: "Экзамены", prompt: "IELTS включает четыре части: Listening, Reading, Writing и Speaking?", answer: true },

  { id: "bq-31", topic: "Общие знания", prompt: "В високосном году 366 дней?", answer: true },
  { id: "bq-32", topic: "Общие знания", prompt: "В одном часе 3600 секунд?", answer: true },
  { id: "bq-33", topic: "Химия", prompt: "Раствор с pH меньше 7 является кислым?", answer: true },
  { id: "bq-34", topic: "Химия", prompt: "Химический символ золота — Au?", answer: true },
  { id: "bq-35", topic: "Физика", prompt: "Световой год — это единица расстояния?", answer: true },
  { id: "bq-36", topic: "Информатика", prompt: "Microsoft Excel — это табличный редактор?", answer: true },
];

export function createBlitzQuestionSet(count: number = BLITZ_SESSION_SIZE): BlitzQuestion[] {
  const shuffled = shuffle(BLITZ_QUESTION_POOL);
  const safeCount = Math.max(1, Math.min(count, shuffled.length));
  return shuffled.slice(0, safeCount);
}

export function buildBlitzResultPayload(
  answers: BlitzAnswerRecord[],
  totalElapsedSeconds: number,
): BlitzResultPayload {
  const totalQuestions = answers.length;
  const correctAnswers = answers.filter((item) => item.isCorrect).length;
  const timedOutAnswers = answers.filter((item) => item.timedOut).length;
  const wrongAnswers = Math.max(0, totalQuestions - correctAnswers);
  const percent = totalQuestions > 0 ? roundToOne((correctAnswers / totalQuestions) * 100) : 0;

  const weakTopics = collectWeakTopics(answers);
  const recommendation = buildBlitzRecommendation(percent, timedOutAnswers, weakTopics);

  return {
    totalQuestions,
    correctAnswers,
    wrongAnswers,
    timedOutAnswers,
    percent,
    totalElapsedSeconds: Math.max(1, Math.round(totalElapsedSeconds || 0)),
    completedAt: new Date().toISOString(),
    weakTopics,
    recommendation,
    answers,
  };
}

export function parseBlitzResultPayload(raw: string | null): BlitzResultPayload | null {
  if (!raw) return null;
  try {
    return normalizeBlitzResultPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readBlitzResultHistory(): BlitzResultPayload[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BLITZ_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeBlitzResultPayload(item))
      .filter((item): item is BlitzResultPayload => Boolean(item));
  } catch {
    return [];
  }
}

export function appendBlitzResultToHistory(payload: BlitzResultPayload): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeBlitzResultPayload(payload);
  if (!normalized) return;

  const current = readBlitzResultHistory();
  const next = [normalized, ...current].slice(0, 100);
  try {
    localStorage.setItem(BLITZ_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}

function normalizeBlitzResultPayload(input: unknown): BlitzResultPayload | null {
  if (!input || typeof input !== "object") return null;

  const parsed = input as Partial<BlitzResultPayload>;
  if (!Array.isArray(parsed.answers)) return null;
  if (typeof parsed.totalQuestions !== "number") return null;
  if (typeof parsed.correctAnswers !== "number") return null;
  if (typeof parsed.percent !== "number") return null;
  if (typeof parsed.recommendation !== "string") return null;

  return {
    totalQuestions: parsed.totalQuestions,
    correctAnswers: parsed.correctAnswers,
    wrongAnswers: Number(parsed.wrongAnswers || 0),
    timedOutAnswers: Number(parsed.timedOutAnswers || 0),
    percent: parsed.percent,
    totalElapsedSeconds: Number(parsed.totalElapsedSeconds || 0),
    completedAt: String(parsed.completedAt || new Date().toISOString()),
    weakTopics: Array.isArray(parsed.weakTopics) ? parsed.weakTopics.filter((item): item is string => typeof item === "string") : [],
    recommendation: parsed.recommendation,
    answers: parsed.answers.filter((item): item is BlitzAnswerRecord => {
      if (!item || typeof item !== "object") return false;
      const answer = item as Partial<BlitzAnswerRecord>;
      return (
        typeof answer.questionId === "string"
        && typeof answer.prompt === "string"
        && typeof answer.topic === "string"
        && typeof answer.correctAnswer === "boolean"
        && (typeof answer.userAnswer === "boolean" || answer.userAnswer === null)
        && typeof answer.isCorrect === "boolean"
        && typeof answer.timedOut === "boolean"
        && typeof answer.elapsedSeconds === "number"
      );
    }),
  };
}

function collectWeakTopics(answers: BlitzAnswerRecord[]): string[] {
  const misses = new Map<string, number>();

  for (const item of answers) {
    if (item.isCorrect) continue;
    const topic = item.topic.trim() || "Общие темы";
    misses.set(topic, (misses.get(topic) || 0) + 1);
  }

  return [...misses.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([topic]) => topic);
}

function buildBlitzRecommendation(percent: number, timedOut: number, weakTopics: string[]): string {
  const weakTopicsText = weakTopics.length > 0 ? ` Обратите внимание на темы: ${weakTopics.join(", ")}.` : "";

  if (percent === 100 && timedOut === 0) {
    return "Отлично: вы прошли блиц без ошибок и без пропусков по времени. Попробуйте увеличить темп и закрепить результат в обычных тестах.";
  }

  if (percent >= 90 && timedOut > 0) {
    return "Результат высокий, но есть ответы с истекшим временем. Для более устойчивого прогресса старайтесь давать ответы без задержек и без пауз.";
  }

  if (percent >= 85) {
    return `Хороший результат. Повторите 1–2 короткие сессии блица, чтобы довести точность до 100%.${weakTopicsText}`;
  }

  if (percent >= 65) {
    return `Базовый уровень уверенный, но пока есть ошибки. Сделайте повторный блиц и отдельно проработайте слабые темы.${weakTopicsText}`;
  }

  if (timedOut >= 5) {
    return `Сейчас главный резерв — скорость ответа. Попробуйте тренироваться короткими подходами по 5–10 минут и контролировать таймер.${weakTopicsText}`;
  }

  return `Рекомендуется повторить ключевые темы и пройти блиц заново, чтобы повысить точность ответов.${weakTopicsText}`;
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function shuffle<T>(items: T[]): T[] {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[randomIndex]] = [output[randomIndex], output[index]];
  }
  return output;
}
