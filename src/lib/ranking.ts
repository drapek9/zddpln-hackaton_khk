// Žebříček se 4 třídami priority a připíchnutím (pin).
// Stejný algoritmus jako backend/app/core/scoring.py (ranking, classify), aby pořadí sedělo,
// i když /api/ranking ještě neběží.
import type { Road, Weights } from "./types";
import { roadScore } from "./priority";
import { api, ApiUnavailable, type Pin, type PriorityClass } from "./api";

// Podíl sítě v každé třídě odshora (scoring.py CLASS_SHARES).
export const CLASS_SHARES: [PriorityClass, number][] = [
  ["kriticka", 0.1],
  ["vysoka", 0.2],
  ["stredni", 0.3],
  ["nizka", 0.4],
];

export const CLASS_ORDER: PriorityClass[] = CLASS_SHARES.map(([name]) => name);

export const CLASS_LABEL: Record<PriorityClass, string> = {
  kriticka: "kritická",
  vysoka: "vysoká",
  stredni: "střední",
  nizka: "nízká",
};

export const CLASS_COLOR: Record<PriorityClass, string> = {
  kriticka: "#e11d48",
  vysoka: "#f97316",
  stredni: "#eab308",
  nizka: "#64748b",
};

export type RankRow = {
  id: number;
  score: number;
  modelClass: PriorityClass;
  priority: PriorityClass;
  pinned: boolean;
  pinReason: string | null;
  rank: number;
  /** Návrh AI: o kolik míst AI úsek posunula (+ nahoru) a proč. */
  aiShift?: number;
  aiReason?: string | null;
};

export type RankingSource = "api" | "local";

/** Třída podle pozice v žebříčku (0 = nejvyšší priorita). */
export function classify(rankIndex: number, total: number): PriorityClass {
  if (total <= 0) return "nizka";
  const position = (rankIndex + 0.5) / total;
  let upper = 0;
  for (const [name, share] of CLASS_SHARES) {
    upper += share;
    if (position <= upper) return name;
  }
  return "nizka";
}

export function localRanking(roads: Road[], weights: Weights, pins: Pin[]): RankRow[] {
  const pinById = new Map(pins.map((p) => [p.road_id, p]));
  const scored = roads
    .map((r) => ({ id: r.id, score: roadScore(r, weights) }))
    .sort((a, b) => b.score - a.score || a.id - b.id);
  const total = scored.length;
  const rows: RankRow[] = scored.map((s, i) => {
    const modelClass = classify(i, total);
    const pin = pinById.get(s.id);
    return {
      id: s.id,
      score: s.score,
      modelClass,
      priority: pin ? pin.priority : modelClass,
      pinned: !!pin,
      pinReason: pin?.reason ?? null,
      rank: 0,
    };
  });
  // Stabilní řazení: třída, v ní připíchnuté první, pak skóre (scoring.py ranking).
  const order = new Map(CLASS_ORDER.map((c, i) => [c, i]));
  rows.sort(
    (a, b) =>
      order.get(a.priority)! - order.get(b.priority)! ||
      Number(b.pinned) - Number(a.pinned) ||
      b.score - a.score ||
      a.id - b.id,
  );
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

function weightsQuery(weights: Weights) {
  // Posílat vždy všechny váhy (D4), aby se nerozcházely s výchozími na backendu.
  return new URLSearchParams(
    (Object.keys(weights) as (keyof Weights)[]).filter((k) => weights[k] != null).map((k) => [k, String(weights[k])]),
  ).toString();
}

/**
 * Žebříček z /api/ranking (S4, Šimon). Dokud endpoint není, spočítá se lokálně.
 * Piny z API mají přednost, lokální piny se použijí jen u lokálního výpočtu.
 */
export async function fetchRanking(
  roads: Road[],
  weights: Weights,
  localPins: Pin[],
  signal?: AbortSignal,
  /** "Parametry + AI" (F‑2): bez vah v dotazu, server vezme váhy kraje a přidá návrh AI. */
  withAi = false,
): Promise<{ rows: RankRow[]; source: RankingSource; apiPins?: Pin[]; ai?: string; aiNote?: string }> {
  try {
    const query = withAi ? "ai=1" : `ai=0&${weightsQuery(weights)}`;
    const res = await api.rankingFull(query, signal);
    const ranked = res.items;
    const apiPins: Pin[] = [];
    const rows = ranked.map((r) => {
      if (r.pinned) {
        apiPins.push({ road_id: r.road.id, priority: r.priority, reason: r.pin_reason });
      }
      return {
        id: r.road.id,
        score: r.score,
        modelClass: r.model_class,
        priority: r.priority,
        pinned: r.pinned,
        pinReason: r.pin_reason,
        rank: r.rank,
        aiShift: r.ai_label && r.formula_rank != null ? r.formula_rank - r.rank : undefined,
        aiReason: r.ai_reason ?? null,
      };
    });
    return {
      source: "api",
      rows,
      apiPins,
      ai: res.ai,
      aiNote: res.ai_note,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    if (!(err instanceof ApiUnavailable)) console.warn(err);
    return { source: "local", rows: localRanking(roads, weights, localPins) };
  }
}
