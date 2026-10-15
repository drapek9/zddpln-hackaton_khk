import { useEffect, useState } from "react";
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

// Schéma a předvolby ze serveru (B‑W‑1, B‑3): načteme jednou, bez serveru platí seznamy výše.
let schemaPromise: Promise<WeightMeta[] | null> | null = null;
export function loadWeightSchema() {
  schemaPromise ??= fetch("/api/weights/schema")
    .then((r) => (r.ok ? r.json() : null))
    .then((res: { items?: { key: keyof Weights; label: string; group: string; help: string }[] } | null) => {
      const items = res?.items;
      if (!items?.length) return null;
      const server = new Set(WEIGHT_META.filter((w) => w.server).map((w) => w.key));
      return items.map((i) => ({ key: i.key, label: i.label, help: i.help, group: i.group, server: server.has(i.key) }));
    })
    .catch(() => null);
  return schemaPromise;
}

export function useWeightMeta(): { meta: WeightMeta[]; groups: string[] } {
  const [meta, setMeta] = useState<WeightMeta[]>(WEIGHT_META);
  useEffect(() => {
    loadWeightSchema().then((m) => m && setMeta(m));
  }, []);
  const groups = Array.from(new Set(meta.map((w) => w.group)));
  return { meta, groups };
}

export type WeightPreset = { key: string; label: string; hint: string; weights: Partial<Weights> };

let presetsPromise: Promise<WeightPreset[] | null> | null = null;
export function useWeightPresets(fallback: WeightPreset[]) {
  const [presets, setPresets] = useState<WeightPreset[]>(fallback);
  const [fromServer, setFromServer] = useState(false);
  useEffect(() => {
    presetsPromise ??= fetch("/api/weights/presets")
      .then((r) => (r.ok ? r.json() : null))
      .then((res: { items?: { id: string; nazev: string; popis: string; weights: Partial<Weights> }[] } | null) =>
        res?.items?.length ? res.items.map((p) => ({ key: p.id, label: p.nazev, hint: p.popis, weights: p.weights })) : null,
      )
      .catch(() => null);
    presetsPromise.then((p) => {
      if (p) {
        setPresets(p);
        setFromServer(true);
      }
    });
  }, []);
  return { presets, fromServer };
}

export const WEIGHT_NAME =Object.fromEntries(WEIGHT_META.map((w) => [w.key, w.label])) as Record<keyof Weights, string>;
