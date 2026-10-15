// Adresy aplikace (PLAN_FINAL.md, kap. 25): "/" veřejnost a občan, "/sprava" úředník, "/admin" administrace.
// Bez knihovny: location.pathname + history.pushState.

export type Area = "public" | "sprava" | "admin" | "missing";

export function areaOf(pathname: string): Area {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/index.html") return "public";
  if (p === "/sprava") return "sprava";
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
