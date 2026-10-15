import { useState, type FormEvent } from "react";

// Žádost správce o přístup (kap. 25.10, POST /api/auth/request-access). Účet vznikne až po schválení adminem.
export default function AccessRequestForm({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", organization: "", job_title: "", password: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const valid =
    form.name.trim().length >= 2 &&
    form.email.includes("@") &&
    form.organization.trim().length >= 2 &&
    form.job_title.trim().length >= 2 &&
    form.password.length >= 8 &&
    consent;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consent }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body?.detail === "string" ? body.detail : "Žádost se nepodařilo odeslat. Zkuste to znovu.");
        return;
      }
      setDone(body?.detail || "Žádost odeslána. Po schválení administrátorem vám přijde e-mail.");
    } catch {
      setError("Server je nedostupný. Zkuste to za chvíli.");
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="auth-form">
        <p className="auth-note" role="status">
          {done}
        </p>
        <p className="muted">Nejdřív ověřte e-mail odkazem, který vám přišel. Pak žádost posoudí administrátor kraje.</p>
        <button className="btn auth-submit" onClick={onBack}>
          Zpět na přihlášení
        </button>
      </div>
    );

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <p className="muted">Pro pracovníky kraje, obcí a správy silnic. Žádost schvaluje administrátor kraje.</p>
      <label>
        Jméno a příjmení
        <input type="text" autoComplete="name" value={form.name} onChange={set("name")} required autoFocus />
      </label>
      <label>
        Pracovní e-mail
        <input type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={form.email} onChange={set("email")} required />
      </label>
      <label>
        Organizace
        <input type="text" autoComplete="organization" placeholder="např. Správa silnic KHK" value={form.organization} onChange={set("organization")} required />
      </label>
      <label>
        Pracovní pozice
        <input type="text" autoComplete="organization-title" value={form.job_title} onChange={set("job_title")} required />
      </label>
      <label>
        Heslo (aspoň 8 znaků)
        <input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} required />
      </label>
      <label className="check">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Souhlasím se zpracováním údajů pro posouzení žádosti.
      </label>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary auth-submit" type="submit" disabled={busy || !valid}>
        {busy ? "Odesílám…" : "Odeslat žádost"}
      </button>
      <button type="button" className="link" onClick={onBack}>
        ← Zpět na přihlášení
      </button>
    </form>
  );
}
