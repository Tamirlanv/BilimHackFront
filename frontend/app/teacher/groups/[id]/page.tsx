"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import AuthGuard from "@/components/AuthGuard";
import Button from "@/components/ui/Button";
import {
  getTeacherGroupMembers,
  getTeacherInvitations,
  sendTeacherInvitation,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { tr, useUiLanguage } from "@/lib/i18n";
import { TeacherGroupMembers, TeacherInvitation } from "@/lib/types";
import styles from "@/app/teacher/groups/[id]/group-detail.module.css";

const MAX_GROUP_MEMBERS = 5;

function buildStudentAnalyticsHref(studentId: number, studentName?: string) {
  const params = new URLSearchParams();
  const normalizedName = (studentName || "").trim();
  if (normalizedName) {
    params.set("name", normalizedName);
  }
  const query = params.toString();
  return query ? `/teacher/students/${studentId}?${query}` : `/teacher/students/${studentId}`;
}

export default function TeacherGroupDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const groupId = Number(params.id);
  const uiLanguage = useUiLanguage();
  const t = (ru: string, kz: string) => tr(uiLanguage, ru, kz);

  const [group, setGroup] = useState<TeacherGroupMembers | null>(null);
  const [invitations, setInvitations] = useState<TeacherInvitation[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const groupInvitations = useMemo(
    () => invitations.filter((item) => item.group_id === groupId).slice(0, 8),
    [groupId, invitations],
  );
  const groupFull = Boolean(group && group.members.length >= MAX_GROUP_MEMBERS);

  const loadData = async (silent = false) => {
    const token = getToken();
    if (!token || !Number.isFinite(groupId)) return;

    if (!silent) {
      setLoading(true);
    }
    try {
      const [membersPayload, invitationsPayload] = await Promise.all([
        getTeacherGroupMembers(token, groupId),
        getTeacherInvitations(token),
      ]);
      setGroup(membersPayload);
      setInvitations(invitationsPayload);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Не удалось загрузить группу", "Топты жүктеу мүмкін болмады"));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData().catch((err) => {
      setLoading(false);
      setError(err instanceof Error ? err.message : t("Не удалось загрузить группу", "Топты жүктеу мүмкін болмады"));
    });

    const timer = window.setInterval(() => {
      loadData(true).catch(() => undefined);
    }, 12000);

    return () => {
      window.clearInterval(timer);
    };
  }, [groupId]);

  const sendInviteToGroup = async () => {
    const token = getToken();
    if (!token || !Number.isFinite(groupId)) return;
    if (groupFull) {
      setError(t("В этой группе уже достигнут лимит участников.", "Бұл топта қатысушылар лимиті толды."));
      return;
    }

    const username = inviteUsername.trim();
    if (!username) {
      setError(t("Введите username ученика.", "Оқушының username-ын енгізіңіз."));
      return;
    }

    try {
      setInviteLoading(true);
      setError("");
      setSuccess("");
      await sendTeacherInvitation(token, { username, group_id: groupId });
      setInviteUsername("");
      setInviteModalOpen(false);
      setSuccess(t("Приглашение отправлено. После принятия ученик автоматически появится в группе.", "Шақыру жіберілді. Қабылдағаннан кейін оқушы топта автоматты түрде пайда болады."));
      await loadData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Не удалось отправить приглашение", "Шақыру жіберу мүмкін болмады"));
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <AuthGuard roles={["teacher"]}>
      <AppShell>
        <div className={styles.page}>
          <header className={styles.header}>
            <div>
              <h2>{group?.name || t("Группа", "Топ")}</h2>
              <p>{t("Список участников и быстрый переход к аналитике ученика.", "Қатысушылар тізімі және оқушы аналитикасына жылдам өту.")}</p>
            </div>
            <Button onClick={() => setInviteModalOpen(true)} disabled={groupFull}>
              {t("Добавить ученика", "Оқушы қосу")}
            </Button>
          </header>
          {group && (
            <p className="muted">
              {t("Участников", "Қатысушы")}: {group.members.length} / {MAX_GROUP_MEMBERS}
            </p>
          )}

          {loading && <p className="muted">{t("Загрузка...", "Жүктелуде...")}</p>}
          {error && <div className="errorText">{error}</div>}
          {success && <p className={styles.success}>{success}</p>}

          {!loading && group && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("Ученик", "Оқушы")}</th>
                    <th>Username</th>
                    <th>{t("Тестов", "Тест саны")}</th>
                    <th>{t("Средний балл", "Орташа ұпай")}</th>
                    <th>{t("Предупреждения", "Ескертулер")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {group.members.map((member) => (
                    <tr key={member.student_id}>
                      <td>{member.full_name || member.username}</td>
                      <td>@{member.username}</td>
                      <td>{member.tests_count}</td>
                      <td>{member.avg_percent}%</td>
                      <td>{member.warnings_count}</td>
                      <td>
                        <Button
                          variant="secondary"
                          onClick={() => router.push(buildStudentAnalyticsHref(member.student_id, member.full_name || member.username))}
                        >
                          {t("Открыть", "Ашу")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && group && group.members.length === 0 && (
            <p className="muted">{t("В этой группе пока нет учеников.", "Бұл топта әзірге оқушылар жоқ.")}</p>
          )}

          <section className={styles.invitationSection}>
            <h3>{t("Приглашения в группу", "Топқа шақырулар")}</h3>
            {groupInvitations.length === 0 ? (
              <p className="muted">{t("Пока приглашений для этой группы нет.", "Бұл топ үшін шақырулар әзірге жоқ.")}</p>
            ) : (
              <div className={styles.invitationList}>
                {groupInvitations.map((invitation) => (
                  <article className={styles.invitationCard} key={invitation.id}>
                    <div>
                      <h4>{invitation.student_name || invitation.student_username}</h4>
                      <p>@{invitation.student_username}</p>
                    </div>
                    <span className={`${styles.status} ${styles[invitation.status]}`}>{statusLabel(invitation.status, uiLanguage)}</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {inviteModalOpen && (
          <div className={styles.modalOverlay} onClick={() => setInviteModalOpen(false)} role="presentation">
            <section className={styles.modal} onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className={styles.close}
                onClick={() => setInviteModalOpen(false)}
                aria-label={t("Закрыть", "Жабу")}
              >
                <X size={16} />
              </button>
              <h3>{t("Добавить ученика в группу", "Оқушыны топқа қосу")}</h3>
              <p>{t("Введите username ученика. Он получит приглашение в разделе профиля.", "Оқушының username-ын енгізіңіз. Ол профиль бөлімінде шақыру алады.")}</p>
              <label>
                {t("Username ученика", "Оқушы username-ы")}
                <input
                  maxLength={25}
                  placeholder={t("например student_demo_1", "мысалы student_demo_1")}
                  value={inviteUsername}
                  onChange={(event) => setInviteUsername(event.target.value)}
                />
              </label>
              <div className={styles.modalActions}>
                <Button onClick={sendInviteToGroup} disabled={inviteLoading}>
                  {inviteLoading ? t("Отправляем...", "Жіберілуде...") : t("Отправить приглашение", "Шақыру жіберу")}
                </Button>
                <Button variant="ghost" onClick={() => setInviteModalOpen(false)}>{t("Отмена", "Бас тарту")}</Button>
              </div>
            </section>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}

function statusLabel(status: TeacherInvitation["status"], language: "RU" | "KZ"): string {
  if (status === "accepted") return tr(language, "Принято", "Қабылданды");
  if (status === "declined") return tr(language, "Отклонено", "Қабылданбады");
  return tr(language, "Ожидает", "Күтілуде");
}
