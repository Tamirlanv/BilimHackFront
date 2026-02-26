"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import Button from "@/components/ui/Button";
import { register } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { tr, useUiLanguage } from "@/lib/i18n";
import { EducationLevel, UserRole } from "@/lib/types";
import { assetPaths } from "@/src/assets";

export default function RegisterPage() {
  const router = useRouter();
  const uiLanguage = useUiLanguage();
  const t = (ru: string, kz: string) => tr(uiLanguage, ru, kz);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("school");
  const [direction, setDirection] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const usernameValue = username.trim();
    if (!/^[A-Za-z0-9_]{3,25}$/.test(usernameValue)) {
      setLoading(false);
      setError(
        t(
          "Имя пользователя: только латинские буквы, цифры и _, длина 3-25 символов.",
          "Пайдаланушы аты: тек латын әріптері, сандар және _, ұзындығы 3-25 таңба.",
        ),
      );
      return;
    }

    try {
      const payload = await register({
        email,
        full_name: fullName,
        username: usernameValue,
        education_level: role === "student" ? educationLevel : undefined,
        direction: role === "student" ? direction.trim() : undefined,
        password,
        role,
        preferred_language: "RU",
      });
      saveSession(payload);
      router.push(payload.user.role === "teacher" ? "/teacher" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Не удалось создать аккаунт", "Аккаунт құру мүмкін болмады"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authPage">
      <div className="authCard">
        <div className="authHeader">
          <img className="authLogo" src={assetPaths.logo.png} alt="OKU" />
          <div>
            <h2 className="authTitle">{t("Регистрация в OKU", "OKU-да тіркелу")}</h2>
            <p className="authText">{t("Создайте профиль и начните обучение.", "Профиль құрып, оқуды бастаңыз.")}</p>
          </div>
        </div>

        <form className="formGrid" onSubmit={handleSubmit}>
          <label>
            {t("Почта", "Электрондық пошта")}
            <input onChange={(e) => setEmail(e.target.value)} required type="email" value={email} />
          </label>

          <label>
            {t("Имя и фамилия", "Аты-жөні")}
            <input onChange={(e) => setFullName(e.target.value)} required value={fullName} />
          </label>

          <label>
            {t("Имя пользователя", "Пайдаланушы аты")}
            <input
              maxLength={25}
              onChange={(e) => setUsername(e.target.value)}
              pattern="[A-Za-z0-9_]{3,25}"
              required
              title={t("Только латинские буквы, цифры и _, длина 3-25 символов", "Тек латын әріптері, сандар және _, ұзындығы 3-25 таңба")}
              value={username}
            />
          </label>

          <label>
            {t("Роль", "Рөлі")}
            <select onChange={(e) => setRole(e.target.value as UserRole)} value={role}>
              <option value="student">{t("Студент", "Оқушы")}</option>
              <option value="teacher">{t("Преподаватель (админ)", "Оқытушы (админ)")}</option>
            </select>
          </label>

          {role === "student" && (
            <label>
              {t("Статус обучения", "Оқу мәртебесі")}
              <select onChange={(e) => setEducationLevel(e.target.value as EducationLevel)} value={educationLevel}>
                <option value="school">{t("Школьник", "Мектеп оқушысы")}</option>
                <option value="college">{t("Студент колледжа", "Колледж студенті")}</option>
                <option value="university">{t("Студент университета", "Университет студенті")}</option>
              </select>
            </label>
          )}

          {role === "student" && (
            <label>
              {t("Направление", "Бағыты")}
              <input onChange={(e) => setDirection(e.target.value)} placeholder={t("Например: ИТ, медицина, экономика", "Мысалы: IT, медицина, экономика")} required value={direction} />
            </label>
          )}

          <label>
            {t("Пароль", "Құпиясөз")}
            <input
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error && <div className="errorText">{error}</div>}

          <Button block disabled={loading} type="submit">
            {loading ? t("Создаём профиль...", "Профиль құрылып жатыр...") : t("Зарегистрироваться", "Тіркелу")}
          </Button>
        </form>

        <p className="authText" style={{ marginTop: 14 }}>
          {t("Уже есть аккаунт?", "Аккаунтыңыз бар ма?")} <Link href="/login">{t("Войти", "Кіру")}</Link>
        </p>
      </div>
    </div>
  );
}
