import type { Weights } from "./types";

// Všech 14 parametrů skóre ve skupinách (TODO_FRONTEND F‑3). Klíče a výchozí hodnoty jsou v core/schemas.py Weights.
// Až bude GET /api/weights/schema (B‑W‑1), texty se vezmou odtud; do té doby platí tento seznam.
export type WeightMeta = { key: keyof Weights; label: string; help: string; group: string; server?: boolean };

export const WEIGHT_GROUPS = ["Stav silnice", "Lidé a služby", "Doprava", "Ostatní"] as const;

export const WEIGHT_META: WeightMeta[] = [
  { key: "stav", label: "Stav povrchu", help: "Horší povrch, vyšší priorita.", group: "Stav silnice" },
  { key: "worse", label: "Zhoršování", help: "Stav se mezi měřeními zhoršil.", group: "Stav silnice" },
  { key: "age", label: "Stáří opravy", help: "Roky od poslední opravy.", group: "Stav silnice" },
  { key: "trida", label: "Třída silnice", help: "II. třída váží víc než III.", group: "Stav silnice" },
  { key: "schools", label: "Školy", help: "Školy u úseku.", group: "Lidé a služby" },
  { key: "students", label: "Studenti", help: "Středoškoláci denně na trase (Data KHK).", group: "Lidé a služby", server: true },
  { key: "hospitals", label: "Nemocnice a lékaři", help: "Zdravotnictví a sociální služby u úseku.", group: "Lidé a služby" },
  { key: "rescue", label: "IZS", help: "Záchranka, hasiči a policie.", group: "Lidé a služby" },
  { key: "social", label: "Ohrožené oblasti", help: "Sociálně vyloučené lokality (HSOO).", group: "Lidé a služby" },
  { key: "transit", label: "Autobusy", help: "Linky a zastávky veřejné dopravy.", group: "Doprava" },
  { key: "intensity", label: "Vozidla za den", help: "Sčítání ŘSD 2025, jinde odhad.", group: "Doprava", server: true },
  { key: "detour", label: "Délka objížďky", help: "O kolik je objížďka delší při uzavírce.", group: "Doprava", server: true },
  { key: "industry", label: "Průmysl", help: "Průmyslové areály u úseku.", group: "Ostatní" },
  { key: "votes", label: "Hlasy občanů", help: "Slabý faktor, strop hlasů nastavuje admin.", group: "Ostatní", server: true },
];

export const WEIGHT_NAME = Object.fromEntries(WEIGHT_META.map((w) => [w.key, w.label])) as Record<keyof Weights, string>;
