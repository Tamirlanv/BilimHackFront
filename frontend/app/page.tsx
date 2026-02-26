"use client";

import Link from "next/link";

import { tr, useUiLanguage } from "@/lib/i18n";
import { assetPaths } from "@/src/assets";
import styles from "@/app/landing.module.css";

const MODE_ITEMS = [
  {
    title: "Стандартный",
    title_kz: "Стандартты",
    text: "Классический режим: чтение вопроса и ответы в текстовом формате.",
    text_kz: "Классикалық режим: сұрақты оқу және мәтін түрінде жауап беру.",
    icon: assetPaths.icons.text,
  },
  {
    title: "Аудио",
    title_kz: "Аудио",
    text: "Режим, где вы можете воспроизводить вопросы в аудио формате.",
    text_kz: "Сұрақтарды аудио форматта тыңдауға болатын режим.",
    icon: assetPaths.icons.headphones,
  },
  {
    title: "Устный",
    title_kz: "Ауызша",
    text: "Режим для устных ответов: вы говорите, а система оценивает ответ.",
    text_kz: "Ауызша жауап беру режимі: сіз сөйлейсіз, жүйе жауапты бағалайды.",
    icon: assetPaths.icons.microphone,
  },
];

const SUBJECT_ITEMS = [
  {
    title: "Математика",
    title_kz: "Математика",
    text: "Математика для средних классов",
    text_kz: "Орта сыныптарға арналған математика",
    icon: assetPaths.icons.math,
  },
  {
    title: "Алгебра",
    title_kz: "Алгебра",
    text: "Математика для старших классов",
    text_kz: "Жоғары сыныптарға арналған математика",
    icon: assetPaths.icons.algebra,
  },
  {
    title: "Геометрия",
    title_kz: "Геометрия",
    text: "Материал для старших классов",
    text_kz: "Жоғары сыныптарға арналған материал",
    icon: assetPaths.icons.geometry,
  },
];

export default function LandingPage() {
  const uiLanguage = useUiLanguage();
  const t = (ru: string, kz: string) => tr(uiLanguage, ru, kz);

  const modeItems = MODE_ITEMS.map((item) => ({
    ...item,
    title: t(item.title, item.title_kz),
    text: t(item.text, item.text_kz),
  }));
  const subjectItems = SUBJECT_ITEMS.map((item) => ({
    ...item,
    title: t(item.title, item.title_kz),
    text: t(item.text, item.text_kz),
  }));

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <img alt="OKU" className={styles.heroLogo} src={assetPaths.logo.svg} />
          <h1 className={styles.heroTitle}>OKU</h1>
          <p className={styles.heroSubtitle}>{t("Единая платформа превращающая тестирование в инструмент обучения", "Тестілеуді оқу құралына айналдыратын бірыңғай платформа")}</p>
          <div className={styles.heroActions}>
            <Link className={styles.ctaPrimary} href="/register">
              {t("Регистрация", "Тіркелу")}
            </Link>
            <Link className={styles.ctaPrimary} href="/login">
              {t("Войти", "Кіру")}
            </Link>
          </div>
        </section>

        <section className={styles.section}>
          <header className={styles.sectionHeaderCentered}>
            <h2 className={styles.projectTitle}>{t("Про проект", "Жоба туралы")}</h2>
            <p className={styles.projectSubtitle}>{t("Поможет понять то, на что способен проект OKU", "OKU жобасының мүмкіндіктерін түсінуге көмектеседі")}</p>
          </header>

          <div className={styles.goalRow}>
            <article className={styles.goalBlock}>
              <h3 className={styles.goalTitle}>{t("ЦЕЛЬ", "МАҚСАТ")}</h3>
              <p className={styles.goalText}>
                {t(
                  "Сформировать у студентов и педагогов практическую ИИ-грамотность как ключевую компетенцию XXI века",
                  "Студенттер мен педагогтарда XXI ғасырдың негізгі құзыреті ретінде практикалық ЖИ-сауаттылықты қалыптастыру",
                )}
              </p>
            </article>

            <article className={styles.qrBlock}>
              <img alt="QR OKU bot" className={styles.qrImage} src={assetPaths.images.qrOku} />
              <a className={styles.qrButton} href="https://t.me/KOMA_OKU_bot" rel="noreferrer" target="_blank">
                {t("Перейти в OKU", "OKU-ға өту")}
              </a>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <header className={styles.sectionHeaderCentered}>
            <h2 className={styles.sectionTitle}>{t("Режим прохождения", "Өту режимі")}</h2>
            <p className={styles.sectionSubtitle}>{t("Формат в которых возможно сдавать тесты", "Тест тапсыруға болатын форматтар")}</p>
          </header>

          <div className={styles.modeGrid}>
            {modeItems.map((item) => (
              <article className={styles.modeItem} key={item.title}>
                <img alt={item.title} className={styles.modeIcon} src={item.icon} />
                <div className={styles.modeBody}>
                  <h3 className={styles.modeTitle}>{item.title}</h3>
                  <p className={styles.modeText}>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <header className={styles.sectionHeaderCentered}>
            <h2 className={styles.sectionTitle}>{t("Общеобразовательные предметы", "Жалпы білім беру пәндері")}</h2>
            <p className={styles.sectionSubtitle}>{t("Сначала определите предмет, затем настройте параметры теста.", "Алдымен пәнді таңдаңыз, содан кейін тест параметрлерін баптаңыз.")}</p>
          </header>

          <div className={styles.subjectGrid}>
            {subjectItems.map((item) => (
              <article className={styles.subjectItem} key={item.title}>
                <img alt={item.title} className={styles.subjectIcon} src={item.icon} />
                <div>
                  <h3 className={styles.subjectTitle}>{item.title}</h3>
                  <p className={styles.subjectText}>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <header className={styles.sectionHeaderCentered}>
            <h2 className={styles.sectionTitle}>{t("Подготовка к важному", "Маңыздысына дайындық")}</h2>
            <p className={styles.sectionSubtitle}>{t("Подготовка под самые популярные направления", "Ең танымал бағыттарға дайындық")}</p>
          </header>

          <div className={styles.examGrid}>
            <article className={styles.examItem}>
              <img alt="ЕНТ" className={styles.examIcon} src={assetPaths.icons.ent} />
              <div>
                <h3 className={styles.examTitle}>ЕНТ</h3>
                <p className={styles.examText}>{t("Единое национальное тестирование", "Бірыңғай ұлттық тестілеу")}</p>
              </div>
            </article>

            <article className={styles.examItem}>
              <img alt="IELTS" className={styles.examIcon} src={assetPaths.icons.ielts} />
              <div>
                <h3 className={styles.examTitle}>IELTS</h3>
                <p className={styles.examText}>{t("Международная система тестирования по английскому языку", "Ағылшын тілінен халықаралық тестілеу жүйесі")}</p>
              </div>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.goalRow}>
            <article className={styles.goalBlock}>
              <h3 className={styles.goalTitle}>FAQ</h3>
              <p className={styles.goalText}>
                {t(
                  "Получите ответ на все интересующие вас вопросы по проекте и более, мы будем рады на них ответить 24/7",
                  "Жоба бойынша қызықтырған сұрақтардың жауабын алыңыз, біз 24/7 жауап беруге дайынбыз",
                )}
              </p>
            </article>

            <article className={styles.qrBlock}>
              <img alt="QR FAQ bot" className={styles.qrImage} src={assetPaths.images.qrFaq} />
              <a className={styles.qrButton} href="https://t.me/KOMA_FAQ_bot" rel="noreferrer" target="_blank">
                {t("Перейти в FAQ", "FAQ-қа өту")}
              </a>
            </article>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>OKU.com</footer>
    </div>
  );
}
