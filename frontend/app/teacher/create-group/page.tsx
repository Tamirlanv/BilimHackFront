"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Button from "@/components/ui/Button";
import { createTeacherGroup } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { tr, useUiLanguage } from "@/lib/i18n";
import styles from "@/app/teacher/create-group/create-group.module.css";

const MAX_TEACHER_GROUPS = 3;
const MAX_GROUP_MEMBERS = 5;

export default function CreateGroupPage() {
  const router = useRouter();
  const uiLanguage = useUiLanguage();
  const t = (ru: string, kz: string) => tr(uiLanguage, ru, kz);

  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitGroup = async () => {
    const token = getToken();
    if (!token) return;

    const name = groupName.trim();
    if (!name) {
      setError(t("Укажите название группы.", "Топ атауын енгізіңіз."));
      return;
    }

    try {
      setLoading(true);
      setError("");
      const group = await createTeacherGroup(token, { name });
      router.push(`/teacher/groups/${group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Не удалось создать группу", "Топ құру мүмкін болмады"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard roles={["teacher"]}>
      <AppShell>
        <div className={styles.page}>
          <section className={styles.section}>
            <header className={styles.header}>
              <h2>{t("Создать группу", "Топ құру")}</h2>
              <p>{t("Сначала создайте группу, затем добавляйте учеников внутри страницы группы.", "Алдымен топ құрыңыз, содан кейін топ бетінде оқушыларды қосыңыз.")}</p>
            </header>

            <div className={styles.form}>
              <label>
                {t("Название группы", "Топ атауы")}
                <input
                  maxLength={120}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder={t("Например: Программисты 23-1", "Мысалы: Программисты 23-1")}
                  value={groupName}
                />
              </label>

              <div className={styles.actions}>
                <Button variant="secondary" onClick={submitGroup} disabled={loading}>
                  {loading ? t("Сохраняем...", "Сақталуда...") : t("Создать группу", "Топ құру")}
                </Button>
                <Button variant="ghost" onClick={() => router.push("/teacher")}>
                  {t("К списку групп", "Топтар тізіміне")}
                </Button>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.header}>
              <h3>{t("Ограничения", "Шектеулер")}</h3>
            </header>
            <div className={styles.limitBox}>
              <p>{t(`Максимум ${MAX_TEACHER_GROUPS} группы на преподавателя.`, `Оқытушыға ең көбі ${MAX_TEACHER_GROUPS} топ.`)}</p>
              <p>{t(`Максимум ${MAX_GROUP_MEMBERS} учеников в одной группе.`, `Бір топта ең көбі ${MAX_GROUP_MEMBERS} оқушы.`)}</p>
            </div>
          </section>

          {error && <div className="errorText">{error}</div>}
        </div>
      </AppShell>
    </AuthGuard>
  );
}
