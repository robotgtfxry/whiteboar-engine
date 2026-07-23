// Ustawienia klienta trzymane w localStorage. `wb_api_url` jest też odczytywane
// przez @whiteboard/api-client (patrz BASE tam) — dlatego zmiana wymaga przeładowania okna.

const API_URL_KEY = "wb_api_url";
const SHARE_BASE_KEY = "wb_share_base";

const DEFAULT_API_URL = "http://localhost:8000";
const DEFAULT_SHARE_BASE = "http://localhost:5173";

export function getApiUrl(): string {
  return localStorage.getItem(API_URL_KEY) ?? DEFAULT_API_URL;
}

export function setApiUrl(value: string): void {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed) localStorage.setItem(API_URL_KEY, trimmed);
  else localStorage.removeItem(API_URL_KEY);
}

// Bazowy URL publicznego klienta (web), z którego budujemy link do pokoju.
// W desktopie window.location nie jest linkiem, którym można się podzielić.
export function getShareBase(): string {
  return localStorage.getItem(SHARE_BASE_KEY) ?? DEFAULT_SHARE_BASE;
}

export function setShareBase(value: string): void {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed) localStorage.setItem(SHARE_BASE_KEY, trimmed);
  else localStorage.removeItem(SHARE_BASE_KEY);
}

export function roomLink(roomId: string): string {
  return `${getShareBase()}/room/${roomId}`;
}

export const DEFAULTS = { apiUrl: DEFAULT_API_URL, shareBase: DEFAULT_SHARE_BASE };
