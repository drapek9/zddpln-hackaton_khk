import type { Connection, Repair, Road, Weights } from "./types";
import { inSchoolYear, inWinter, stavLabel } from "./geo";

const STAV_SCORE: Record<string, number> = {
  SUPERhavarijní: 100,
  havarijní: 82,
  nevyhovující: 58,
  vyhovující: 28,
  dobrý: 12,
  výborný: 4,
};

const THIS_YEAR = new Date().getFullYear();

/** Body skóre po faktorech, stejný vzorec jako roadScore. Slouží k větě „proč je úsek vysoko“. */
export function scoreParts(road: Road, weights: Weights): { key: keyof Weights; points: number }[] {
  const c = road.counts || {};
  const yearsAgo = road.lastRepair ? Math.min(THIS_YEAR - road.lastRepair, 12) : 10;
  return [
    { key: "stav", points: ((STAV_SCORE[road.stav] ?? 20) * weights.stav) / 100 },
    { key: "worse", points: ((road.worse ? 18 : 0) * weights.worse) / 100 },
    { key: "trida", points: ((road.trida?.includes("2") ? 14 : 4) * weights.trida) / 100 },
    { key: "schools", points: Math.min((c.school || 0) * 4, 28) * (weights.schools / 100) },
    {
      key: "hospitals",
      points: Math.min((c.hospital || 0) * 12 + (c.doctor || 0) + (c.social || 0) * 2, 36) * (weights.hospitals / 100),
    },
    { key: "rescue", points: Math.min((c.zzs || 0) * 10 + (c.hzs || 0) * 8 + (c.police || 0) * 4, 32) * (weights.rescue / 100) },
    { key: "transit", points: Math.min((c.stop || 0) * 1.2 + road.lines.length * 3, 28) * (weights.transit / 100) },
    { key: "industry", points: Math.min((c.industry || 0) * 8, 20) * (weights.industry / 100) },
    { key: "social", points: ((road.hsoo?.length ? 12 : 0) * weights.social) / 100 },
    { key: "age", points: Math.min(yearsAgo * 4, 32) * (weights.age / 100) },
  ];
}

export function roadScore(road: Road, weights: Weights) {
  return Math.round(scoreParts(road, weights).reduce((s, p) => s + p.points, 0));
}

const REASON: Partial<Record<keyof Weights, (road: Road) => string>> = {
  stav: (r) => `Povrch ve stavu ${stavLabel(r.stav).toLowerCase()}`,
  worse: () => "Stav se zhoršuje",
  trida: (r) => `Důležitá silnice (${r.trida})`,
  schools: () => "Vede ke školám",
  hospitals: () => "Vede k nemocnici a lékařům",
  rescue: () => "Jezdí tudy záchranáři a hasiči",
  transit: (r) => {
    const n = r.lines.length;
    if (!n) return "Zastávky autobusů";
    return n === 1 ? "Jezdí tudy 1 autobusová linka" : n < 5 ? `Jezdí tudy ${n} autobusové linky` : `Jezdí tudy ${n} autobusových linek`;
  },
  industry: () => "Vede k průmyslu",
  social: () => "Vede ohroženou oblastí",
  age: (r) => (r.lastRepair ? `Naposledy opraveno ${r.lastRepair}` : "Dlouho bez opravy"),
};

/** Jedna věta: největší faktor skóre (kap. 25.2). Váhy jen ze serveru (D6) lokální vzorec nezná. */
export function mainReason(road: Road, weights: Weights): string {
  const top = scoreParts(road, weights).sort((a, b) => b.points - a.points)[0];
  return top && top.points > 0 ? REASON[top.key]?.(road) ?? "" : "";
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
    { key: "Stav povrchu", value: stavLabel(road.stav), share: weights.stav },
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
