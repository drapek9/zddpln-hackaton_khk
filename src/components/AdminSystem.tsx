import type { Weights } from "../lib/types";
import type { Pin } from "../lib/api";
import { CLASS_LABEL } from "../lib/ranking";

type Props = {
  weights: Weights;
  pins: Pin[];
};

// Admin (milník v4 ★3). Zatím návrh obrazovky, data dodá backend S3 (uživatelé), S2 (audit), S9 (export).
const DEMO_USERS = [
  { name: "Úředník – odbor dopravy", role: "Úředník", state: "aktivní" },
  { name: "Cestmistrovství Jičín", role: "Úředník", state: "aktivní" },
  { name: "Admin kraje", role: "Admin", state: "aktivní" },
];

export default function AdminSystem({ weights, pins }: Props) {
  return (
    <div className="system">
      <header className="system-head">
        <div>
          <p className="panel-kicker">Admin · milník v4</p>
          <h2>Správa systému</h2>
          <p className="muted">Návrh obrazovky. Tlačítka se odemknou, až poběží přihlášení a databáze (S2, S3, S9).</p>
        </div>
        <span className="sim-tag">demo data</span>
      </header>
      <div className="system-grid">
        <section className="sys-card">
          <h3>Uživatelé a role</h3>
          <table className="sys-table">
            <tbody>
              {DEMO_USERS.map((u) => (
                <tr key={u.name}>
                  <td>{u.name}</td>
                  <td>
                    <span className="chip">{u.role}</span>
                  </td>
                  <td className="muted">{u.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn" disabled>
            Pozvat úředníka
          </button>
        </section>

        <section className="sys-card">
          <h3>Trvalé váhy kraje</h3>
          <p className="muted">Platí pro všechny úředníky. Úředník si je může jen dočasně přepsat pro sebe.</p>
          <div className="weight-bars">
            {Object.entries(weights).map(([k, v]) => (
              <div key={k}>
                <span>{WEIGHT_NAME[k] || k}</span>
                <div className="meter small">
                  <div style={{ width: `${v}%` }} />
                </div>
                <b>{v}</b>
              </div>
            ))}
          </div>
          <button className="btn" disabled>
            Uložit pro celý kraj
          </button>
        </section>

        <section className="sys-card">
          <h3>Záznam změn (audit)</h3>
          <ul className="plain">
            {pins.length === 0 && <li className="muted">Zatím žádné připíchnutí priority.</li>}
            {pins.map((p) => (
              <li key={p.road_id}>
                Připíchnuto: úsek {p.road_id} → {CLASS_LABEL[p.priority]}
                <em>{p.reason}</em>
              </li>
            ))}
          </ul>
          <p className="fine">Teď jen z tohoto prohlížeče. Kdo, kdy a proč přijde s backendem.</p>
        </section>

        <section className="sys-card">
          <h3>Otevřená data a API</h3>
          <p className="muted">Export skóre a tříd jako CSV a GeoJSON s metadaty DCAT‑AP‑CZ. Česká dokumentace API.</p>
          <div className="row-actions">
            <button className="btn" disabled>
              Stáhnout CSV
            </button>
            <button className="btn" disabled>
              GeoJSON
            </button>
            <button className="btn" disabled>
              Dokumentace API
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const WEIGHT_NAME: Record<string, string> = {
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
