import { useEffect, useMemo, useState } from "react";
import type { Weights } from "../lib/types";
import { DEFAULT_WEIGHTS } from "../lib/types";
import type { Pin } from "../lib/api";
import { CLASS_LABEL } from "../lib/ranking";
import { ROLE_LABEL, type Role } from "../lib/auth";
import { DEMO_USERS, adminApi, type AdminUser, type AuditItem } from "../lib/adminApi";

type Props = {
  /** Trvalé váhy kraje (výchozí pro všechny úředníky). */
  weights: Weights;
  onSaveWeights: (next: Weights) => Promise<void>;
  pins: Pin[];
  /** Přihlášený admin: data ze serveru. Jinak demo. */
  live: boolean;
};

const WEIGHT_NAME: Record<keyof Weights, string> = {
  stav: "Stav povrchu",
  worse: "Zhoršování",
  trida: "Třída silnice",
  schools: "Školy",
  hospitals: "Nemocnice a lékaři",
  rescue: "IZS",
  transit: "Autobusy",
  industry: "Průmysl",
  social: "Ohrožené oblasti",
  age: "Stáří opravy",
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

// Admin (v4 ★3): hlavní je nastavení, ne mapa. Trvalé váhy, uživatelé a role, záznam změn, export.
export default function AdminSystem({ weights, onSaveWeights, pins, live }: Props) {
  const [draft, setDraft] = useState<Weights>(weights);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [users, setUsers] = useState<AdminUser[]>(live ? [] : DEMO_USERS);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [filter, setFilter] = useState<Role | "all">("official");
  const [error, setError] = useState("");

  useEffect(() => setDraft(weights), [weights]);

  useEffect(() => {
    if (!live) return;
    adminApi.users().then(setUsers).catch((e: Error) => setError(e.message));
    adminApi.audit().then(setAudit).catch(() => {});
  }, [live]);

  const changed = (Object.keys(WEIGHT_NAME) as (keyof Weights)[]).some((k) => draft[k] !== weights[k]);
  const counts = useMemo(() => {
    const out = { official: 0, admin: 0, citizen: 0, blocked: 0 };
    users.forEach((u) => {
      out[u.role] += 1;
      if (u.blocked) out.blocked += 1;
    });
    return out;
  }, [users]);
  const shown = users.filter((u) => filter === "all" || u.role === filter);

  const save = async () => {
    setSaving("saving");
    try {
      await onSaveWeights(draft);
      setSaving("saved");
      if (live) adminApi.audit().then(setAudit).catch(() => {});
      setTimeout(() => setSaving("idle"), 1800);
    } catch {
      setSaving("error");
    }
  };

  const updateUser = async (u: AdminUser, patch: { role?: Role; blocked?: boolean }) => {
    setError("");
    if (!live) {
      setUsers(users.map((x) => (x.id === u.id ? { ...x, ...patch } : x)));
      return;
    }
    try {
      const next = await adminApi.updateUser(u.id, patch);
      setUsers(users.map((x) => (x.id === u.id ? next : x)));
      adminApi.audit().then(setAudit).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="system view-enter">
      <header className="system-head">
        <div>
          <p className="panel-kicker">Admin</p>
          <h2>Správa systému</h2>
          <p className="muted">Nastavení platí pro celý kraj. Mapu a žebříček najdete v záložce Priority a uzavírky.</p>
        </div>
        {!live && <span className="sim-tag">demo data, bez serveru</span>}
      </header>

      <div className="sys-kpis">
        <div>
          <b>{counts.official}</b>
          <span>úředníků</span>
        </div>
        <div>
          <b>{counts.admin}</b>
          <span>adminů</span>
        </div>
        <div>
          <b>{counts.citizen}</b>
          <span>občanů</span>
        </div>
        <div>
          <b>{pins.length}</b>
          <span>připíchnutých priorit</span>
        </div>
      </div>

      <div className="system-grid">
        <section className="sys-card sys-weights">
          <div className="sys-card-head">
            <h3>Trvalé váhy kraje</h3>
            {changed && <span className="chip">neuloženo</span>}
          </div>
          <p className="muted">Výchozí pořadí pro všechny úředníky. Úředník si je může změnit jen pro sebe.</p>
          <div className="weight-grid">
            {(Object.keys(WEIGHT_NAME) as (keyof Weights)[]).map((k) => (
              <label key={k} className="weight">
                <span>
                  {WEIGHT_NAME[k]}
                  <b>{draft[k]}</b>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={draft[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
          <div className="row-actions">
            <button className="btn primary" disabled={!changed || saving === "saving"} onClick={save}>
              {saving === "saving" ? "Ukládám…" : saving === "saved" ? "Uloženo" : "Uložit pro celý kraj"}
            </button>
            <button className="btn" disabled={!changed} onClick={() => setDraft(weights)}>
              Zahodit změny
            </button>
            <button className="btn" onClick={() => setDraft(DEFAULT_WEIGHTS)}>
              Výchozí hodnoty
            </button>
          </div>
          {saving === "error" && <p className="hint">Uložení se nepovedlo.</p>}
          {!live && <p className="fine">Demo: ukládá se jen v tomto prohlížeči.</p>}
        </section>

        <section className="sys-card sys-users">
          <div className="sys-card-head">
            <h3>Uživatelé a role</h3>
            <div className="segmented small">
              {(["official", "admin", "citizen", "all"] as const).map((f) => (
                <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                  {f === "all" ? "Všichni" : f === "official" ? "Úředníci" : f === "admin" ? "Admini" : "Občané"}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="hint">{error}</p>}
          <table className="sys-table">
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Role</th>
                <th>Stav</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id} className={u.blocked ? "blocked" : ""}>
                  <td>
                    <span className="user-cell">
                      <span className="user-avatar" aria-hidden="true">
                        {u.email.slice(0, 1).toUpperCase()}
                      </span>
                      <span title={u.email}>{u.email}</span>
                    </span>
                  </td>
                  <td>
                    <select value={u.role} onChange={(e) => updateUser(u, { role: e.target.value as Role })}>
                      {(["citizen", "official", "admin"] as const).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="btn small" onClick={() => updateUser(u, { blocked: !u.blocked })}>
                      {u.blocked ? "Odblokovat" : "Zablokovat"}
                    </button>
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={3} className="muted">
                    Nikdo v této skupině.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="fine">Účty úředníků zakládá kraj. Registrace dává vždy roli občan, roli mění jen admin.</p>
        </section>

        <section className="sys-card">
          <h3>Záznam změn</h3>
          <ul className="audit">
            {audit.map((a) => (
              <li key={a.id}>
                <span>
                  <b>{a.action}</b> {a.detail}
                </span>
                <em>
                  {a.email} · {fmtTime(a.created_at)}
                </em>
              </li>
            ))}
            {pins.map((p) => (
              <li key={`pin-${p.road_id}`}>
                <span>
                  <b>pin</b> úsek {p.road_id} → {CLASS_LABEL[p.priority]}
                </span>
                <em>{p.reason || "bez důvodu"} · tento prohlížeč</em>
              </li>
            ))}
            {!audit.length && !pins.length && <li className="muted">Zatím žádné změny.</li>}
          </ul>
        </section>

        <section className="sys-card">
          <h3>Otevřená data a API</h3>
          <p className="muted">Skóre a třídy jako otevřená data s metadaty DCAT‑AP‑CZ a česká dokumentace API.</p>
          <div className="row-actions">
            <a className="btn" href="/api/export.csv">
              CSV
            </a>
            <a className="btn" href="/api/export.geojson">
              GeoJSON
            </a>
            <a className="btn" href="/api/docs" target="_blank" rel="noreferrer">
              Dokumentace API
            </a>
          </div>
          <p className="fine">Odkazy fungují, když běží backend (S9, S19).</p>
        </section>
      </div>
    </div>
  );
}
