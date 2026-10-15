import type { Road, Weights } from "./types";
import { roadScore } from "./priority";

// Náhled rozpočtového asistentu (NAPADY.md, č. 1). Stavby a výběr počítá prohlížeč jen pro návrh
// obrazovky. Až Tomáš dodá Engine.budget a Šimon POST /api/budget, nahradí se tímto voláním.

/** Cena za km podle stavu, mil. Kč. Předpoklad (CDV, Liberecký kraj), úředník ji mění. */
export const DEFAULT_PRICES: Record<string, number> = {
  nevyhovující: 2.5,
  havarijní: 12,
  SUPERhavarijní: 17,
};

export const BAD_STAVY = ["SUPERhavarijní", "havarijní", "nevyhovující"] as const;

export type Strategy = "worst" | "value";

export const STRATEGY_LABEL: Record<Strategy, string> = {
  worst: "Nejdřív nejhorší",
  value: "Nejvíc za korunu",
};

export type Focus = "stav" | "schools" | "rescue" | "transit";

export const FOCUS_LABEL: Record<Focus, string> = {
  stav: "Nejhorší povrch",
  schools: "Školy",
  rescue: "Záchranka a hasiči",
  transit: "Autobusy",
};

export type Stavba = {
  key: string;
  sil: string;
  trida: string;
  okres: string;
  roadIds: number[];
  km: number;
  /** Cena v mil. Kč. */
  cost: number;
  /** Průměr skóre úseků vážený délkou. */
  score: number;
  worst: string;
  schools: number;
  rescue: number;
  lines: number;
};

export type BudgetResult = {
  chosen: Stavba[];
  skipped: Stavba[];
  spent: number;
  kmFixed: number;
  kmBadTotal: number;
  kmBadLeft: number;
};

// Konce úseků do ~300 m od sebe patří do jedné stavby (krátký dobrý kus mezi nimi se přibere).
const NEAR = 0.004;

function boost(weights: Weights, focus: Focus[]): Weights {
  const w = { ...weights };
  if (focus.includes("stav")) w.stav = Math.min(100, w.stav + 40);
  if (focus.includes("schools")) w.schools = 100;
  if (focus.includes("rescue")) {
    w.rescue = 100;
    w.hospitals = 100;
  }
  if (focus.includes("transit")) w.transit = 100;
  return w;
}

/** Navazující špatné úseky stejné silnice v jednom okrese spojí do staveb (nejvýš ~5 km). */
export function buildStavby(roads: Road[], weights: Weights, focus: Focus[], prices: Record<string, number>, okres: string): Stavba[] {
  const w = boost(weights, focus);
  const bad = roads.filter((r) => (BAD_STAVY as readonly string[]).includes(r.stav) && (okres === "vše" || r.okres === okres));
  const groups = new Map<string, Road[]>();
  bad.forEach((r) => {
    const k = `${r.sil}|${r.okres}`;
    groups.set(k, [...(groups.get(k) || []), r]);
  });

  const out: Stavba[] = [];
  groups.forEach((list) => {
    // Union-find podle toho, jestli se konce úseků dotýkají.
    const parent = list.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const ends = list.map((r) => [r.g[0], r.g[r.g.length - 1]]);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const touch = ends[i].some((a) => ends[j].some((b) => Math.abs(a[0] - b[0]) < NEAR && Math.abs(a[1] - b[1]) < NEAR));
        if (touch) parent[find(i)] = find(j);
      }
    }
    const comps = new Map<number, Road[]>();
    list.forEach((r, i) => comps.set(find(i), [...(comps.get(find(i)) || []), r]));

    comps.forEach((parts) => {
      // Dlouhé celky rozdělit na stavby do ~5 km.
      let chunk: Road[] = [];
      let len = 0;
      const flush = () => {
        if (!chunk.length) return;
        out.push(toStavba(chunk, w, prices));
        chunk = [];
        len = 0;
      };
      parts.forEach((r) => {
        if (len + r.delka > 5000 && chunk.length) flush();
        chunk.push(r);
        len += r.delka;
      });
      flush();
    });
  });
  return out;
}

const STAV_RANK: Record<string, number> = { SUPERhavarijní: 0, havarijní: 1, nevyhovující: 2 };

function toStavba(parts: Road[], w: Weights, prices: Record<string, number>): Stavba {
  const m = parts.reduce((s, r) => s + r.delka, 0);
  const score = parts.reduce((s, r) => s + roadScore(r, w) * r.delka, 0) / Math.max(m, 1);
  const cost = parts.reduce((s, r) => s + (r.delka / 1000) * (prices[r.stav] ?? 0), 0);
  const worst = parts.map((r) => r.stav).sort((a, b) => STAV_RANK[a] - STAV_RANK[b])[0];
  return {
    key: parts.map((r) => r.id).join("-"),
    sil: parts[0].sil,
    trida: parts[0].trida,
    okres: parts[0].okres,
    roadIds: parts.map((r) => r.id),
    km: m / 1000,
    cost,
    score: Math.round(score),
    worst,
    schools: parts.reduce((s, r) => s + (r.counts.school || 0), 0),
    rescue: parts.reduce((s, r) => s + (r.counts.zzs || 0) + (r.counts.hzs || 0) + (r.counts.hospital || 0), 0),
    lines: new Set(parts.flatMap((r) => r.lines.map((l) => l.linka))).size,
  };
}

/** Hladový výběr podle zvolené strategie, dokud se stavby vejdou do rozpočtu (mil. Kč). Deterministický. */
export function planBudget(stavby: Stavba[], budget: number, roads: Road[], strategy: Strategy = "worst"): BudgetResult {
  // „Nejdřív nejhorší“ bere stavby podle skóre, „Nejvíc za korunu“ podle skóre na korunu (levná prevence).
  const value = (s: Stavba) => (strategy === "worst" ? s.score : s.score / Math.max(s.cost, 0.01));
  const order = [...stavby].sort((a, b) => value(b) - value(a) || a.key.localeCompare(b.key));
  const chosen: Stavba[] = [];
  const skipped: Stavba[] = [];
  let spent = 0;
  order.forEach((s) => {
    if (spent + s.cost <= budget) {
      chosen.push(s);
      spent += s.cost;
    } else skipped.push(s);
  });
  chosen.sort((a, b) => b.score - a.score);
  const isBad = (r: Road) => r.stav === "havarijní" || r.stav === "SUPERhavarijní";
  const fixedIds = new Set(chosen.flatMap((s) => s.roadIds));
  const kmBadTotal = roads.filter(isBad).reduce((s, r) => s + r.delka, 0) / 1000;
  const kmBadFixed = roads.filter((r) => isBad(r) && fixedIds.has(r.id)).reduce((s, r) => s + r.delka, 0) / 1000;
  return {
    chosen,
    skipped,
    spent,
    kmFixed: chosen.reduce((s, c) => s + c.km, 0),
    kmBadTotal,
    kmBadLeft: kmBadTotal - kmBadFixed,
  };
}

export const formatMil = (mil: number) =>
  mil >= 1000 ? `${(mil / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} mld. Kč` : `${mil.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} mil. Kč`;
