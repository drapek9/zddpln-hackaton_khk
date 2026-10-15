import { useState, type FormEvent } from "react";
import { AuthError, login, register, type User } from "../lib/auth";
import type { View } from "../App";

type Props = {
  /** Server s přihlášením neběží: demo vstup je jediná cesta do správy. */
  offline: boolean;
  note?: string;
  onUser: (user: User) => void;
  onDemo: (role: "official" | "admin") => void;
  onPublic: () => void;
  onNavigate: (view: View) => void;
};

// Přihlášení a registrace občana (kap. 15.1). Roli úředníka a admina přiděluje kraj, registrace dává vždy občana.
export default function LoginCard({ offline, note, onUser, onDemo, onPublic, onNavigate }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "register" && !consent) {
      setError("Bez souhlasu se zpracováním údajů účet založit nejde.");
      return;
    }
    setBusy(true);
    try {
      const user = mode === "login" ? await login(email, password) : await register(email, password);
      onUser(user);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Něco se pokazilo. Zkuste to znovu.");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError("");
  };

  return (
        <section className="auth-card view-enter">
          <h1>{mode === "login" ? "Přihlášení" : "Registrace občana"}</h1>
          <p className="muted">
            {mode === "login" ? "Účty pro úřad vydává kraj." : "Uložená místa a upozornění na uzavírky."}
          </p>

          {note && <p className="auth-note">{note}</p>}

          {offline && (
            <p className="auth-offline">
              <b>Server s přihlášením teď neběží.</b> Správu si můžete prohlédnout v ukázce níže.
            </p>
          )}

          <form className="auth-form" onSubmit={submit} noValidate>
            <label>
              E-mail
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </label>
            <label>
              Heslo
              <input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
            {mode === "register" && (
              <label className="consent">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  Souhlasím se zpracováním e-mailu a uložených míst pro upozornění na uzavírky. Účet i místa můžu kdykoli
                  smazat.{" "}
                  <button type="button" className="link" onClick={() => onNavigate("privacy")}>
                    Zásady ochrany údajů
                  </button>
                </span>
              </label>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary auth-submit" type="submit" disabled={busy || !email || !password}>
              {busy ? "Chvilku…" : mode === "login" ? "Přihlásit" : "Založit účet"}
            </button>
          </form>

          <div className="auth-switch">
            {mode === "login" ? (
              <>
                Nemáte účet?{" "}
                <button className="link" onClick={() => switchMode("register")}>
                  Registrace občana
                </button>
              </>
            ) : (
              <>
                Už účet máte?{" "}
                <button className="link" onClick={() => switchMode("login")}>
                  Přihlásit se
                </button>
              </>
            )}
          </div>

          <div className="auth-or">
            <span>nebo</span>
          </div>
          <button className="btn auth-public" onClick={onPublic}>
            Pokračovat bez přihlášení →
          </button>

          {/* Ukázka správy bez účtu (rozhodnutí Matouše 15. 10.): nic nezapisuje na server, jen do prohlížeče. */}
          <div className="auth-demo">
            <span>Ukázka správy bez účtu</span>
            <div className="auth-demo-btns">
              <button className="btn small" onClick={() => onDemo("official")}>
                Demo úředník
              </button>
              <button className="btn small" onClick={() => onDemo("admin")}>
                Demo admin
              </button>
            </div>
            <small>Změny se ukládají jen v tomto prohlížeči.</small>
          </div>
        </section>
  );
}
