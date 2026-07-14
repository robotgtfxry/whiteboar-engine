// Cienki klient REST — packages/api-client: jedyna droga klientów do backendu (idea.md pkt 4A).

import { type UniDoc } from "@whiteboard/core";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ---- token JWT (localStorage) ----
const TOKEN_KEY = "wb_token";
let token: string | null = localStorage.getItem(TOKEN_KEY);

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export function hasToken() {
  return !!token;
}

// ---- nazwa urządzenia (localStorage) — audyt wersji: „na którym urządzeniu" ----
const DEVICE_KEY = "wb_device";

function device(): string {
  let d = localStorage.getItem(DEVICE_KEY);
  if (!d) {
    const plat = (navigator.platform || navigator.userAgent || "web").replace(/[^\w]+/g, "").slice(0, 12);
    d = `${plat || "web"}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_KEY, d);
  }
  return d;
}

export function deviceName(): string {
  return device();
}

export function setDeviceName(name: string) {
  const trimmed = name.trim();
  if (trimmed) localStorage.setItem(DEVICE_KEY, trimmed);
}

export type UUID = string;
export type AccessLevel = "read" | "edit" | "owner";

export interface User {
  id: UUID;
  email: string;
  display_name: string;
  is_admin: boolean;
  created_at: string;
}

export interface BoardSummary {
  id: UUID;
  title: string;
  owner_id: UUID;
  created_at: string;
  updated_at: string;
}

export interface Board extends BoardSummary {
  document: Record<string, unknown>;
}

export interface Permission {
  id: UUID;
  board_id: UUID;
  user_id: UUID;
  level: AccessLevel;
  created_at: string;
}

export interface BoardVersionSummary {
  id: UUID;
  board_id: UUID;
  title: string;
  note: string | null;
  device: string | null;
  created_by: UUID | null;
  created_by_name: string | null;
  node_count: number;
  created_at: string;
}

export interface BoardVersion extends BoardVersionSummary {
  document: Record<string, unknown>;
}

// Wynik konwersji z backendu (POST /convert). Bogatszy niż importer kliencki:
// niesie ostrzeżenia o utracie/degradacji danych oraz statystyki (idea.md pkt 2/3.2).
export interface ConvertResult {
  document: UniDoc;
  source?: string;
  fidelity?: number;
  warnings: string[];
  stats: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* brak ciała JSON */
    }
    throw new ApiError(res.status, detail);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  // Auth
  async login(email: string, password: string) {
    const body = new URLSearchParams({ username: email, password });
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new ApiError(res.status, d.detail ?? "Logowanie nieudane");
    }
    const data = (await res.json()) as { access_token: string };
    setToken(data.access_token);
    return data;
  },
  me: () => req<User>("/auth/me"),
  logout: () => setToken(null),

  // Konwersja pliku źródłowego na serwerze (kanoniczny importer, idea.md pkt 3.2/3.5).
  // multipart/form-data — NIE ustawiamy Content-Type ręcznie (przeglądarka doda boundary).
  async convert(file: File): Promise<ConvertResult> {
    const form = new FormData();
    form.append("file", file);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}/convert`, { method: "POST", body: form, headers });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        detail = (await res.json()).detail ?? detail;
      } catch {
        /* brak ciała JSON */
      }
      throw new ApiError(res.status, detail);
    }
    return (await res.json()) as ConvertResult;
  },

  // Users
  listUsers: () => req<User[]>("/users"),
  createUser: (body: { email: string; display_name: string; password: string; is_admin?: boolean }) =>
    req<User>("/users", { method: "POST", body: JSON.stringify(body) }),
  deleteUser: (id: UUID) => req<void>(`/users/${id}`, { method: "DELETE" }),

  // Boards
  listBoards: () => req<BoardSummary[]>("/boards"),
  getBoard: (id: UUID) => req<Board>(`/boards/${id}`),
  createBoard: (body: { title: string; document?: Record<string, unknown> }) =>
    req<Board>("/boards", { method: "POST", body: JSON.stringify(body) }),
  updateBoard: (id: UUID, body: { title?: string; document?: Record<string, unknown> }) =>
    req<Board>(`/boards/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "X-Device": device() },
    }),
  deleteBoard: (id: UUID) => req<void>(`/boards/${id}`, { method: "DELETE" }),

  // Import przenośnego kontenera .devbrd → nowa tablica (round-trip między urządzeniami/instancjami).
  async importDevbrd(file: File): Promise<Board> {
    const text = await file.text();
    let container: unknown;
    try {
      container = JSON.parse(text);
    } catch {
      throw new ApiError(400, "Plik .devbrd nie jest poprawnym JSON-em.");
    }
    return req<Board>("/boards/import", { method: "POST", body: JSON.stringify(container) });
  },

  // Historia wersji (audyt: kto / urządzenie / co / kiedy)
  listVersions: (id: UUID) => req<BoardVersionSummary[]>(`/boards/${id}/versions`),
  getVersion: (id: UUID, versionId: UUID) =>
    req<BoardVersion>(`/boards/${id}/versions/${versionId}`),
  saveVersion: (id: UUID, note?: string) =>
    req<BoardVersion>(`/boards/${id}/versions`, {
      method: "POST",
      body: JSON.stringify({ note: note ?? null }),
      headers: { "X-Device": device() },
    }),
  restoreVersion: (id: UUID, versionId: UUID) =>
    req<Board>(`/boards/${id}/versions/${versionId}/restore`, {
      method: "POST",
      headers: { "X-Device": device() },
    }),

  // Permissions
  listPermissions: (boardId: UUID) => req<Permission[]>(`/boards/${boardId}/permissions`),
  grantPermission: (boardId: UUID, body: { user_id: UUID; level: AccessLevel }) =>
    req<Permission>(`/boards/${boardId}/permissions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  revokePermission: (boardId: UUID, userId: UUID) =>
    req<void>(`/boards/${boardId}/permissions/${userId}`, { method: "DELETE" }),
};
