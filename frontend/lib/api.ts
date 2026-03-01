import {
  AuthResponse,
  GroupAnalytics,
  HistoryItem,
  ProfileData,
  ProfileInvitation,
  TeacherGroup,
  TeacherGroupMembers,
  TeacherInvitation,
  GroupWeakTopics,
  StudentProgress,
  StudentDashboard,
  Subject,
  Test,
  TestResult,
} from "@/lib/types";
import { getRefreshToken, getUser, updateAccessToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = normalizeApiPrefix(process.env.NEXT_PUBLIC_API_PREFIX || "/api/v1");
const API_BASE = `${API_URL}${API_PREFIX}`;

const CACHE_NS = "oku_cache";
const CACHE_TTL = {
  subjects: 6 * 60 * 60 * 1000,
  progress: 30 * 1000,
  history: 30 * 1000,
  dashboard: 30 * 1000,
} as const;

let refreshPromise: Promise<string | null> | null = null;

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: "no-store",
    credentials: "include",
  });

  if (
    response.status === 401 &&
    token &&
    !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/register") &&
    !path.startsWith("/auth/refresh")
  ) {
    const refreshedAccessToken = await tryRefreshToken();
    if (refreshedAccessToken) {
      headers.set("Authorization", `Bearer ${refreshedAccessToken}`);
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        cache: "no-store",
        credentials: "include",
      });
    }
  }

  if (!response.ok) {
    let detail = `Request failed / Сұрау қатесі: ${response.status}`;
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {
      // ignore parse error and keep default message
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return {} as T;
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength === "0") {
    return {} as T;
  }

  return (await response.json()) as T;
}

function normalizeApiPrefix(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function userScopedCacheKey(key: string): string | null {
  if (typeof window === "undefined") return null;
  const user = getUser();
  if (!user) return null;
  return `${CACHE_NS}:${user.id}:${key}`;
}

function readCachedJson<T>(key: string, ttlMs: number): T | null {
  if (typeof window === "undefined") return null;
  const scopedKey = userScopedCacheKey(key);
  if (!scopedKey) return null;
  try {
    const raw = localStorage.getItem(scopedKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; payload: T };
    if (!parsed || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > ttlMs) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}

function writeCachedJson<T>(key: string, payload: T): void {
  if (typeof window === "undefined") return;
  const scopedKey = userScopedCacheKey(key);
  if (!scopedKey) return;
  try {
    localStorage.setItem(
      scopedKey,
      JSON.stringify({
        ts: Date.now(),
        payload,
      }),
    );
  } catch {
    // no-op
  }
}

function clearCachedKey(key: string): void {
  if (typeof window === "undefined") return;
  const scopedKey = userScopedCacheKey(key);
  if (!scopedKey) return;
  localStorage.removeItem(scopedKey);
}

function invalidateStudentCaches(): void {
  clearCachedKey("history");
  clearCachedKey("progress");
  clearCachedKey("dashboard");
}

async function tryRefreshToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken();
  }
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined,
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as { access_token?: string; refresh_token?: string | null };
  if (!payload.access_token) return null;
  updateAccessToken(payload.access_token, payload.refresh_token ?? refreshToken ?? null);
  return payload.access_token;
}

export function register(body: {
  email: string;
  full_name: string;
  username: string;
  password: string;
  role: "student" | "teacher";
  preferred_language: "RU" | "KZ";
  education_level?: "school" | "college" | "university" | null;
  direction?: string | null;
  group_id?: number | null;
}) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function login(body: { email: string; password: string }) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getSubjects(token: string) {
  const cached = readCachedJson<Subject[]>("subjects", CACHE_TTL.subjects);
  if (cached) {
    return Promise.resolve(cached);
  }
  return apiRequest<Subject[]>("/subjects", {}, token).then((payload) => {
    writeCachedJson("subjects", payload);
    return payload;
  });
}

export function generateTest(
  token: string,
  body: {
    subject_id: number;
    difficulty: "easy" | "medium" | "hard";
    language: "RU" | "KZ";
    mode: "text" | "audio" | "oral";
    num_questions: number;
    time_limit_minutes?: 5 | 10 | 20 | 30 | 60;
  },
) {
  return apiRequest<Test>("/tests/generate", {
    method: "POST",
    body: JSON.stringify(body),
  }, token);
}

export function generateExamTest(
  token: string,
  body: {
    exam_type: "ent" | "ielts";
    language: "RU" | "KZ";
    ent_profile_subject_id?: number;
  },
) {
  return apiRequest<Test>("/tests/generate-exam", {
    method: "POST",
    body: JSON.stringify(body),
  }, token);
}

export function generateMistakesTest(
  token: string,
  body: {
    subject_id?: number;
    difficulty?: "easy" | "medium" | "hard";
    language?: "RU" | "KZ";
    num_questions?: number;
  } = {},
) {
  return apiRequest<Test>("/tests/generate-from-mistakes", {
    method: "POST",
    body: JSON.stringify(body),
  }, token);
}

export function getTest(token: string, testId: number) {
  return apiRequest<Test>(`/tests/${testId}`, {}, token);
}

export async function getQuestionTtsAudio(token: string, testId: number, questionId: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/tests/${testId}/questions/${questionId}/tts`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Превышено время ожидания серверного TTS.");
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Не удалось выполнить запрос TTS.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let detail = `Request failed / Сұрау қатесі: ${response.status}`;
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {
      // ignore parse error and keep default message
    }
    throw new Error(detail);
  }

  return response.blob();
}

export function submitTest(
  token: string,
  testId: number,
  body: {
    answers: Array<{ question_id: number; student_answer_json: Record<string, unknown> }>;
    telemetry?: {
      elapsed_seconds?: number;
      warnings?: Array<{
        type: string;
        at_seconds: number;
        question_id?: number | null;
        details?: Record<string, unknown>;
      }>;
    };
  },
) {
  return apiRequest<TestResult>(`/tests/${testId}/submit`, {
    method: "POST",
    body: JSON.stringify(body),
  }, token).then((payload) => {
    invalidateStudentCaches();
    return payload;
  });
}

export function getTestResult(token: string, testId: number) {
  return apiRequest<TestResult>(`/tests/${testId}/result`, {}, token);
}

export function regenerateRecommendation(token: string, testId: number) {
  return apiRequest<TestResult["recommendation"]>(`/tests/${testId}/recommendations/regenerate`, {
    method: "POST",
  }, token).then((payload) => {
    invalidateStudentCaches();
    return payload;
  });
}

export function getHistory(token: string) {
  const cached = readCachedJson<HistoryItem[]>("history", CACHE_TTL.history);
  if (cached) {
    return Promise.resolve(cached);
  }
  return apiRequest<HistoryItem[]>("/students/me/history", {}, token).then((payload) => {
    writeCachedJson("history", payload);
    return payload;
  });
}

export function getProgress(token: string) {
  const cached = readCachedJson<StudentProgress>("progress", CACHE_TTL.progress);
  if (cached) {
    return Promise.resolve(cached);
  }
  return apiRequest<StudentProgress>("/students/me/progress", {}, token).then((payload) => {
    writeCachedJson("progress", payload);
    return payload;
  });
}

export function getDashboard(token: string) {
  const cached = readCachedJson<StudentDashboard>("dashboard", CACHE_TTL.dashboard);
  if (cached) {
    return Promise.resolve(cached);
  }
  return apiRequest<StudentDashboard>("/students/me/dashboard", {}, token).then((payload) => {
    writeCachedJson("dashboard", payload);
    // Keep dedicated caches warm for pages that still call individual endpoints.
    writeCachedJson("progress", payload.progress);
    writeCachedJson("history", payload.history);
    return payload;
  });
}

export function getGroupAnalytics(token: string, groupId: number) {
  return apiRequest<GroupAnalytics>(`/teacher/groups/${groupId}/analytics`, {}, token);
}

export function getGroupWeakTopics(token: string, groupId: number) {
  return apiRequest<GroupWeakTopics>(`/teacher/groups/${groupId}/weak-topics`, {}, token);
}

export function getStudentProgressByTeacher(token: string, studentId: number) {
  return apiRequest<StudentProgress>(`/teacher/students/${studentId}/progress`, {}, token);
}

export function getStudentHistoryByTeacher(token: string, studentId: number) {
  return apiRequest<HistoryItem[]>(`/teacher/students/${studentId}/history`, {}, token);
}

export function getTeacherGroups(token: string) {
  return apiRequest<TeacherGroup[]>("/teacher/groups", {}, token);
}

export function createTeacherGroup(
  token: string,
  body: { name: string; student_ids?: number[] },
) {
  return apiRequest<TeacherGroup>("/teacher/groups", {
    method: "POST",
    body: JSON.stringify(body),
  }, token);
}

export function getTeacherGroupMembers(token: string, groupId: number) {
  return apiRequest<TeacherGroupMembers>(`/teacher/groups/${groupId}/members`, {}, token);
}

export function sendTeacherInvitation(token: string, body: { username: string; group_id?: number }) {
  return apiRequest<TeacherInvitation>("/teacher/invitations", {
    method: "POST",
    body: JSON.stringify(body),
  }, token);
}

export function getTeacherInvitations(token: string) {
  return apiRequest<TeacherInvitation[]>("/teacher/invitations", {}, token);
}

export function cancelTeacherInvitation(token: string, invitationId: number) {
  return apiRequest<{}>(`/teacher/invitations/${invitationId}`, {
    method: "DELETE",
  }, token);
}

export function removeTeacherGroupMember(token: string, groupId: number, studentId: number) {
  return apiRequest<{}>(`/teacher/groups/${groupId}/members/${studentId}`, {
    method: "DELETE",
  }, token);
}

export function getMyProfile(token: string) {
  return apiRequest<ProfileData>("/profile/me", {}, token);
}

export function respondInvitation(
  token: string,
  invitationId: number,
  action: "accept" | "decline",
) {
  return apiRequest<ProfileInvitation>(`/profile/invitations/${invitationId}/${action}`, {
    method: "POST",
  }, token);
}
