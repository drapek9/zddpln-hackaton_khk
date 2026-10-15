import type { Repair, Report, Weights } from "./types";
import type { Pin } from "./api";

// v2: starší uložené opravy neměly příznak simulace.
const REPAIR_KEY = "cesty-khk-repairs-v2";
const REPORT_KEY = "cesty-khk-reports";

export function loadLocalRepairs(seed: Repair[]): Repair[] {
  try {
    const raw = localStorage.getItem(REPAIR_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Repair[];
    const ids = new Set(parsed.map((r) => r.id));
    return [...parsed, ...seed.filter((r) => !ids.has(r.id))];
  } catch {
    return seed;
  }
}

export function saveRepairs(repairs: Repair[]) {
  localStorage.setItem(REPAIR_KEY, JSON.stringify(repairs));
}

export function loadReports(): Report[] {
  try {
    return JSON.parse(localStorage.getItem(REPORT_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveReports(reports: Report[]) {
  localStorage.setItem(REPORT_KEY, JSON.stringify(reports));
}

// Připíchnuté priority úředníka. Jen v prohlížeči, dokud nepojede backend (S2, S4).
const PIN_KEY = "cesty-khk-pins-v1";

export function loadPins(): Pin[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PIN_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePins(pins: Pin[]) {
  try {
    localStorage.setItem(PIN_KEY, JSON.stringify(pins));
  } catch {
    /* plné nebo zakázané úložiště: piny vydrží jen do obnovení stránky */
  }
}

// Trvalé váhy kraje (admin). Demo: zatím jen v tomto prohlížeči, backend v4 je uloží pro všechny.
const REGION_WEIGHTS_KEY = "cesty-khk-region-weights";

export function loadRegionWeights(fallback: Weights): Weights {
  try {
    const raw = localStorage.getItem(REGION_WEIGHTS_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Weights>) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveRegionWeights(weights: Weights) {
  try {
    localStorage.setItem(REGION_WEIGHTS_KEY, JSON.stringify(weights));
  } catch {
    // úložiště není dostupné
  }
}
