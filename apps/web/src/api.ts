// Cienki klient REST — odpowiednik przyszłego packages/api-client (idea.md pkt 4A).

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
    req<Board>(`/boards/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteBoard: (id: UUID) => req<void>(`/boards/${id}`, { method: "DELETE" }),

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
