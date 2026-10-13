import type { Road } from "./types";

export const STAV_ORDER = [
  "SUPERhavarijní",
  "havarijní",
  "nevyhovující",
  "vyhovující",
  "dobrý",
  "výborný",
] as const;

export const STAV_COLOR: Record<string, string> = {
  SUPERhavarijní: "#7f1d1d",
  havarijní: "#dc2626",
  nevyhovující: "#ea580c",
  vyhovující: "#ca8a04",
  dobrý: "#65a30d",
  výborný: "#0f766e",
};

export function formatSil(sil: string, trida?: string) {
  const n = String(sil || "").replace(/^0+/, "") || sil;
  if (trida?.includes("2")) return `II/${n}`;
  if (trida?.includes("3")) return `III/${n}`;
  return n.length <= 3 ? `II/${n}` : `III/${n}`;
}

export function formatKm(meters: number) {
  if (!meters) return "0 m";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
}

export function midpoint(road: Road): [number, number] {
  const i = Math.floor(road.g.length / 2);
  return road.g[i] ?? [15.83, 50.21];
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function inSchoolYear(from: string, to: string) {
  if (!from || !to) return true;
  const overlaps = (start: string, end: string) => from <= end && to >= start;
  // Oprava může přesáhnout přes Nový rok, proto se kontrolují všechny roky termínu.
  const y1 = Number(from.slice(0, 4));
  const y2 = Math.max(y1, Number(to.slice(0, 4)));
  for (let y = y1; y <= y2; y++) {
    if (overlaps(`${y}-01-01`, `${y}-06-30`) || overlaps(`${y}-09-01`, `${y}-12-31`)) return true;
  }
  return false;
}

/** Zasahuje termín do zimní údržby (listopad až březen)? */
export function inWinter(from: string, to: string) {
  if (!from || !to) return false;
  const overlaps = (start: string, end: string) => from <= end && to >= start;
  const y1 = Number(from.slice(0, 4));
  const y2 = Math.max(y1, Number(to.slice(0, 4)));
  for (let y = y1 - 1; y <= y2; y++) {
    if (overlaps(`${y}-11-01`, `${y + 1}-03-31`)) return true;
  }
  return false;
}

/** Datum ve formátu RRRR-MM-DD posunuté o n dní od dneška. */
export function isoInDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Termín opravy pro výpis. U skutečných oprav z dat známe jen rok. */
export function formatPeriod(repair: { from: string; to: string; simulated?: boolean; status: string }) {
  if (repair.status === "done" && repair.simulated === false) return `rok ${repair.from.slice(0, 4)}`;
  return `${repair.from} – ${repair.to}`;
}

export const KIND_LABEL: Record<string, string> = {
  hospital: "Nemocnice",
  school: "Školy",
  zzs: "Záchranná služba",
  hzs: "Hasiči",
  police: "Policie",
  doctor: "Praktici",
  pediatric: "Dětští praktici",
  social: "Sociální služby",
  industry: "Průmyslové zóny",
  rail: "Železnice",
  stop: "Zastávky",
};

export const KIND_COLOR: Record<string, string> = {
  hospital: "#e11d48",
  school: "#2563eb",
  zzs: "#dc2626",
  hzs: "#ea580c",
  police: "#4f46e5",
  doctor: "#0d9488",
  pediatric: "#0891b2",
  social: "#7c3aed",
  industry: "#57534e",
  rail: "#334155",
  stop: "#0369a1",
};

export const STATUS_LABEL: Record<string, string> = {
  planned: "Plánováno",
  active: "Probíhá",
  done: "Dokončeno",
};
