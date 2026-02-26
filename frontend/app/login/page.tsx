"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import Button from "@/components/ui/Button";
import { login } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { tr, useUiLanguage } from "@/lib/i18n";
import { assetPaths } from "@/src/assets";

export default function LoginPage() {
  const router = useRouter();
  const uiLanguage = useUiLanguage();
  const t = (ru: string, kz: string) => tr(uiLanguage, ru, kz);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await login({ email, password });
      saveSession(response);
      router.push(response.user.role === "teacher" ? "/teacher" : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Не удалось выполнить вход", "Кіру орындалмады"));
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
            <h2 className="authTitle">{t("Вход в OKU", "OKU-ға кіру")}</h2>
            <p className="authText">{t("Используйте аккаунт студента или преподавателя.", "Оқушы немесе оқытушы аккаунтын қолданыңыз.")}</p>
          </div>
        </div>

        <form className="formGrid" onSubmit={handleSubmit}>
          <label>
            {t("Почта", "Электрондық пошта")}
            <input onChange={(e) => setEmail(e.target.value)} type="email" value={email} />
          </label>

          <label>
            {t("Пароль", "Құпиясөз")}
            <input onChange={(e) => setPassword(e.target.value)} type="password" value={password} />
          </label>

          {error && <div className="errorText">{error}</div>}

          <Button block disabled={loading} type="submit">
            {loading ? t("Выполняем вход...", "Кіру орындалып жатыр...") : t("Войти", "Кіру")}
          </Button>
        </form>

        <p className="authText" style={{ marginTop: 14 }}>
          {t("Нет аккаунта?", "Аккаунт жоқ па?")} <Link href="/register">{t("Регистрация", "Тіркелу")}</Link>
        </p>
      </div>
    </div>
  );
}
