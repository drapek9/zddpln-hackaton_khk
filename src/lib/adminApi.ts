// Admin API (backend/app/api/admin.py, Šimon). Když server neběží nebo admin není přihlášený,
// stránka admina ukáže demo data a uloží váhy jen v prohlížeči.
import type { Role } from "./auth";
import type { Weights } from "./types";
import { notifyUnauthorized } from "./auth";

export type AdminUser = { id: number; email: string; role: Role; blocked: boolean; created_at: string };
export type AuditItem = { id: number; email: string; action: string; detail: string; created_at: string };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (res.status === 401) notifyUnauthorized();
  if (!res.ok) {
    let detail = `Chyba ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // tělo není JSON
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const adminApi = {
  users: () => call<{ items: AdminUser[] }>("/users").then((r) => r.items),
  updateUser: (id: number, patch: { role?: Role; blocked?: boolean }) =>
    call<AdminUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  weights: () => call<{ weights: Weights & { votes?: number }; vote_cap: number }>("/weights"),
  saveWeights: (weights: Weights, voteCap = 10) =>
    call<{ weights: Weights; vote_cap: number }>("/weights", {
      method: "PUT",
      body: JSON.stringify({ weights, vote_cap: voteCap }),
    }),
  audit: (limit = 30) => call<{ items: AuditItem[] }>(`/audit?limit=${limit}`).then((r) => r.items),
};

/** Ukázkoví uživatelé pro demo bez serveru (štítek „demo data“). */
export const DEMO_USERS: AdminUser[] = [
  { id: 1, email: "admin@kraj.example", role: "admin", blocked: false, created_at: "2026-10-15T08:00:00" },
  { id: 2, email: "odbor.dopravy@kraj.example", role: "official", blocked: false, created_at: "2026-10-15T08:05:00" },
  { id: 3, email: "cestmistrovstvi.jicin@kraj.example", role: "official", blocked: false, created_at: "2026-10-15T08:10:00" },
  { id: 4, email: "cestmistrovstvi.nachod@kraj.example", role: "official", blocked: true, created_at: "2026-10-15T08:12:00" },
  { id: 5, email: "obcan@example.cz", role: "citizen", blocked: false, created_at: "2026-10-15T09:30:00" },
];
