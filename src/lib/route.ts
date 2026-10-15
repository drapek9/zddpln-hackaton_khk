// Adresy aplikace (PLAN_FINAL.md, kap. 25): "/" veřejnost a občan, "/sprava" úředník, "/admin" administrace.
// Bez knihovny: location.pathname + history.pushState.

export type Area = "public" | "sprava" | "admin" | "missing";

export function areaOf(pathname: string): Area {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/index.html") return "public";
  if (p === "/sprava" || /^\/sprava\/usek\/\d+$/.test(p)) return "sprava";
  if (p === "/admin") return "admin";
  return "missing";
}

const ROUTE_EVENT = "cesty-khk:route";

export function navigate(path: string) {
  if (window.location.pathname !== path) window.history.pushState(null, "", path);
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

export function onRoute(fn: () => void) {
  window.addEventListener("popstate", fn);
  window.addEventListener(ROUTE_EVENT, fn);
  return () => {
    window.removeEventListener("popstate", fn);
    window.removeEventListener(ROUTE_EVENT, fn);
  };
}

/** Domovská adresa podle role (B‑5). */
export const homeOf = (role: "citizen" | "official" | "admin") =>
  role === "admin" ? "/admin" : role === "official" ? "/sprava" : "/";

/** Úsek ze sdíleného odkazu: /sprava/usek/123 nebo /?usek=123 (kap. 25.1). */
export function roadFromUrl(): number | null {
  const m = window.location.pathname.match(/\/usek\/(\d+)\/?$/);
  const raw = m ? m[1] : new URLSearchParams(window.location.search).get("usek");
  const id = raw ? Number(raw) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Zapíše vybraný úsek do adresy bez nového záznamu v historii, ať jde odkaz poslat a obnovení stránky ho drží. */
export function setRoadInUrl(area: "public" | "sprava", id: number | null) {
  const path =
    area === "sprava" ? (id != null ? `/sprava/usek/${id}` : "/sprava") : id != null ? `/?usek=${id}` : "/";
  if (window.location.pathname + window.location.search !== path) window.history.replaceState(null, "", path);
}
