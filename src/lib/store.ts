import type { Repair, Report } from "./types";

const REPAIR_KEY = "cesty-khk-repairs";
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
