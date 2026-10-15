// Simulátor uzavírky (★1): objížďka a varování k ní.
// Pořadí zdrojů: POST /api/closures (S5, Šimon) → předpočítaný snímek public/demo/detours.json
// (spočítaný jádrem backend/app/core, Engine.detour) → bez objížďky.
import { api, ApiUnavailable, type ApiAlert, type DetourResult } from "./api";
import { inSchoolYear } from "./geo";

export type DetourSource = "api" | "snapshot" | "none";

type SnapshotRow = DetourResult & { alerts_school: ApiAlert[]; alerts_holiday: ApiAlert[] };
type Snapshot = { generated: string; note: string; detours: Record<string, SnapshotRow> };

/** Ukázkové uzavírky pro demo: vybrané z top žebříčku (školy, linky, IZS, znatelná objížďka). */
export const DEMO_CLOSURES: { roadId: number; label: string; story: string }[] = [
  { roadId: 581, label: "II/324 u Hradce Králové", story: "nevyhovující úsek s 8 linkami, objížďka přes 11 km" },
  { roadId: 2372, label: "II/502 na Jičínsku", story: "havarijní úsek, nemocnice a IZS v dosahu" },
  { roadId: 1940, label: "III/300 na Jičínsku", story: "SUPERhavarijní, krátká objížďka, 19 škol v okolí" },
];

let snapshot: Promise<Snapshot | null> | null = null;

function loadSnapshot() {
  snapshot ??= fetch("/demo/detours.json")
    .then((r) => (r.ok ? (r.json() as Promise<Snapshot>) : null))
    .catch(() => null);
  return snapshot;
}

export type ClosureResult = {
  source: DetourSource;
  detour: DetourResult | null;
  /** Varování k objížďce (havarijní úseky na objížďce, I. třída, prodloužení, dojezd ZZS/HZS, kolize). */
  detourAlerts: ApiAlert[];
  generated?: string;
  announcement?: string;
  vehiclesPerDay?: number | null;
  vehiclesQuality?: "csd2025" | "odhad" | "chybi";
  citizensOnRoute?: number;
  studentsPerDay?: number;
  cutOffObce?: import("./api").CutOffObec[];
  rescue?: import("./api").RescueImpact | null;
};

// API vrací dojezd IZS jako { items, label, note }, typ v api.ts čeká { obce, … }. Sjednotíme tady.
function normalizeRescue(raw: unknown): import("./api").RescueImpact | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const list = (Array.isArray(r.obce) ? r.obce : Array.isArray(r.items) ? r.items : []) as Record<string, unknown>[];
  // Položky mají buď anglické názvy (schemas.py), nebo české (services/collisions.py).
  const obce = list.map((o) => ({
    kod: String(o.kod ?? o.nazev ?? ""),
    nazev: String(o.nazev ?? ""),
    obyvatel: Number(o.obyvatel ?? 0),
    service: String(o.service ?? o.sluzba ?? "zzs") as "zzs" | "hzs",
    before_min: Number(o.before_min ?? o.pred_min ?? 0),
    after_min: (o.after_min ?? o.po_min ?? null) as number | null,
    extra_min: (o.extra_min ?? null) as number | null,
    over_limit: Boolean(o.over_limit ?? o.nad_20_min ?? false),
  })) as import("./api").RescueImpact["obce"];
  return {
    closed_road_ids: [],
    obce,
    people_slower: obce.reduce((sum, o) => sum + o.obyvatel, 0),
    zzs_over_limit: obce.filter((o) => o.over_limit && o.service === "zzs").length,
    limit_min: 20,
    alerts: [],
    src: "estimate",
    note: typeof r.note === "string" ? r.note : "",
  };
}

export async function simulateClosure(
  roadId: number,
  from: string,
  to: string,
  restriction: string,
): Promise<ClosureResult> {
  try {
    // D2: Pro náhled uzavírky volat /closures/preview, neukládá nic do DB
    const res = await api.closurePreview({ road_id: roadId, date_from: from, date_to: to, restriction });
    return {
      source: "api",
      detour: res.detour,
      detourAlerts: res.alerts,
      announcement: res.announcement,
      vehiclesPerDay: res.vehicles_per_day,
      vehiclesQuality: res.vehicles_quality,
      citizensOnRoute: res.citizens_on_route,
      studentsPerDay: res.students_per_day,
      cutOffObce: res.cut_off_obce,
      rescue: normalizeRescue(res.rescue),
    };
  } catch (err) {
    if (!(err instanceof ApiUnavailable)) console.warn(err);
  }
  const snap = await loadSnapshot();
  const row = snap?.detours[String(roadId)];
  if (!row) return { source: "none", detour: null, detourAlerts: [] };
  const { alerts_school, alerts_holiday, ...detour } = row;
  return {
    source: "snapshot",
    detour,
    detourAlerts: inSchoolYear(from, to) ? alerts_school : alerts_holiday,
    generated: snap?.generated,
  };
}
