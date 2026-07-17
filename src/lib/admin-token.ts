export const ADMIN_TOKEN_KEY = "ayur-admin-token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string) {
  try {
    window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {}
}

export function clearAdminToken() {
  try {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {}
}
