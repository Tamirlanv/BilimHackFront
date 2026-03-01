import { AuthResponse, User } from "@/lib/types";

const TOKEN_KEY = "oku_token";
const REFRESH_TOKEN_KEY = "oku_refresh_token";
const USER_KEY = "oku_user";

function readSessionValue(key: string): string | null {
  if (typeof window === "undefined") return null;

  const scoped = sessionStorage.getItem(key);
  if (scoped) {
    return scoped;
  }

  // Legacy migration: previous builds used localStorage.
  const legacy = localStorage.getItem(key);
  if (legacy) {
    sessionStorage.setItem(key, legacy);
    localStorage.removeItem(key);
  }
  return legacy;
}

export function saveSession(payload: AuthResponse) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TOKEN_KEY, payload.access_token);
  if (payload.refresh_token) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, payload.refresh_token);
  } else {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  sessionStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  return readSessionValue(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return readSessionValue(REFRESH_TOKEN_KEY);
}

export function updateAccessToken(accessToken: string, refreshToken?: string | null) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  if (typeof refreshToken === "string") {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else if (refreshToken === null) {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function getUser(): User | null {
  const raw = readSessionValue(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}
