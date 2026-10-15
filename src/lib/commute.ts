import type { Repair, Road } from "./types";

// Moje cesty (v3 ★2): domov a práce jako body. Ukládá se jen v tomto prohlížeči, zaokrouhleno na ~100 m.
export type Place = { kind: "home" | "work"; x: number; y: number };

const KEY = "cesty-khk-places";

/** Zaokrouhlení na 3 desetinná místa (~100 m), žádná adresa (NAPADY.md, č. 5). */
export const roundPlace = (p: Place): Place => ({ ...p, x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 });

export function loadPlaces(): Place[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Place[]) : [];
    return Array.isArray(list) ? list.filter((p) => p && (p.kind === "home" || p.kind === "work")) : [];
  } catch {
    return [];
  }
}

export function savePlaces(places: Place[]) {
  try {
    if (places.length) localStorage.setItem(KEY, JSON.stringify(places));
    else localStorage.removeItem(KEY);
  } catch {
    // úložiště není dostupné, místa platí jen do zavření stránky
  }
}

/** Vzdálenost bodu od úsečky v km (rovinná aproximace, na kraj stačí). */
function distToSegmentKm(p: [number, number], a: [number, number], b: [number, number]) {
  const k = Math.cos((a[1] * Math.PI) / 180) * 111.32;
  const ax = a[0] * k, ay = a[1] * 110.57;
  const bx = b[0] * k, by = b[1] * 110.57;
  const px = p[0] * k, py = p[1] * 110.57;
  const dx = bx - ax, dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export type TripImpact = {
  roadIds: number[];
  repairs: { repair: Repair; road: Road }[];
  badKm: number;
  lines: string[];
  directKm: number;
};

/**
 * Úseky v pásu kolem spojnice domov–práce (odhad, dokud backend nevrátí trasu po silnicích).
 * U samotného domova bere okruh 3 km.
 */
export function tripImpact(places: Place[], roads: Road[], repairs: Repair[], corridorKm = 1.5): TripImpact | null {
  const home = places.find((p) => p.kind === "home");
  const work = places.find((p) => p.kind === "work");
  if (!home) return null;
  const a: [number, number] = [home.x, home.y];
  const b: [number, number] = work ? [work.x, work.y] : a;
  const width = work ? corridorKm : 3;
  const hits = roads.filter((r) => r.g.some((pt, i) => i % 3 === 0 && distToSegmentKm(pt, a, b) <= width));
  const ids = new Set(hits.map((r) => r.id));
  const byId = new Map(hits.map((r) => [r.id, r]));
  return {
    roadIds: hits.map((r) => r.id),
    repairs: repairs
      .filter((rep) => ids.has(rep.roadId) && rep.status !== "done")
      .map((repair) => ({ repair, road: byId.get(repair.roadId)! })),
    badKm: hits.filter((r) => r.stav === "havarijní" || r.stav === "SUPERhavarijní").reduce((s, r) => s + r.delka, 0) / 1000,
    lines: Array.from(new Set(hits.flatMap((r) => r.lines.map((l) => l.linka)))).slice(0, 12),
    directKm: distToSegmentKm(a, b, b),
  };
}
