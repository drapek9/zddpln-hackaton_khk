// Přihlášení (PLAN_FINAL.md, kap. 15, úkol F1). Backend: backend/app/api/auth.py (Šimon).
// Token je v httpOnly cookie `cesty_session`, prohlížeč ji posílá sám. Frontend token nikam neukládá,
// drží si jen e-mail a roli z odpovědi.

export type Role = "citizen" | "official" | "admin";
export type User = { id: number; email: string; role: Role; blocked?: boolean };

export const ROLE_LABEL: Record<Role, string> = {
  citizen: "Občan",
  official: "Úředník",
  admin: "Admin",
};

/** Výsledek ověření při načtení stránky. `offline` = server s přihlášením neběží (demo bez backendu). */
export type Session = { status: "user"; user: User } | { status: "anon" } | { status: "offline" };

export class AuthError extends Error {}

async function call(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`/api/auth${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
}

// Vite proxy bez běžícího backendu vrací 500/502/504 bez JSON těla.
const isOffline = (res: Response) => res.status === 404 || res.status >= 500;

async function detail(res: Response, fallback: string) {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    // Chyba validace (FastAPI 422): krátké heslo, prázdný e-mail.
    if (Array.isArray(body?.detail)) return "Zkontrolujte e-mail a heslo (heslo má aspoň 8 znaků).";
  } catch {
    // tělo není JSON
  }
  return fallback;
}

export async function me(): Promise<Session> {
  try {
    const res = await call("/me");
    if (res.ok) return { status: "user", user: (await res.json()) as User };
    if (res.status === 401 || res.status === 403) return { status: "anon" };
    return isOffline(res) ? { status: "offline" } : { status: "anon" };
  } catch {
    return { status: "offline" };
  }
}

async function submit(path: "/login" | "/register", email: string, password: string): Promise<User> {
  let res: Response;
  try {
    res = await call(path, { method: "POST", body: JSON.stringify({ email: email.trim(), password }) });
  } catch {
    throw new AuthError("Server s přihlášením teď neběží.");
  }
  if (res.ok) return ((await res.json()) as { user: User }).user;
  if (isOffline(res)) throw new AuthError("Server s přihlášením teď neběží.");
  throw new AuthError(await detail(res, path === "/login" ? "Přihlášení se nepovedlo." : "Registrace se nepovedla."));
}

export const login = (email: string, password: string) => submit("/login", email, password);
export const register = (email: string, password: string) => submit("/register", email, password);

export async function logout() {
  try {
    await call("/logout", { method: "POST" });
  } catch {
    // i bez serveru uživatele odhlásíme ve frontendu
  }
}

// Když chráněné API vrátí 401 (vypršelé přihlášení), aplikace se vrátí na přihlášení.
const UNAUTHORIZED = "cesty-khk:unauthorized";
export const notifyUnauthorized = () => window.dispatchEvent(new Event(UNAUTHORIZED));
export function onUnauthorized(fn: () => void) {
  window.addEventListener(UNAUTHORIZED, fn);
  return () => window.removeEventListener(UNAUTHORIZED, fn);
}
