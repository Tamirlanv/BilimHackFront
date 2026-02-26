import { Language } from "@/lib/types";

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
  language: Language;
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

export function createBlitzQuestionSet(count: number = BLITZ_SESSION_SIZE, language: Language = "RU"): BlitzQuestion[] {
  const shuffled = shuffle(BLITZ_QUESTION_POOL);
  const safeCount = Math.max(1, Math.min(count, shuffled.length));
  return shuffled.slice(0, safeCount).map((item) => localizeBlitzQuestion(item, language));
}

export function buildBlitzResultPayload(
  answers: BlitzAnswerRecord[],
  totalElapsedSeconds: number,
  language: Language = "RU",
): BlitzResultPayload {
  const totalQuestions = answers.length;
  const correctAnswers = answers.filter((item) => item.isCorrect).length;
  const timedOutAnswers = answers.filter((item) => item.timedOut).length;
  const wrongAnswers = Math.max(0, totalQuestions - correctAnswers);
  const percent = totalQuestions > 0 ? roundToOne((correctAnswers / totalQuestions) * 100) : 0;

  const weakTopics = collectWeakTopics(answers, language);
  const recommendation = buildBlitzRecommendation(percent, timedOutAnswers, weakTopics, language);

  return {
    language,
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
    language: parsed.language === "KZ" ? "KZ" : "RU",
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

function collectWeakTopics(answers: BlitzAnswerRecord[], language: Language): string[] {
  const misses = new Map<string, number>();

  for (const item of answers) {
    if (item.isCorrect) continue;
    const topic = item.topic.trim() || (language === "KZ" ? "Жалпы тақырыптар" : "Общие темы");
    misses.set(topic, (misses.get(topic) || 0) + 1);
  }

  return [...misses.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([topic]) => topic);
}

function buildBlitzRecommendation(percent: number, timedOut: number, weakTopics: string[], language: Language): string {
  const weakTopicsText = weakTopics.length > 0
    ? (language === "KZ"
      ? ` Назар аударыңыз: ${weakTopics.join(", ")}.`
      : ` Обратите внимание на темы: ${weakTopics.join(", ")}.`)
    : "";

  if (percent === 100 && timedOut === 0) {
    return language === "KZ"
      ? "Тамаша: блицті қатесіз және уақыт өткізіп алмай өттіңіз. Қарқынды арттырып, нәтижені негізгі тесттерде бекітіңіз."
      : "Отлично: вы прошли блиц без ошибок и без пропусков по времени. Попробуйте увеличить темп и закрепить результат в обычных тестах.";
  }

  if (percent >= 90 && timedOut > 0) {
    return language === "KZ"
      ? "Нәтиже жоғары, бірақ уақыт өтіп кеткен жауаптар бар. Тұрақты прогресс үшін жауапты кідіріссіз беруге тырысыңыз."
      : "Результат высокий, но есть ответы с истекшим временем. Для более устойчивого прогресса старайтесь давать ответы без задержек и без пауз.";
  }

  if (percent >= 85) {
    return language === "KZ"
      ? `Жақсы нәтиже. Дәлдікті 100%-ға жеткізу үшін блицті 1–2 қысқа сессиямен қайталаңыз.${weakTopicsText}`
      : `Хороший результат. Повторите 1–2 короткие сессии блица, чтобы довести точность до 100%.${weakTopicsText}`;
  }

  if (percent >= 65) {
    return language === "KZ"
      ? `Негізгі деңгей жаман емес, бірақ қателер бар. Блицті қайта өтіп, әлсіз тақырыптарды бөлек пысықтаңыз.${weakTopicsText}`
      : `Базовый уровень уверенный, но пока есть ошибки. Сделайте повторный блиц и отдельно проработайте слабые темы.${weakTopicsText}`;
  }

  if (timedOut >= 5) {
    return language === "KZ"
      ? `Қазір негізгі резерв — жауап жылдамдығы. 5–10 минуттық қысқа жаттығулар жасап, таймерді қадағалаңыз.${weakTopicsText}`
      : `Сейчас главный резерв — скорость ответа. Попробуйте тренироваться короткими подходами по 5–10 минут и контролировать таймер.${weakTopicsText}`;
  }

  return language === "KZ"
    ? `Жауап дәлдігін арттыру үшін негізгі тақырыптарды қайталап, блицті қайта өту ұсынылады.${weakTopicsText}`
    : `Рекомендуется повторить ключевые темы и пройти блиц заново, чтобы повысить точность ответов.${weakTopicsText}`;
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

const BLITZ_KZ_TEXT: Record<string, { topic: string; prompt: string }> = {
  "bq-01": { topic: "Математика", prompt: "2 + 2 = 4?" },
  "bq-02": { topic: "Математика", prompt: "x² = 9 теңдеуінің тек бір түбірі бар ма?" },
  "bq-03": { topic: "Математика", prompt: "Квадрат теңдеудің дискриминант формуласы: D = b² - 4ac?" },
  "bq-04": { topic: "Математика", prompt: "sin(90°) мәні 1-ге тең бе?" },
  "bq-05": { topic: "Математика", prompt: "Жай санның екіден көп бөлгіші бар ма?" },
  "bq-06": { topic: "Биология", prompt: "Жасушада АТФ-тің негізгі синтезі митохондрияда жүреді ме?" },
  "bq-07": { topic: "Биология", prompt: "Фотосинтез хлоропластарда жүреді ме?" },
  "bq-08": { topic: "Биология", prompt: "Ересек адамда үш өкпе бар ма?" },
  "bq-09": { topic: "Химия", prompt: "Судың химиялық формуласы — H₂O ма?" },
  "bq-10": { topic: "Физика", prompt: "Дыбыс вакуумда тарала ма?" },
  "bq-11": { topic: "Астрономия", prompt: "Жер Күнді айнала ма?" },
  "bq-12": { topic: "Астрономия", prompt: "Ай планета болып санала ма?" },
  "bq-13": { topic: "География", prompt: "Тынық мұхиты Жердегі ең үлкен мұхит па?" },
  "bq-14": { topic: "География", prompt: "Қазақстанның дүниежүзілік мұхитқа тікелей шығатын жолы бар ма?" },
  "bq-15": { topic: "География", prompt: "Қазақстанның астанасы — Астана ма?" },
  "bq-16": { topic: "География", prompt: "Бойлық солтүстік-оңтүстік бағытын анықтай ма?" },
  "bq-17": { topic: "Тарих", prompt: "Екінші дүниежүзілік соғыс 1945 жылы аяқталды ма?" },
  "bq-18": { topic: "Тарих", prompt: "Қытай қорғанын Айдан жай көзбен көруге бола ма?" },
  "bq-19": { topic: "Тарих", prompt: "Юрий Гагарин ғарышқа ұшқан алғашқы адам ба?" },
  "bq-20": { topic: "Тарих", prompt: "Наполеон Ватерлоо шайқасында жеңіске жетті ме?" },
  "bq-21": { topic: "Орыс тілі", prompt: "А. С. Пушкин «Евгений Онегин» романын жазды ма?" },
  "bq-22": { topic: "Орыс тілі", prompt: "Орыс тілінде «жюри» сөзі әдетте септелмейді ме?" },
  "bq-23": { topic: "Ағылшын тілі", prompt: "go етістігінің өткен шағы — went пе?" },
  "bq-24": { topic: "Ағылшын тілі", prompt: "an артиклі дауыссыз дыбыстың алдында қолданыла ма?" },
  "bq-25": { topic: "Информатика", prompt: "HTML — жалпы мақсаттағы бағдарламалау тілі ме?" },
  "bq-26": { topic: "Информатика", prompt: "Екілік санау жүйесінде 0 және 1 цифрлары қолданыла ма?" },
  "bq-27": { topic: "Информатика", prompt: "Оперативті жад (RAM) қуат өшсе де деректі сақтай ма?" },
  "bq-28": { topic: "Информатика", prompt: "Процессор (CPU) бағдарламалардың нұсқауларын орындай ма?" },
  "bq-29": { topic: "Емтихандар", prompt: "Қазақстанда ҰБТ жоғары оқу орнына түсу форматы ретінде қолданыла ма?" },
  "bq-30": { topic: "Емтихандар", prompt: "IELTS төрт бөлімнен тұра ма: Listening, Reading, Writing және Speaking?" },
  "bq-31": { topic: "Жалпы білім", prompt: "Кібісе жылы 366 күн бола ма?" },
  "bq-32": { topic: "Жалпы білім", prompt: "Бір сағатта 3600 секунд бар ма?" },
  "bq-33": { topic: "Химия", prompt: "pH мәні 7-ден төмен ерітінді қышқыл бола ма?" },
  "bq-34": { topic: "Химия", prompt: "Алтынның химиялық таңбасы — Au ма?" },
  "bq-35": { topic: "Физика", prompt: "Жарық жылы — қашықтық бірлігі ме?" },
  "bq-36": { topic: "Информатика", prompt: "Microsoft Excel — кестелік редактор ма?" },
};

function localizeBlitzQuestion(item: BlitzQuestion, language: Language): BlitzQuestion {
  if (language !== "KZ") {
    return item;
  }

  const localized = BLITZ_KZ_TEXT[item.id];
  if (!localized) return item;
  return {
    ...item,
    topic: localized.topic,
    prompt: localized.prompt,
  };
}
