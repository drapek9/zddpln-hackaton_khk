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
      rescue: res.rescue,
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
