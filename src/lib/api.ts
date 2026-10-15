// Klient pro backend (FastAPI za Vite proxy /api). Typy zrcadlí backend/app/core/schemas.py.
// Když endpoint ještě neexistuje (404) nebo backend neběží, volající použije lokální výpočet.
import { notifyUnauthorized } from "./auth";

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
  intensity?: number | null;
  intensity_src?: "csd2025" | "odhad" | null;
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

export type RankingResponse = {
  weights_source: string;
  count: number;
  vypocteno: string;
  items: RankedRoad[];
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

export type RescueObec = {
  kod: string;
  nazev: string;
  obyvatel: number;
  service: "zzs" | "hzs";
  before_min: number;
  after_min: number | null;
  extra_min: number | null;
  over_limit: boolean;
};

export type RescueImpact = {
  closed_road_ids: number[];
  obce: RescueObec[];
  people_slower: number;
  zzs_over_limit: number;
  limit_min: number;
  alerts: ApiAlert[];
  src: string;
  note: string;
};

export type CutOffObec = {
  kod: string;
  nazev: string;
  obyvatel: number;
  studenti: number;
};

export type ClosurePreviewResponse = {
  closure: {
    id?: number;
    road_id: number;
    title: string;
    date_from: string;
    date_to: string;
    restriction: string;
    note?: string | null;
    status: string;
    confirmed: boolean;
    simulated: boolean;
    label: string;
  };
  detour: DetourResult;
  alerts: ApiAlert[];
  announcement: string;
  vehicles_per_day: number | null;
  vehicles_quality: "csd2025" | "odhad" | "chybi";
  citizens_on_route: number;
  students_per_day: number;
  cut_off_obce: CutOffObec[];
  rescue: RescueImpact | null;
  saved: boolean;
};

export class ApiUnavailable extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      // Přihlášení je v httpOnly cookie (kap. 15), posílá se jen na stejný původ.
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch {
    throw new ApiUnavailable("Backend neběží.");
  }
  if (res.status === 401) notifyUnauthorized();
  // D8: Skutečné 404 s JSON obsahem je chyba dotazu/dat (např. neznámý úsek), ne nedostupnost celého API.
  // 502/503/504 a 405 nebo 501 značí nepřítomnost endpointu či proxy chybu.
  if ([501, 502, 503, 504].includes(res.status)) {
    throw new ApiUnavailable(`Backend nedostupný (${res.status}).`);
  }
  if (!res.ok) {
    let detail = `API ${path}: ${res.status}`;
    try {
      const data = await res.json();
      if (data?.detail) detail = String(data.detail);
    } catch {
      if (res.status === 404) {
        throw new ApiUnavailable(`Endpoint ${path} zatím není (404).`);
      }
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean; roads: number; graph_nodes: number }>("/health"),
  ranking: (query: string, signal?: AbortSignal) =>
    request<RankingResponse | RankedRoad[]>(`/ranking${query ? `?${query}` : ""}`, { signal }).then((res) =>
      Array.isArray(res) ? res : res.items,
    ),
  setPin: (body: { road_id: number; priority: PriorityClass; reason?: string | null }) =>
    request<{ road_id: number; priority: PriorityClass; reason: string | null }>("/pins", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deletePin: (roadId: number) =>
    request<{ ok: boolean }>(`/pins/${roadId}`, {
      method: "DELETE",
    }),
  closurePreview: (body: { road_id: number; date_from: string; date_to: string; restriction: string; note?: string | null }) =>
    request<ClosurePreviewResponse>("/closures/preview", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  // Uzavírka se nejdřív založí (návrh), pak potvrdí. Až potvrzení rozešle upozornění občanům na trase.
  confirmClosure: async (body: {
    road_id: number;
    title: string;
    date_from: string;
    date_to: string;
    restriction: string;
    note?: string | null;
    simulated?: boolean;
  }) => {
    const created = await request<{ closure: { id?: number } }>("/closures", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const id = created.closure?.id;
    if (id == null) throw new Error("Server nevrátil číslo uzavírky.");
    return request<{ closure: { id: number; status: string; confirmed: boolean }; notified: number }>(
      `/closures/${id}/confirm`,
      { method: "POST" },
    );
  },
  closure: (body: { road_id: number; date_from: string; date_to: string; restriction: string }) =>
    request<{ detour: DetourResult; alerts: ApiAlert[] }>("/closures", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
