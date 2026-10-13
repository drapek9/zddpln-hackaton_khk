import { useMemo, useState } from "react";
import type { Connection, Repair, Road, Weights } from "../lib/types";
import { KIND_LABEL, STAV_COLOR, STATUS_LABEL, formatKm, formatPeriod, formatSil, inSchoolYear, isoInDays } from "../lib/geo";
import { impactAlerts, roadScore, scoreBreakdown } from "../lib/priority";
import { buildAnnouncement } from "../lib/announce";

type Props = {
  road: Road;
  weights: Weights;
  connections: Connection[];
  existing?: Repair;
  mode: "admin" | "public";
  onPlan?: (repair: Repair) => void;
};

function uniqueSamples(rows?: Road["samples"][string]) {
  if (!rows?.length) return [];
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.name)) return false;
    seen.add(row.name);
    return true;
  });
}

export default function RoadPanel({ road, weights, connections, existing, mode, onPlan }: Props) {
  const score = roadScore(road, weights);
  const alerts = useMemo(
    () => impactAlerts(road, existing ?? { from: isoInDays(21), to: isoInDays(40), restriction: "úplná uzavírka" }, connections),
    [road, existing, connections],
  );
  const [from, setFrom] = useState(existing?.from || isoInDays(21));
  const [to, setTo] = useState(existing?.to || isoInDays(40));
  const [restriction, setRestriction] = useState(existing?.restriction || "úplná uzavírka");
  const [note, setNote] = useState(existing?.note || "");
  const [copied, setCopied] = useState(false);

  const draft: Repair = {
    id: existing?.id || `plan-${road.id}-${Date.now()}`,
    roadId: road.id,
    usek: road.usek,
    sil: road.sil,
    title: `Oprava ${formatSil(road.sil, road.trida)}`,
    status: existing?.status || "planned",
    from,
    to,
    restriction,
    note,
    // Úprava ve správě už není ukázková data, ale vlastní návrh uživatele.
    simulated: false,
  };
  const liveAlerts = impactAlerts(road, draft, connections);
  const text = buildAnnouncement(road, draft, connections);

  return (
    <div className="panel">
      <div className="panel-kicker">{road.okres}</div>
      <h2>
        {formatSil(road.sil, road.trida)}
        <small>{road.usek}</small>
      </h2>
      <div className="stav-row">
        <span className="dot" style={{ background: STAV_COLOR[road.stav] }} />
        <strong>{road.stav}</strong>
        <span>{formatKm(road.delka)}</span>
        <span>{road.trida}</span>
        <span>měřeno {road.rok}</span>
      </div>
      {existing && (
        <p className="hint">
          {STATUS_LABEL[existing.status]} · {formatPeriod(existing)} · {existing.restriction}
          {existing.simulated && <span className="sim-tag">simulace</span>}
        </p>
      )}
      <div className="score-box">
        <div>
          <span>Skóre priority</span>
          <b>{score}</b>
        </div>
        <p>
          {road.lastRepair ? `Poslední oprava ${road.lastRepair}` : "Bez evidované opravy od 2016"}
          {road.worse ? " · stav se zhoršuje" : ""}
          {road.winter ? ` · zimní údržba: ${road.winter}` : ""}
        </p>
      </div>

      <div className="chips">
        {Object.entries(road.counts)
          .filter(([, n]) => n)
          .map(([k, n]) => (
            <span key={k} className="chip">
              {KIND_LABEL[k] || k} {n}
            </span>
          ))}
        {road.lines.length > 0 && <span className="chip">{road.lines.length} linek</span>}
        {road.hsoo?.length > 0 && <span className="chip">ohrožená oblast</span>}
      </div>

      <section>
        <h3>Upozornění při opravě</h3>
        <div className="alerts">
          {(mode === "admin" ? liveAlerts : alerts).map((a) => (
            <article key={a.title} className={`alert ${a.level}`}>
              <strong>{a.title}</strong>
              <p>{a.detail}</p>
            </article>
          ))}
        </div>
      </section>

      {road.lines.length > 0 && (
        <section>
          <h3>Linky, které se budou muset změnit</h3>
          <ul className="plain">
            {road.lines.map((l) => (
              <li key={l.linka}>
                <b>{l.linka}</b> {l.trasa}
                {l.jr && (
                  <a href={l.jr} target="_blank" rel="noreferrer">
                    jízdní řád
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {["school", "hospital", "zzs", "hzs", "stop", "social", "industry"].map((kind) => {
        const rows = uniqueSamples(road.samples[kind]);
        if (!rows?.length) return null;
        return (
          <section key={kind}>
            <h3>{KIND_LABEL[kind]}</h3>
            <ul className="plain">
              {rows.map((s) => (
                <li key={s.name + s.dist}>
                  {s.name}
                  <em>
                    {s.dist} m{s.obec ? ` · ${s.obec}` : ""}
                  </em>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section>
        <h3>Proč právě tento úsek</h3>
        <ul className="plain">
          {scoreBreakdown(road, weights).map((row) => (
            <li key={row.key}>
              {row.key}
              <em>{row.value}</em>
            </li>
          ))}
        </ul>
      </section>

      {mode === "admin" && onPlan && (
        <section className="plan-form">
          <h3>Naplánovat opravu</h3>
          <label>
            Od
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Do
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label>
            Omezení
            <select value={restriction} onChange={(e) => setRestriction(e.target.value)}>
              <option>úplná uzavírka</option>
              <option>kyvadlový provoz</option>
              <option>částečné omezení</option>
            </select>
          </label>
          <label>
            Poznámka
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </label>
          {inSchoolYear(from, to) && (road.counts.school || 0) > 0 && (
            <p className="hint">Termín zasahuje do školního roku.</p>
          )}
          <div className="row-actions">
            <button
              className="btn primary"
              onClick={() => {
                onPlan(draft);
              }}
            >
              Zveřejnit v mapě
            </button>
            <button
              className="btn"
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Zkopírováno" : "Oznámení pro obce"}
            </button>
          </div>
          <pre className="announce">{text}</pre>
        </section>
      )}
    </div>
  );
}
