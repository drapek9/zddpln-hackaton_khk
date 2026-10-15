import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Weights } from "../lib/types";
import { DEFAULT_WEIGHTS } from "../lib/types";
import type { Pin } from "../lib/api";
import { CLASS_LABEL } from "../lib/ranking";
import { ROLE_LABEL, type Role } from "../lib/auth";
import {
  DEMO_USERS,
  adminApi,
  type AccessRequest,
  type AdminOverview,
  type AdminUser,
  type AiStatus,
  type AuditItem,
} from "../lib/adminApi";
import { toast } from "./Toaster";
import WeightSliders from "./WeightSliders";
import { WEIGHT_NAME } from "../lib/weights";

type Props = {
  /** Trvalé váhy kraje (výchozí pro všechny úředníky). */
  weights: Weights;
  onSaveWeights: (next: Weights) => Promise<void>;
  pins: Pin[];
  /** Přihlášený admin: data ze serveru. Jinak demo. */
  live: boolean;
  /** Hlásí neuložené změny vah (AdminApp se před odchodem zeptá). */
  onDirty?: (dirty: boolean) => void;
  /** Malá mapa kraje v rohu, po rozkliknutí velká. */
  map?: ReactNode;
  onOpenMap?: () => void;
};



const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

// Admin (v4 ★3): hlavní je nastavení, ne mapa. Trvalé váhy, uživatelé a role, záznam změn, export.
export default function AdminSystem({ weights, onSaveWeights, pins, live, onDirty, map, onOpenMap }: Props) {
  const [mapBig, setMapBig] = useState(false);
  useEffect(() => {
    if (!mapBig) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMapBig(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mapBig]);
  const [draft, setDraft] = useState<Weights>(weights);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [users, setUsers] = useState<AdminUser[]>(live ? [] : DEMO_USERS);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [filter, setFilter] = useState<Role | "all">("official");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [rejecting, setRejecting] = useState<{ id: number; reason: string } | null>(null);

  useEffect(() => setDraft(weights), [weights]);

  useEffect(() => {
    if (!live) return;
    adminApi.users().then(setUsers).catch((e: Error) => setError(e.message));
    adminApi.audit().then(setAudit).catch(() => {});
    adminApi.overview().then(setOverview).catch(() => {});
    adminApi.accessRequests().then(setRequests).catch(() => {});
    adminApi.ai().then(setAi).catch(() => {});
  }, [live]);

  // Žádosti správců o přístup (S27–S32): schválit dá roli správce, zamítnout chce důvod.
  const refreshAfterChange = () => {
    adminApi.accessRequests().then(setRequests).catch(() => {});
    adminApi.overview().then(setOverview).catch(() => {});
    adminApi.users().then(setUsers).catch(() => {});
    adminApi.audit().then(setAudit).catch(() => {});
  };
  const approve = async (r: AccessRequest) => {
    try {
      await adminApi.approve(r.id);
      toast(`Přístup schválen: ${r.email}`);
      refreshAfterChange();
    } catch (e) {
      toast((e as Error).message, "warn");
    }
  };
  const reject = async () => {
    if (!rejecting) return;
    try {
      await adminApi.reject(rejecting.id, rejecting.reason.trim());
      toast("Žádost zamítnuta");
      setRejecting(null);
      refreshAfterChange();
    } catch (e) {
      toast((e as Error).message, "warn");
    }
  };
  const toggleAi = async () => {
    if (!ai) return;
    try {
      const next = await adminApi.setAi(!ai.enabled);
      setAi(next);
      toast(next.enabled ? "AI zapnuta" : "AI vypnuta");
      adminApi.audit().then(setAudit).catch(() => {});
    } catch (e) {
      toast((e as Error).message, "warn");
    }
  };

  const changed = (Object.keys(WEIGHT_NAME) as (keyof Weights)[]).some((k) => draft[k] !== weights[k]);
  const counts = useMemo(() => {
    const out = { official: 0, admin: 0, citizen: 0, blocked: 0 };
    users.forEach((u) => {
      out[u.role] += 1;
      if (u.blocked) out.blocked += 1;
    });
    return out;
  }, [users]);
  useEffect(() => onDirty?.(changed), [changed, onDirty]);
  const q = search.trim().toLowerCase();
  const shown = users.filter((u) => (filter === "all" || u.role === filter) && (!q || u.email.toLowerCase().includes(q)));

  const save = async () => {
    setSaving("saving");
    try {
      await onSaveWeights(draft);
      setSaving("saved");
      toast("Váhy kraje uloženy pro všechny správce");
      if (live) adminApi.audit().then(setAudit).catch(() => {});
      setTimeout(() => setSaving("idle"), 1800);
    } catch {
      setSaving("error");
      toast("Uložení se nepovedlo", "warn");
    }
  };

  const updateUser = async (u: AdminUser, patch: { role?: Role; blocked?: boolean }) => {
    setError("");
    if (!live) {
      setUsers(users.map((x) => (x.id === u.id ? { ...x, ...patch } : x)));
      toast("Změněno (demo, jen v tomto prohlížeči)");
      return;
    }
    try {
      const next = await adminApi.updateUser(u.id, patch);
      setUsers(users.map((x) => (x.id === u.id ? next : x)));
      toast(patch.blocked != null ? (patch.blocked ? "Účet zablokován" : "Účet odblokován") : "Role změněna");
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
          <span>správců</span>
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
        {overview && (
          <>
            <div>
              <b>{overview.pending_requests}</b>
              <span>žádostí o přístup</span>
            </div>
            <div>
              <b>{Object.values(overview.closures_by_status).reduce((a, b) => a + b, 0)}</b>
              <span>uzavírek v systému</span>
            </div>
            <div>
              <b>{overview.notifications}</b>
              <span>odeslaných upozornění</span>
            </div>
            <div>
              <b>{overview.snapshot.roads.toLocaleString("cs-CZ")}</b>
              <span>úseků v datech</span>
            </div>
          </>
        )}
      </div>

      <div className="system-grid">
        <section className="sys-card sys-weights">
          <div className="sys-card-head">
            <h3>Trvalé váhy kraje</h3>
            {changed && <span className="chip">neuloženo</span>}
          </div>
          <p className="muted">Výchozí pořadí pro všechny správce. Správce si je může změnit jen pro sebe.</p>
          <div className="weight-grid">
            <WeightSliders weights={draft} onChange={setDraft} serverOnline={live} />
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
                  {f === "all" ? "Všichni" : f === "official" ? "Správci" : f === "admin" ? "Admini" : "Občané"}
                </button>
              ))}
            </div>
          </div>
          <label className="search">
            <input placeholder="Hledat podle e-mailu" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
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
          <p className="fine">Účty správců zakládá kraj. Registrace dává vždy roli občan, roli mění jen admin.</p>
        </section>

        {live && (
          <section className="sys-card">
            <div className="sys-card-head">
              <h3>Žádosti o přístup</h3>
              {requests.length > 0 && <span className="chip">{requests.length}</span>}
            </div>
            <p className="muted">Správci žádají o účet na /sprava. Schválením dostanou roli správce a e-mail s odkazem.</p>
            <ul className="access-list">
              {requests.map((r) => (
                <li key={r.id}>
                  <div>
                    <b>{r.name || r.email}</b>
                    <small>
                      {r.email}
                      {r.organization && ` · ${r.organization}`}
                      {r.job_title && ` · ${r.job_title}`}
                    </small>
                    <small>
                      {r.email_verified ? "e-mail ověřen" : "e-mail neověřen"}
                      {r.official_domain ? " · úřední doména" : " · jiná doména, ověřte"} · {fmtTime(r.created_at)}
                    </small>
                  </div>
                  {rejecting?.id === r.id ? (
                    <div className="row-actions">
                      <input
                        autoFocus
                        placeholder="Důvod zamítnutí"
                        value={rejecting.reason}
                        onChange={(e) => setRejecting({ id: r.id, reason: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && rejecting.reason.trim().length >= 3 && reject()}
                      />
                      <button className="btn small" disabled={rejecting.reason.trim().length < 3} onClick={reject}>
                        Zamítnout
                      </button>
                      <button className="btn small" onClick={() => setRejecting(null)}>
                        Zpět
                      </button>
                    </div>
                  ) : (
                    <div className="row-actions">
                      <button className="btn small primary" onClick={() => approve(r)}>
                        Schválit
                      </button>
                      <button className="btn small" onClick={() => setRejecting({ id: r.id, reason: "" })}>
                        Zamítnout
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {!requests.length && <li className="muted">Žádné čekající žádosti.</li>}
            </ul>
          </section>
        )}

        {live && ai && (
          <section className="sys-card">
            <div className="sys-card-head">
              <h3>Asistent AI</h3>
              <span className="chip">{!ai.enabled ? "vypnuto" : ai.configured ? "zapnuto" : "zapnuto, bez klíče"}</span>
            </div>
            <p className="muted">AI jen vysvětluje a navrhuje, skóre je vždy podle vzorce. Vypnutím zmizí návrhy AI všem správcům.</p>
            <p className="fine">
              {ai.configured
                ? `Poskytovatel ${ai.provider}${ai.model ? `, model ${ai.model}` : ""}.`
                : "Na serveru není nastavený klíč AI, funkce AI nepoběží."}
            </p>
            <div className="row-actions">
              <button className={`btn ${ai.enabled ? "" : "primary"}`} onClick={toggleAi}>
                {ai.enabled ? "Vypnout AI" : "Zapnout AI"}
              </button>
            </div>
          </section>
        )}

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
            <a className="btn" href="/api/export/metadata.jsonld" target="_blank" rel="noreferrer">
              Metadata DCAT
            </a>
            <a className="btn" href="/api/docs" target="_blank" rel="noreferrer">
              Dokumentace API
            </a>
          </div>
          <p className="fine">Odkazy fungují, když běží backend (S9, S19).</p>
        </section>

        {map && (
          <>
            {mapBig && <div className="sys-map-backdrop" onClick={() => setMapBig(false)} />}
            <section className={`sys-card sys-map ${mapBig ? "big" : ""}`}>
              <div className="sys-card-head">
                <h3>Mapa kraje</h3>
                <div className="row-actions">
                  {mapBig && onOpenMap && (
                    <button className="btn small" onClick={onOpenMap}>
                      Otevřít v prioritách
                    </button>
                  )}
                  <button className="btn small" onClick={() => setMapBig(!mapBig)} aria-expanded={mapBig}>
                    {mapBig ? "Zmenšit ✕" : "Zvětšit ⤢"}
                  </button>
                </div>
              </div>
              <div className="sys-map-body" onClick={() => !mapBig && setMapBig(true)}>
                {map}
                {!mapBig && <span className="sys-map-hint">Klikněte pro velkou mapu</span>}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
