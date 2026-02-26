"use client";

import { useEffect, useState } from "react";

import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Button from "@/components/ui/Button";
import { getMyProfile, respondInvitation } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { tr, useUiLanguage } from "@/lib/i18n";
import { ProfileData, ProfileInvitation } from "@/lib/types";
import styles from "@/app/profile/profile.module.css";

export default function ProfilePage() {
  const uiLanguage = useUiLanguage();
  const t = (ru: string, kz: string) => tr(uiLanguage, ru, kz);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadProfile = async () => {
    const token = getToken();
    if (!token) return;
    const payload = await getMyProfile(token);
    setProfile(payload);
  };

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const token = getToken();
        if (!token) return;
        const payload = await getMyProfile(token);
        if (!cancelled) {
          setProfile(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("Не удалось загрузить профиль", "Профильді жүктеу мүмкін болмады"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }

      intervalId = window.setInterval(async () => {
        if (cancelled) return;
        const token = getToken();
        if (!token) return;
        try {
          const payload = await getMyProfile(token);
          if (!cancelled) {
            setProfile(payload);
          }
        } catch {
          // Silent polling errors: keep UI stable.
        }
      }, 3000);
    })();
    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const handleInvitation = async (invitation: ProfileInvitation, action: "accept" | "decline") => {
    const token = getToken();
    if (!token) return;
    try {
      setUpdatingId(invitation.id);
      setError("");
      await respondInvitation(token, invitation.id, action);
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Не удалось обновить приглашение", "Шақыруды жаңарту мүмкін болмады"));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AuthGuard>
      <AppShell>
        <div className={styles.page}>
          <section className={styles.section}>
            <header className={styles.header}>
              <h2>{t("Профиль", "Профиль")}</h2>
              <p>{t("Основная информация вашего аккаунта.", "Аккаунтыңыздың негізгі ақпараты.")}</p>
            </header>

            {loading && <p className="muted">{t("Загрузка...", "Жүктелуде...")}</p>}
            {error && <div className="errorText">{error}</div>}

            {profile && (
              <div className={styles.infoGrid}>
                <article className={styles.infoCard}>
                  <h3>{t("Пользователь", "Пайдаланушы")}</h3>
                  <p><b>{t("Имя", "Аты")}:</b> {profile.full_name || "—"}</p>
                  <p><b>Username:</b> @{profile.username}</p>
                  <p><b>{t("Роль", "Рөлі")}:</b> {profile.role === "teacher" ? t("Преподаватель", "Оқытушы") : t("Студент", "Оқушы")}</p>
                </article>
                <article className={styles.infoCard}>
                  <h3>{t("Обучение", "Оқу")}</h3>
                  <p><b>{t("Почта", "Электрондық пошта")}:</b> {profile.email}</p>
                  <p><b>{t("Язык", "Тіл")}:</b> {profile.preferred_language || "—"}</p>
                  <p><b>{t("Статус", "Мәртебе")}:</b> {educationLabel(profile.education_level, uiLanguage)}</p>
                  <p><b>{t("Направление", "Бағыты")}:</b> {profile.direction || "—"}</p>
                  <p><b>{t("Группа", "Топ")}:</b> {profile.group_name || t("Не назначена", "Тағайындалмаған")}</p>
                </article>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <header className={styles.header}>
              <h3>{t("Приглашения", "Шақырулар")}</h3>
              <p>
                {profile?.role === "teacher"
                  ? t("Статусы приглашений, которые вы отправили ученикам.", "Оқушыларға жіберген шақыруларыңыздың мәртебелері.")
                  : t("Здесь отображаются приглашения от преподавателей.", "Мұнда оқытушылар жіберген шақырулар көрсетіледі.")}
              </p>
              <div className={styles.actions}>
                <Button variant="ghost" onClick={loadProfile}>
                  {t("Обновить", "Жаңарту")}
                </Button>
              </div>
            </header>

            {profile && profile.invitations.length > 0 ? (
              <div className={styles.invitationList}>
                {profile.invitations.map((invitation) => (
                  <article className={styles.invitationCard} key={invitation.id}>
                    <div className={styles.invitationMeta}>
                      <p className={styles.teacherName}>
                        {profile.role === "teacher"
                          ? `${t("Ученик", "Оқушы")}: ${invitation.teacher_name}`
                          : invitation.teacher_name}
                      </p>
                      <span className={`${styles.status} ${styles[invitation.status]}`}>{statusLabel(invitation.status, uiLanguage)}</span>
                    </div>
                    <p className={styles.invitationDate}>
                      {t("Отправлено", "Жіберілді")}: {new Date(invitation.created_at).toLocaleString(uiLanguage === "KZ" ? "kk-KZ" : "ru-RU")}
                    </p>
                    {invitation.group_name && (
                      <p className={styles.invitationDate}>
                        {t("Группа", "Топ")}: {invitation.group_name}
                      </p>
                    )}
                    {invitation.status === "pending" && profile.role === "student" && (
                      <div className={styles.actions}>
                        <Button
                          onClick={() => handleInvitation(invitation, "accept")}
                          disabled={updatingId === invitation.id}
                        >
                          {t("Принять", "Қабылдау")}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleInvitation(invitation, "decline")}
                          disabled={updatingId === invitation.id}
                        >
                          {t("Отклонить", "Бас тарту")}
                        </Button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">{t("Приглашений пока нет.", "Әзірге шақырулар жоқ.")}</p>
            )}
          </section>
        </div>
      </AppShell>
    </AuthGuard>
  );
}

function educationLabel(value: string | null | undefined, language: "RU" | "KZ"): string {
  if (value === "school") return tr(language, "Школьник", "Мектеп оқушысы");
  if (value === "college") return tr(language, "Студент колледжа", "Колледж студенті");
  if (value === "university") return tr(language, "Студент университета", "Университет студенті");
  return "—";
}

function statusLabel(value: ProfileInvitation["status"], language: "RU" | "KZ"): string {
  if (value === "accepted") return tr(language, "Принято", "Қабылданды");
  if (value === "declined") return tr(language, "Отклонено", "Қабылданбады");
  return tr(language, "Ожидает ответа", "Жауап күтілуде");
}
