// Admin API (backend/app/api/admin.py, Šimon). Když server neběží nebo admin není přihlášený,
// stránka admina ukáže demo data a uloží váhy jen v prohlížeči.
import type { Role } from "./auth";
import type { Weights } from "./types";
import { notifyUnauthorized } from "./auth";

export type AdminUser = { id: number; email: string; role: Role; blocked: boolean; created_at: string };
export type AuditItem = { id: number; email: string; action: string; detail: string; created_at: string };
export type AccessRequest = {
  id: number;
  email: string;
  name: string | null;
  organization: string | null;
  job_title: string | null;
  email_verified: boolean;
  official_domain: boolean;
  verify_url: string | null;
  created_at: string;
};
export type AdminOverview = {
  users_by_role: Record<string, number>;
  pending_requests: number;
  closures_by_status: Record<string, number>;
  notifications: number;
  last_audit: { email: string; action: string; detail: string; created_at: string } | null;
  snapshot: { roads: number; updated_label?: string | null };
  ai_enabled: boolean;
  ai_configured: boolean;
  push_configured: boolean;
};
export type AiStatus = { provider: string; configured: boolean; enabled: boolean; model: string | null };

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
  // Strop hlasů posílat ten načtený, jinak by se přepsal na výchozí (NAPADY D5).
  saveWeights: async (weights: Weights, voteCap?: number) => {
    const cap = voteCap ?? (await call<{ vote_cap: number }>("/weights")).vote_cap;
    return call<{ weights: Weights; vote_cap: number }>("/weights", {
      method: "PUT",
      body: JSON.stringify({ weights, vote_cap: cap }),
    });
  },
  overview: () => call<AdminOverview>("/overview"),
  accessRequests: () => call<{ items: AccessRequest[] }>("/access-requests").then((r) => r.items),
  approve: (id: number) => call<AccessRequest>(`/access-requests/${id}/approve`, { method: "POST" }),
  reject: (id: number, reason: string) =>
    call<{ id: number; status: string }>(`/access-requests/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  ai: () => call<AiStatus>("/ai"),
  setAi: (enabled: boolean) => call<AiStatus>("/ai", { method: "PUT", body: JSON.stringify({ enabled }) }),
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
