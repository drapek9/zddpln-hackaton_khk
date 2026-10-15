import { useState, type FormEvent } from "react";
import { AuthError, login, ROLE_LABEL, type User } from "../lib/auth";
import { homeOf, navigate } from "../lib/route";
import AccessRequestForm from "./AccessRequestForm";

type Props = {
  area: "sprava" | "admin";
  /** Přihlášený uživatel bez oprávnění pro tuto adresu (stránka 403). */
  denied?: User | null;
  offline: boolean;
  note?: string;
  onUser: (user: User) => void;
  onLogout: () => void;
};

const TEXT = {
  sprava: {
    title: "Cesty KHK – správa silnic",
    lead: "Pro pracovníky Královéhradeckého kraje a obcí.",
    tag: "Správa",
  },
  admin: {
    title: "Cesty KHK – administrace",
    lead: "Uživatelé, váhy, audit a stav systému.",
    tag: "Zabezpečená část",
  },
};

// Přihlášení na /sprava a /admin (kap. 25.8): jen přihlášení, bez registrace a bez demo vstupu. Každá adresa má jiný vzhled.
export default function StaffLogin({ area, denied, offline, note, onUser, onLogout }: Props) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const t = TEXT[area];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      onUser(await login(name, password));
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Něco se pokazilo. Zkuste to znovu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`staff-login staff-${area}`}>
      <section className="staff-card view-enter">
        <span className="staff-tag">{t.tag}</span>
        <h1>{t.title}</h1>
        <p className="muted">{t.lead}</p>

        {denied ? (
          <>
            <p className="auth-error" role="alert">
              {area === "admin" ? "Nemáte oprávnění pro administraci." : "Nemáte oprávnění pro správu silnic."}
            </p>
            <p className="muted">
              Přihlášeno: <b>{denied.email}</b> ({ROLE_LABEL[denied.role]})
            </p>
            <button className="btn primary auth-submit" onClick={() => navigate(homeOf(denied.role))}>
              Přejít na moji stránku →
            </button>
            <button className="link" onClick={onLogout}>
              Odhlásit a přihlásit jiným účtem
            </button>
          </>
        ) : requesting ? (
          <AccessRequestForm onBack={() => setRequesting(false)} />
        ) : (
          <form className="auth-form" onSubmit={submit} noValidate>
            {note && <p className="auth-note">{note}</p>}
            {offline && (
              <p className="auth-offline">
                <b>Server je nedostupný.</b> Zkuste to za chvíli.
              </p>
            )}
            <label>
              Jméno nebo e-mail
              <input
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </label>
            <label>
              Heslo
              <span className="pw-field">
                <input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="pw-eye"
                  aria-label={show ? "Skrýt heslo" : "Zobrazit heslo"}
                  aria-pressed={show}
                  onClick={() => setShow((s) => !s)}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                    {show && <path d="M4 4l16 16" />}
                  </svg>
                </button>
              </span>
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary auth-submit" type="submit" disabled={busy || !name || !password}>
              {busy ? "Přihlašuji…" : "Přihlásit"}
            </button>
            {area === "sprava" ? (
              <p className="fine">
                Nemáte účet?{" "}
                <button type="button" className="link" onClick={() => setRequesting(true)}>
                  Požádat o přístup
                </button>
              </p>
            ) : (
              <p className="fine">Účet vydává kraj. Registrace tu není.</p>
            )}
          </form>
        )}

        {area === "sprava" && (
          <button className="link staff-back" onClick={() => navigate("/")}>
            ← Veřejná mapa
          </button>
        )}
      </section>
    </div>
  );
}
