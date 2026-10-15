import type { Repair, Road } from "./types";

// Moje cesty (v3 ★2): body 1, 2, … si občan vybere v mapě sám a může je pojmenovat. Aspoň dva.
// Na začátku nic vybraného není.
// Ukládá se jen v tomto prohlížeči, zaokrouhleno na ~100 m. Místo bez souřadnic = ještě nevybrané.
export type Place = { id: string; name: string; x: number | null; y: number | null };
export type SetPlace = Place & { x: number; y: number };

export const MIN_PLACES = 2;
// v2: dřívější předvyplněné body (Domov, Práce) zahazujeme, občan začíná s prázdnými body.
const KEY = "cesty-khk-places-v2";

export const isSet = (p: Place): p is SetPlace => p.x != null && p.y != null;
export const setPlaces = (places: Place[]) => places.filter(isSet);

export const newPlace = (name = ""): Place => ({ id: Math.random().toString(36).slice(2, 9), name, x: null, y: null });

/** Zaokrouhlení na 3 desetinná místa (~100 m), žádná adresa (NAPADY.md, č. 5). */
export const roundCoord = (v: number) => Math.round(v * 1000) / 1000;

/** Zobrazovaný název: vlastní, jinak „Bod 1“, „Bod 2“, … podle pořadí. */
export const placeLabel = (p: Place, i: number) => p.name.trim() || `Bod ${i + 1}`;

const defaults = () => [newPlace(), newPlace()];

/** Doplní seznam na minimum dvou míst. */
export const ensureMin = (places: Place[]) =>
  places.length >= MIN_PLACES ? places : [...places, ...Array.from({ length: MIN_PLACES - places.length }, () => newPlace())];

export function loadPlaces(): Place[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    if (!Array.isArray(list) || !list.length) return defaults();
    const parsed = list
      .map((item): Place | null => {
        const p = item as Partial<Place>;
        if (!p || typeof p !== "object") return null;
        const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
        const name = typeof p.name === "string" ? p.name : "";
        return { id: typeof p.id === "string" ? p.id : newPlace().id, name, x: num(p.x), y: num(p.y) };
      })
      .filter((p): p is Place => p != null);
    return ensureMin(parsed);
  } catch {
    return defaults();
  }
}

export function savePlaces(places: Place[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(places));
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
 * Úseky v pásu kolem spojnic mezi místy v pořadí seznamu (odhad, dokud backend nevrátí trasu po silnicích).
 * U jediného místa bere okruh 3 km.
 */
export function tripImpact(places: Place[], roads: Road[], repairs: Repair[], corridorKm = 1.5): TripImpact | null {
  const pts = setPlaces(places).map((p): [number, number] => [p.x, p.y]);
  if (!pts.length) return null;
  const segs: [[number, number], [number, number]][] =
    pts.length === 1 ? [[pts[0], pts[0]]] : pts.slice(1).map((b, i) => [pts[i], b]);
  const width = pts.length > 1 ? corridorKm : 3;
  const hits = roads.filter((r) =>
    r.g.some((pt, i) => i % 3 === 0 && segs.some(([a, b]) => distToSegmentKm(pt, a, b) <= width)),
  );
  const ids = new Set(hits.map((r) => r.id));
  const byId = new Map(hits.map((r) => [r.id, r]));
  return {
    roadIds: hits.map((r) => r.id),
    repairs: repairs
      .filter((rep) => ids.has(rep.roadId) && rep.status !== "done")
      .map((repair) => ({ repair, road: byId.get(repair.roadId)! })),
    badKm: hits.filter((r) => r.stav === "havarijní" || r.stav === "SUPERhavarijní").reduce((s, r) => s + r.delka, 0) / 1000,
    lines: Array.from(new Set(hits.flatMap((r) => r.lines.map((l) => l.linka)))).slice(0, 12),
    directKm: segs.reduce((s, [a, b]) => s + distToSegmentKm(a, b, b), 0),
  };
}
