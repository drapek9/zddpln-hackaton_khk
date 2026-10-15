// Klient pro backend (FastAPI za Vite proxy /api). Typy zrcadlí backend/app/core/schemas.py.
// Když endpoint ještě neexistuje (404) nebo backend neběží, volající použije lokální výpočet.

export type PriorityClass = "kriticka" | "vysoka" | "stredni" | "nizka";
export type AlertLevel = "critical" | "warning" | "info";

export type ApiAlert = { level: AlertLevel; title: string; detail: string };

export type Pin = { road_id: number; priority: PriorityClass; reason?: string | null };

export type RoadSummary = {
  id: number;
  usek: string;
  sil: string;
  trida: string;
  okres: string;
  stav: string;
  rok: number;
  delka_m: number;
  last_repair: number | null;
  obce: string[];
  lines: string[];
};

export type RankedRoad = {
  road: RoadSummary;
  score: number;
  model_class: PriorityClass;
  priority: PriorityClass;
  pinned: boolean;
  pin_reason: string | null;
  rank: number;
  votes: number;
};

export type DetourResult = {
  road_id: number;
  found: boolean;
  closed_km: number;
  detour_km: number | null;
  extra_km: number | null;
  extra_min: number | null;
  geometry: [number, number][];
  via_road_ids: number[];
  havarijni_km: number;
  class1_km: number;
  note: string;
};

export class ApiUnavailable extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch {
    throw new ApiUnavailable("Backend neběží.");
  }
  // Vite bez backendu vrací 404/502/504, chybějící endpoint 404/405.
  if ([404, 405, 501, 502, 503, 504].includes(res.status)) {
    throw new ApiUnavailable(`Endpoint ${path} zatím není (${res.status}).`);
  }
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean; roads: number; graph_nodes: number }>("/health"),
  ranking: (query: string) => request<RankedRoad[]>(`/ranking${query ? `?${query}` : ""}`),
  closure: (body: { road_id: number; date_from: string; date_to: string; restriction: string }) =>
    request<{ detour: DetourResult; alerts: ApiAlert[] }>("/closures", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
