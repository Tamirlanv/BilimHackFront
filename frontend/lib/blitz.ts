import { Language } from "@/lib/types";

export const BLITZ_QUESTION_TIME_LIMIT_SECONDS = 15;
export const BLITZ_SESSION_SIZE = 30;
export const BLITZ_QUESTION_COUNT_OPTIONS = [10, 15, 20, 25, 30] as const;
export const BLITZ_LAST_RESULT_KEY = "oku_blitz_last_result";
export const BLITZ_HISTORY_KEY = "oku_blitz_history";

export type BlitzDifficulty = "easy" | "medium" | "hard";

export interface BlitzQuestion {
  id: string;
  prompt: string;
  answer: boolean;
  topic: string;
  difficulty?: BlitzDifficulty;
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

const BLITZ_BASE_QUESTION_POOL: BlitzQuestion[] = [
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
  { id: "bq-37", topic: "Математика", prompt: "Сумма углов треугольника равна 180°?", answer: true },
  { id: "bq-38", topic: "Математика", prompt: "Число π равно ровно 3?", answer: false },
  { id: "bq-39", topic: "Математика", prompt: "Число 0 считается натуральным во всех школьных курсах?", answer: false },
  { id: "bq-40", topic: "Математика", prompt: "Квадрат любого числа неотрицателен?", answer: true },
  { id: "bq-41", topic: "Физика", prompt: "Сила измеряется в ньютонах?", answer: true },
  { id: "bq-42", topic: "Физика", prompt: "Скорость света в вакууме примерно 300 000 км/с?", answer: true },
  { id: "bq-43", topic: "Физика", prompt: "Электрический ток измеряется в вольтах?", answer: false },
  { id: "bq-44", topic: "Физика", prompt: "При трении часть энергии переходит в тепло?", answer: true },
  { id: "bq-45", topic: "Химия", prompt: "NaCl — это поваренная соль?", answer: true },
  { id: "bq-46", topic: "Химия", prompt: "Химический символ кислорода — O₂?", answer: false },
  { id: "bq-47", topic: "Химия", prompt: "Углекислый газ имеет формулу CO₂?", answer: true },
  { id: "bq-48", topic: "Химия", prompt: "Щелочная среда имеет pH ниже 7?", answer: false },
  { id: "bq-49", topic: "Биология", prompt: "ДНК хранит наследственную информацию?", answer: true },
  { id: "bq-50", topic: "Биология", prompt: "Эритроциты переносят кислород?", answer: true },
  { id: "bq-51", topic: "Биология", prompt: "У растений нет клеточной стенки?", answer: false },
  { id: "bq-52", topic: "Биология", prompt: "Сердце человека имеет четыре камеры?", answer: true },
  { id: "bq-53", topic: "История", prompt: "Казахское ханство образовано в XV веке?", answer: true },
  { id: "bq-54", topic: "История", prompt: "Первая мировая война началась в 1939 году?", answer: false },
  { id: "bq-55", topic: "История", prompt: "Декларация независимости США подписана в 1876 году?", answer: false },
  { id: "bq-56", topic: "История", prompt: "Римская империя возникла после Французской революции?", answer: false },
  { id: "bq-57", topic: "География", prompt: "Нил часто считают самой длинной рекой мира?", answer: true },
  { id: "bq-58", topic: "География", prompt: "Экватор делит Землю на восточное и западное полушария?", answer: false },
  { id: "bq-59", topic: "География", prompt: "Антарктида покрыта льдом большую часть года?", answer: true },
  { id: "bq-60", topic: "География", prompt: "Гималаи находятся в Южной Америке?", answer: false },
  { id: "bq-61", topic: "Русский язык", prompt: "В слове «жизнь» после «ж» пишется «и»?", answer: true },
  { id: "bq-62", topic: "Русский язык", prompt: "В русском языке десять падежей?", answer: false },
  { id: "bq-63", topic: "Русский язык", prompt: "Причастие может отвечать на вопросы какой? какая?", answer: true },
  { id: "bq-64", topic: "Русский язык", prompt: "Слово «кофе» в норме только среднего рода?", answer: false },
  { id: "bq-65", topic: "Английский язык", prompt: "Present Perfect строится как have/has + V3?", answer: true },
  { id: "bq-66", topic: "Английский язык", prompt: "Названия месяцев в английском всегда пишутся со строчной буквы?", answer: false },
  { id: "bq-67", topic: "Английский язык", prompt: "There is обычно используется с единственным числом?", answer: true },
  { id: "bq-68", topic: "Английский язык", prompt: "Слово children — форма единственного числа?", answer: false },
  { id: "bq-69", topic: "Информатика", prompt: "Один байт равен 8 битам?", answer: true },
  { id: "bq-70", topic: "Информатика", prompt: "SQL используют только для редактирования изображений?", answer: false },
  { id: "bq-71", topic: "Информатика", prompt: "Linux является полностью закрытой проприетарной системой?", answer: false },
  { id: "bq-72", topic: "Информатика", prompt: "HTTP — это протокол передачи гипертекста?", answer: true },
  { id: "bq-73", topic: "Информатика", prompt: "GPU обычно не подходит для параллельных вычислений?", answer: false },
  { id: "bq-74", topic: "Экзамены", prompt: "В IELTS Speaking обычно проходит отдельно от других секций?", answer: true },
  { id: "bq-75", topic: "Экзамены", prompt: "В ЕНТ профильные предметы не влияют на итоговый результат?", answer: false },
  { id: "bq-76", topic: "Общие знания", prompt: "В одной неделе восемь дней?", answer: false },
  { id: "bq-77", topic: "Общие знания", prompt: "Человек может дышать под водой без оборудования?", answer: false },
  { id: "bq-78", topic: "Общие знания", prompt: "У Солнца есть планетная система?", answer: true },
  { id: "bq-79", topic: "Общие знания", prompt: "Один литр равен 1000 миллилитров?", answer: true },
  { id: "bq-80", topic: "Алгебра", prompt: "Верно ли: a^m · a^n = a^(m+n)?", answer: true },
  { id: "bq-81", topic: "Алгебра", prompt: "Верно ли: (a^m)^n = a^(m+n)?", answer: false },
  { id: "bq-82", topic: "Геометрия", prompt: "Диагонали квадрата равны?", answer: true },
  { id: "bq-83", topic: "Геометрия", prompt: "У прямоугольника все стороны равны?", answer: false },
  { id: "bq-84", topic: "Физика", prompt: "Закон Ома можно записать как I = U/R?", answer: true },
  { id: "bq-85", topic: "Химия", prompt: "При нормальном давлении вода кипит при 80°C?", answer: false },
  { id: "bq-86", topic: "Химия", prompt: "Метан имеет химическую формулу CH₃?", answer: false },
];

const BLITZ_MEDIUM_QUESTION_POOL: BlitzQuestion[] = [
  { id: "bq-87", topic: "Алгебра", prompt: "Если a > b и c > 0, то ac > bc?", answer: true, difficulty: "medium" },
  { id: "bq-88", topic: "Алгебра", prompt: "Если a > b и c < 0, то ac > bc?", answer: false, difficulty: "medium" },
  { id: "bq-89", topic: "Алгебра", prompt: "log₂(8) = 3?", answer: true, difficulty: "medium" },
  { id: "bq-90", topic: "Алгебра", prompt: "Производная x² равна 2x?", answer: true, difficulty: "medium" },
  { id: "bq-91", topic: "Геометрия", prompt: "В прямоугольном треугольнике выполняется теорема Пифагора c² = a² + b²?", answer: true, difficulty: "medium" },
  { id: "bq-92", topic: "Геометрия", prompt: "Медианы треугольника пересекаются в центре описанной окружности?", answer: false, difficulty: "medium" },
  { id: "bq-93", topic: "Алгебра", prompt: "sin²x + cos²x = 1 для любого x?", answer: true, difficulty: "medium" },
  { id: "bq-94", topic: "Алгебра", prompt: "Уравнение x² - 5x + 6 = 0 имеет корни 2 и 3?", answer: true, difficulty: "medium" },
  { id: "bq-95", topic: "Информатика", prompt: "В реляционной БД первичный ключ должен быть уникальным?", answer: true, difficulty: "medium" },
  { id: "bq-96", topic: "Информатика", prompt: "Стандарт JSON допускает комментарии внутри файла?", answer: false, difficulty: "medium" },
  { id: "bq-97", topic: "Информатика", prompt: "Асимптотика O(n log n) при больших n растет медленнее, чем O(n²)?", answer: true, difficulty: "medium" },
  { id: "bq-98", topic: "Информатика", prompt: "TCP гарантирует порядок доставки пакетов?", answer: true, difficulty: "medium" },
  { id: "bq-99", topic: "Информатика", prompt: "DNS служит для преобразования доменного имени в IP-адрес?", answer: true, difficulty: "medium" },
  { id: "bq-100", topic: "Информатика", prompt: "Кэш процессора обычно медленнее оперативной памяти?", answer: false, difficulty: "medium" },
  { id: "bq-101", topic: "Физика", prompt: "Ускорение измеряется в м/с²?", answer: true, difficulty: "medium" },
  { id: "bq-102", topic: "Физика", prompt: "При свободном падении без сопротивления воздуха ускорение зависит от массы тела?", answer: false, difficulty: "medium" },
  { id: "bq-103", topic: "Физика", prompt: "Уравнение состояния идеального газа: PV = nRT?", answer: true, difficulty: "medium" },
  { id: "bq-104", topic: "Физика", prompt: "В последовательной электрической цепи сила тока одинакова на всех участках?", answer: true, difficulty: "medium" },
  { id: "bq-105", topic: "Химия", prompt: "При 25°C раствор с pH = 7 считается нейтральным?", answer: true, difficulty: "medium" },
  { id: "bq-106", topic: "Химия", prompt: "Окисление — это присоединение электронов?", answer: false, difficulty: "medium" },
  { id: "bq-107", topic: "Химия", prompt: "NaOH относится к основаниям?", answer: true, difficulty: "medium" },
  { id: "bq-108", topic: "Химия", prompt: "Катализатор полностью расходуется в реакции?", answer: false, difficulty: "medium" },
  { id: "bq-109", topic: "Биология", prompt: "В результате митоза образуются две генетически близкие дочерние клетки?", answer: true, difficulty: "medium" },
  { id: "bq-110", topic: "Биология", prompt: "Рибосомы участвуют в синтезе белка?", answer: true, difficulty: "medium" },
  { id: "bq-111", topic: "Биология", prompt: "В ДНК вместо тимина содержится урацил?", answer: false, difficulty: "medium" },
  { id: "bq-112", topic: "Биология", prompt: "Фотосинтез происходит в митохондриях?", answer: false, difficulty: "medium" },
  { id: "bq-113", topic: "История", prompt: "Первая мировая война началась в 1914 году?", answer: true, difficulty: "medium" },
  { id: "bq-114", topic: "История", prompt: "В ходе Холодной войны США и СССР вели прямую полномасштабную войну друг против друга?", answer: false, difficulty: "medium" },
  { id: "bq-115", topic: "Литература", prompt: "А. С. Пушкин является автором «Капитанской дочки»?", answer: true, difficulty: "medium" },
  { id: "bq-116", topic: "Русский язык", prompt: "Инфинитив в русском языке отвечает на вопросы «что делать?» и «что сделать?»?", answer: true, difficulty: "medium" },
];

const BLITZ_HARD_QUESTION_POOL: BlitzQuestion[] = [
  { id: "bq-117", topic: "Алгебра", prompt: "Если определитель квадратной матрицы равен нулю, то система Ax=b не может иметь единственного решения?", answer: true, difficulty: "hard" },
  { id: "bq-118", topic: "Математический анализ", prompt: "∫(1/x)dx всегда равно ln(x)+C без дополнительных условий?", answer: false, difficulty: "hard" },
  { id: "bq-119", topic: "Математический анализ", prompt: "Производная функции e^x равна e^x?", answer: true, difficulty: "hard" },
  { id: "bq-120", topic: "Математический анализ", prompt: "Предел sin(x)/x при x→0 равен 1?", answer: true, difficulty: "hard" },
  { id: "bq-121", topic: "Алгебра", prompt: "Общий член арифметической прогрессии: a_n = a_1 + n·d?", answer: false, difficulty: "hard" },
  { id: "bq-122", topic: "Геометрия", prompt: "У любого параллелограмма диагонали равны?", answer: false, difficulty: "hard" },
  { id: "bq-123", topic: "Геометрия", prompt: "Радиус, проведенный в точку касания окружности, перпендикулярен касательной?", answer: true, difficulty: "hard" },
  { id: "bq-124", topic: "Геометрия", prompt: "Только правильные многоугольники можно вписать в окружность?", answer: false, difficulty: "hard" },
  { id: "bq-125", topic: "Геометрия", prompt: "В прямоугольном треугольнике медиана к гипотенузе равна половине гипотенузы?", answer: true, difficulty: "hard" },
  { id: "bq-126", topic: "Геометрия", prompt: "В любом треугольнике обязательно существует угол не меньше 90°?", answer: false, difficulty: "hard" },
  { id: "bq-127", topic: "Информатика", prompt: "Для всех NP-полных задач уже найдены полиномиальные алгоритмы?", answer: false, difficulty: "hard" },
  { id: "bq-128", topic: "Информатика", prompt: "Base64 — это алгоритм шифрования данных?", answer: false, difficulty: "hard" },
  { id: "bq-129", topic: "Информатика", prompt: "INNER JOIN в SQL возвращает только строки с совпадениями в обеих таблицах?", answer: true, difficulty: "hard" },
  { id: "bq-130", topic: "Информатика", prompt: "Наличие HTTPS гарантирует, что сайт не является фишинговым?", answer: false, difficulty: "hard" },
  { id: "bq-131", topic: "Информатика", prompt: "Для взаимной блокировки (deadlock) необходимы четыре условия Коффмана?", answer: true, difficulty: "hard" },
  { id: "bq-132", topic: "Информатика", prompt: "Число 0.1 обычно не представимо точно в двоичном формате IEEE-754?", answer: true, difficulty: "hard" },
  { id: "bq-133", topic: "Физика", prompt: "Мгновенная скорость — это производная координаты по времени?", answer: true, difficulty: "hard" },
  { id: "bq-134", topic: "Физика", prompt: "В изолированной системе энтропия не убывает?", answer: true, difficulty: "hard" },
  { id: "bq-135", topic: "Физика", prompt: "Работа силы трения по замкнутому контуру всегда равна нулю?", answer: false, difficulty: "hard" },
  { id: "bq-136", topic: "Химия", prompt: "Изотопы одного элемента имеют одинаковое число протонов, но разное число нейтронов?", answer: true, difficulty: "hard" },
  { id: "bq-137", topic: "Химия", prompt: "Окислитель в ОВР отдает электроны?", answer: false, difficulty: "hard" },
  { id: "bq-138", topic: "Химия", prompt: "По принципу Ле Шателье повышение давления смещает равновесие в сторону меньшего числа молекул газа?", answer: true, difficulty: "hard" },
  { id: "bq-139", topic: "Химия", prompt: "Все соли хорошо растворимы в воде?", answer: false, difficulty: "hard" },
  { id: "bq-140", topic: "Биология", prompt: "Кроссинговер происходит в мейозе?", answer: true, difficulty: "hard" },
  { id: "bq-141", topic: "Биология", prompt: "Кодон AUG обычно кодирует метионин?", answer: true, difficulty: "hard" },
  { id: "bq-142", topic: "Биология", prompt: "В соматических клетках человека 46 хромосом?", answer: true, difficulty: "hard" },
  { id: "bq-143", topic: "Биология", prompt: "Любая мутация обязательно вредна для организма?", answer: false, difficulty: "hard" },
  { id: "bq-144", topic: "История", prompt: "Версальский договор был подписан в 1919 году?", answer: true, difficulty: "hard" },
  { id: "bq-145", topic: "История", prompt: "Эпоха Возрождения началась в Северной Европе?", answer: false, difficulty: "hard" },
  { id: "bq-146", topic: "Литература", prompt: "Роман «Война и мир» написал Ф. М. Достоевский?", answer: false, difficulty: "hard" },
];

export const BLITZ_QUESTION_POOL: BlitzQuestion[] = [
  ...BLITZ_BASE_QUESTION_POOL,
  ...BLITZ_MEDIUM_QUESTION_POOL,
  ...BLITZ_HARD_QUESTION_POOL,
];

export function createBlitzQuestionSet(
  count: number = BLITZ_SESSION_SIZE,
  language: Language = "RU",
  difficulty: BlitzDifficulty = "easy",
): BlitzQuestion[] {
  const sourcePool = BLITZ_QUESTION_POOL.filter((item) => (item.difficulty ?? "easy") === difficulty);
  const fallbackPool = sourcePool.length > 0 ? sourcePool : BLITZ_QUESTION_POOL;
  const shuffled = shuffle(fallbackPool);
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
  "bq-37": { topic: "Математика", prompt: "Үшбұрыш бұрыштарының қосындысы 180°-қа тең бе?" },
  "bq-38": { topic: "Математика", prompt: "π саны дәл 3-ке тең бе?" },
  "bq-39": { topic: "Математика", prompt: "0 саны барлық мектеп бағдарламасында натурал сан ба?" },
  "bq-40": { topic: "Математика", prompt: "Кез келген санның квадраты теріс емес пе?" },
  "bq-41": { topic: "Физика", prompt: "Күш ньютонмен өлшенеді ме?" },
  "bq-42": { topic: "Физика", prompt: "Вакуумдағы жарық жылдамдығы шамамен 300 000 км/с пе?" },
  "bq-43": { topic: "Физика", prompt: "Электр тогы вольтпен өлшенеді ме?" },
  "bq-44": { topic: "Физика", prompt: "Үйкеліс кезінде энергияның бір бөлігі жылуға айнала ма?" },
  "bq-45": { topic: "Химия", prompt: "NaCl — ас тұзы ма?" },
  "bq-46": { topic: "Химия", prompt: "Оттегінің химиялық символы O₂ ме?" },
  "bq-47": { topic: "Химия", prompt: "Көмірқышқыл газының формуласы CO₂ ме?" },
  "bq-48": { topic: "Химия", prompt: "Сілтілік ортада pH 7-ден төмен бола ма?" },
  "bq-49": { topic: "Биология", prompt: "ДНҚ тұқымқуалаушылық ақпаратты сақтай ма?" },
  "bq-50": { topic: "Биология", prompt: "Эритроциттер оттегіні тасымалдай ма?" },
  "bq-51": { topic: "Биология", prompt: "Өсімдік жасушасында жасуша қабырғасы болмай ма?" },
  "bq-52": { topic: "Биология", prompt: "Адам жүрегінде төрт камера бар ма?" },
  "bq-53": { topic: "Тарих", prompt: "Қазақ хандығы XV ғасырда құрылды ма?" },
  "bq-54": { topic: "Тарих", prompt: "Бірінші дүниежүзілік соғыс 1939 жылы басталды ма?" },
  "bq-55": { topic: "Тарих", prompt: "АҚШ тәуелсіздік декларациясы 1876 жылы қабылданды ма?" },
  "bq-56": { topic: "Тарих", prompt: "Рим империясы Француз революциясынан кейін пайда болды ма?" },
  "bq-57": { topic: "География", prompt: "Ніл өзені жиі ең ұзын өзен деп есептеле ме?" },
  "bq-58": { topic: "География", prompt: "Экватор Жерді шығыс және батыс жартышарға бөле ме?" },
  "bq-59": { topic: "География", prompt: "Антарктида жылдың көп бөлігінде мұзбен жабыла ма?" },
  "bq-60": { topic: "География", prompt: "Гималай таулары Оңтүстік Америкада орналасқан ба?" },
  "bq-61": { topic: "Орыс тілі", prompt: "«жизнь» сөзінде «ж»-дан кейін «и» жазыла ма?" },
  "bq-62": { topic: "Орыс тілі", prompt: "Орыс тілінде он септік бар ма?" },
  "bq-63": { topic: "Орыс тілі", prompt: "Есімше «қандай?» сұрағына жауап бере ала ма?" },
  "bq-64": { topic: "Орыс тілі", prompt: "«кофе» сөзі нормада тек орта тек пе?" },
  "bq-65": { topic: "Ағылшын тілі", prompt: "Present Perfect формуласы have/has + V3 пе?" },
  "bq-66": { topic: "Ағылшын тілі", prompt: "Ағылшында ай атаулары әрқашан кіші әріппен жазыла ма?" },
  "bq-67": { topic: "Ағылшын тілі", prompt: "There is көбіне жекеше түрмен қолданыла ма?" },
  "bq-68": { topic: "Ағылшын тілі", prompt: "children сөзі жекеше түр ме?" },
  "bq-69": { topic: "Информатика", prompt: "Бір байт 8 битке тең бе?" },
  "bq-70": { topic: "Информатика", prompt: "SQL тек сурет өңдеу үшін қолданыла ма?" },
  "bq-71": { topic: "Информатика", prompt: "Linux толықтай жабық проприетарлық жүйе ме?" },
  "bq-72": { topic: "Информатика", prompt: "HTTP — гипермәтін жіберу протоколы ма?" },
  "bq-73": { topic: "Информатика", prompt: "GPU әдетте параллель есептеулерге жарамсыз ба?" },
  "bq-74": { topic: "Емтихандар", prompt: "IELTS Speaking бөлімі көбіне басқа бөлімдерден бөлек өте ме?" },
  "bq-75": { topic: "Емтихандар", prompt: "ҰБТ-да бейіндік пәндер қорытынды нәтижеге әсер етпей ме?" },
  "bq-76": { topic: "Жалпы білім", prompt: "Бір аптада сегіз күн бар ма?" },
  "bq-77": { topic: "Жалпы білім", prompt: "Адам арнайы құралсыз су астында дем ала ала ма?" },
  "bq-78": { topic: "Жалпы білім", prompt: "Күннің планеталық жүйесі бар ма?" },
  "bq-79": { topic: "Жалпы білім", prompt: "Бір литр 1000 миллилитрге тең бе?" },
  "bq-80": { topic: "Алгебра", prompt: "a^m · a^n = a^(m+n) теңдігі дұрыс па?" },
  "bq-81": { topic: "Алгебра", prompt: "(a^m)^n = a^(m+n) теңдігі дұрыс па?" },
  "bq-82": { topic: "Геометрия", prompt: "Квадраттың диагональдары тең бе?" },
  "bq-83": { topic: "Геометрия", prompt: "Тік төртбұрыштың барлық қабырғалары тең бе?" },
  "bq-84": { topic: "Физика", prompt: "Ом заңы I = U/R түрінде жазыла ма?" },
  "bq-85": { topic: "Химия", prompt: "Қалыпты қысымда су 80°C-та қайнай ма?" },
  "bq-86": { topic: "Химия", prompt: "Метанның формуласы CH₃ пе?" },
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
