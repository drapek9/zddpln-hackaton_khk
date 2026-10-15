import type { Connection, Repair, Road, Weights } from "./types";
import { inSchoolYear, inWinter } from "./geo";

const STAV_SCORE: Record<string, number> = {
  SUPERhavarijní: 100,
  havarijní: 82,
  nevyhovující: 58,
  vyhovující: 28,
  dobrý: 12,
  výborný: 4,
};

const THIS_YEAR = new Date().getFullYear();

export function roadScore(road: Road, weights: Weights) {
  const c = road.counts || {};
  const yearsAgo = road.lastRepair ? Math.min(THIS_YEAR - road.lastRepair, 12) : 10;
  const raw =
    ((STAV_SCORE[road.stav] ?? 20) * weights.stav) / 100 +
    ((road.worse ? 18 : 0) * weights.worse) / 100 +
    ((road.trida?.includes("2") ? 14 : 4) * weights.trida) / 100 +
    Math.min((c.school || 0) * 4, 28) * (weights.schools / 100) +
    Math.min((c.hospital || 0) * 12 + (c.doctor || 0) + (c.social || 0) * 2, 36) *
      (weights.hospitals / 100) +
    Math.min((c.zzs || 0) * 10 + (c.hzs || 0) * 8 + (c.police || 0) * 4, 32) *
      (weights.rescue / 100) +
    Math.min((c.stop || 0) * 1.2 + road.lines.length * 3, 28) * (weights.transit / 100) +
    Math.min((c.industry || 0) * 8, 20) * (weights.industry / 100) +
    ((road.hsoo?.length ? 12 : 0) * weights.social) / 100 +
    Math.min(yearsAgo * 4, 32) * (weights.age / 100);
  return Math.round(raw);
}

export type Alert = {
  level: "critical" | "warning" | "info";
  title: string;
  detail: string;
};

export function impactAlerts(
  road: Road,
  repair: Pick<Repair, "from" | "to" | "restriction"> | null,
  connections: Connection[],
): Alert[] {
  const alerts: Alert[] = [];
  const c = road.counts || {};
  const full = repair?.restriction?.includes("uzavírka");

  if ((c.hospital || 0) > 0) {
    alerts.push({
      level: "critical",
      title: "Nemocnice v okolí úseku",
      detail: `${c.hospital} zařízení do 450 m. ${full ? "Úplná uzavírka může zkomplikovat dojezd sanitky a návštěvníky." : "Ověřte průjezd vozidel IZS."}`,
    });
  }
  if ((c.zzs || 0) + (c.hzs || 0) > 0) {
    const parts = [
      c.zzs ? plural(c.zzs, "základna ZZS", "základny ZZS", "základen ZZS") : "",
      c.hzs ? plural(c.hzs, "stanice HZS", "stanice HZS", "stanic HZS") : "",
    ].filter(Boolean);
    alerts.push({
      level: "critical",
      title: "Výjezd IZS na úseku",
      detail: `V dosahu: ${parts.join(" a ")}. Objednejte objízdnou trasu dřív, než začnou práce.`,
    });
  }
  if ((c.school || 0) > 0) {
    const schoolTime = repair ? inSchoolYear(repair.from, repair.to) : true;
    alerts.push({
      level: schoolTime ? "warning" : "info",
      title: `${c.school} školských zařízení v okolí`,
      detail: schoolTime
        ? "Termín zasahuje do školního roku. Zvažte prázdniny nebo kyvadlový provoz ráno a odpoledne."
        : "Termín vychází mimo školní rok — nižší dopad na svozy dětí.",
    });
  }
  if (road.lines.length) {
    alerts.push({
      level: full ? "critical" : "warning",
      title: `${road.lines.length} autobusových linek na úseku`,
      detail: road.lines.map((l) => l.linka).join(", "),
    });
  }

  const stopNames = (road.samples.stop || []).map((s) => normStop(s.name));
  const normalized = normalizedStops(connections);
  const broken = connections.filter((_, i) => stopNames.some((na) => sameNorm(na, normalized[i]))).slice(0, 8);
  if (broken.length) {
    alerts.push({
      level: "critical",
      title: `${broken.length} zaručených přípojů může odpadnout`,
      detail: broken
        .slice(0, 3)
        .map((cn) => `${cn.line} → ${cn.toLine} v ${cn.stop} (čeká ${cn.wait} min)`)
        .join(" · "),
    });
  }

  if (repair && road.winter && inWinter(repair.from, repair.to)) {
    alerts.push({
      level: "warning",
      title: "Kolize se zimní údržbou",
      detail: `Úsek se v zimě udržuje (${road.winter}). Práce od listopadu do března prodlužují výluky.`,
    });
  }

  if (road.worse) {
    alerts.push({
      level: "warning",
      title: "Úsek se zhoršuje",
      detail: "Proti předchozímu hodnocení klesl stav povrchu. Odklad zvýší náklady na opravu.",
    });
  }

  if ((c.industry || 0) > 0) {
    alerts.push({
      level: "info",
      title: "Nákladní obsluha průmyslu",
      detail: "V okolí je průmyslová zóna. Počítejte s objížďkou kamionů.",
    });
  }

  if (!road.lastRepair) {
    alerts.push({
      level: "info",
      title: "Bez evidované opravy od roku 2016",
      detail: "V otevřených datech kraje k tomuto úseku není liniová oprava.",
    });
  }

  return alerts;
}

function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return `${n} ${one}`;
  if (n >= 2 && n <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

function normStop(s: string) {
  return s.toLowerCase().replace(/,+/g, ",").replace(/\s+/g, " ").trim();
}

// Normalizované názvy zastávek přípojů, jednou na pole (~3 500 přípojů).
const normCache = new WeakMap<Connection[], string[]>();
function normalizedStops(connections: Connection[]) {
  let out = normCache.get(connections);
  if (!out) {
    out = connections.map((cn) => normStop(cn.stop));
    normCache.set(connections, out);
  }
  return out;
}

function sameNorm(na: string, nb: string) {
  return na === nb || (na.length > 8 && nb.includes(na)) || (nb.length > 8 && na.includes(nb));
}

export function scoreBreakdown(road: Road, weights: Weights) {
  const total = roadScore(road, weights);
  return [
    { key: "Stav povrchu", value: `${road.stav}`, share: weights.stav },
    { key: "Zhoršování", value: road.worse ? "ano" : "ne", share: weights.worse },
    { key: "Třída silnice", value: road.trida, share: weights.trida },
    { key: "Školy", value: String(road.counts.school || 0), share: weights.schools },
    { key: "Zdravotnictví", value: String((road.counts.hospital || 0) + (road.counts.doctor || 0)), share: weights.hospitals },
    { key: "IZS", value: String((road.counts.zzs || 0) + (road.counts.hzs || 0)), share: weights.rescue },
    { key: "Veřejná doprava", value: `${road.lines.length} linek / ${road.counts.stop || 0} zastávek`, share: weights.transit },
    { key: "Průmysl", value: String(road.counts.industry || 0), share: weights.industry },
    { key: "Ohrožené oblasti (HSOO)", value: road.hsoo?.length ? road.hsoo.join(", ") : "ne", share: weights.social },
    { key: "Roky od opravy", value: road.lastRepair ? String(THIS_YEAR - road.lastRepair) : "neznámo", share: weights.age },
  ].map((row) => ({ ...row, total }));
}
