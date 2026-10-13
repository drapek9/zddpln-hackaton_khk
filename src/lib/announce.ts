import type { Connection, Repair, Road } from "./types";
import { formatSil } from "./geo";
import { impactAlerts } from "./priority";

export function buildAnnouncement(road: Road, repair: Repair, connections: Connection[]) {
  const alerts = impactAlerts(road, repair, connections);
  const stops = (road.samples.stop || []).map((s) => s.name);
  const schools = (road.samples.school || []).map((s) => s.name);
  const hospitals = (road.samples.hospital || []).map((s) => s.name);
  return [
    `OZNÁMENÍ O OMEZENÍ SILNIČNÍHO PROVOZU`,
    `Královéhradecký kraj / Správa silnic KHK`,
    ``,
    `${repair.title}`,
    `Silnice: ${formatSil(road.sil, road.trida)}  ·  úsek ${road.usek}`,
    `Okres: ${road.okres}`,
    `Termín: ${repair.from} — ${repair.to}`,
    `Omezení: ${repair.restriction}`,
    repair.note ? `Poznámka: ${repair.note}` : "",
    ``,
    `DOTČENÁ VEŘEJNÁ DOPRAVA`,
    road.lines.length
      ? road.lines.map((l) => `• ${l.linka}: ${l.trasa}`).join("\n")
      : "• Na úseku není evidována krajská autobusová linka.",
    stops.length ? `Zastávky v dosahu: ${stops.join(", ")}` : "",
    ``,
    `ŠKOLY A ZDRAVOTNICTVÍ`,
    schools.length ? `Školy: ${schools.join("; ")}` : "Školy v okruhu 450 m: žádné.",
    hospitals.length ? `Nemocnice: ${hospitals.join("; ")}` : "",
    ``,
    `UPOZORNĚNÍ ZE SYSTÉMU`,
    ...alerts.map((a) => `• [${a.level}] ${a.title}: ${a.detail}`),
    ``,
    `Provozovatelé IREDO, obce a IZS budou informováni automaticky.`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
