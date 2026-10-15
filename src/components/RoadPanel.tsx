import { useMemo, useState, type CSSProperties } from "react";
import type { Connection, Repair, Road, Weights } from "../lib/types";
import { KIND_LABEL, STAV_COLOR, STAV_HINT, STATUS_LABEL, stavLabel, formatKm, formatPeriod, formatSil, inSchoolYear, isoInDays } from "../lib/geo";
import { impactAlerts, roadScore, scoreBreakdown } from "../lib/priority";
import { buildAnnouncement } from "../lib/announce";
import { CLASS_COLOR, CLASS_LABEL, CLASS_ORDER, type RankRow } from "../lib/ranking";
import type { Pin, PriorityClass } from "../lib/api";
import ClosureCard from "./ClosureCard";
import Fold from "./Fold";
import { toast } from "./Toaster";

type Props = {
  road: Road;
  weights: Weights;
  connections: Connection[];
  existing?: Repair;
  mode: "admin" | "public";
  onPlan?: (repair: Repair) => void;
  /** Pozice v žebříčku a třída (jen správa). */
  rank?: RankRow;
  pin?: Pin;
  onPin?: (pin: Pin | null) => void;
  roadsById?: Map<number, Road>;
  onDetour?: (geometry: [number, number][] | null) => void;
  /** Ukázková uzavírka: začít úplnou uzavírkou bez ohledu na uloženou opravu. */
  simulate?: boolean;
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

export default function RoadPanel({
  road,
  weights,
  connections,
  existing,
  mode,
  onPlan,
  rank,
  pin,
  onPin,
  roadsById,
  onDetour,
  simulate = false,
}: Props) {
  const score = roadScore(road, weights);
  const alerts = useMemo(
    () => impactAlerts(road, existing ?? { from: isoInDays(21), to: isoInDays(40), restriction: "úplná uzavírka" }, connections),
    [road, existing, connections],
  );
  const [from, setFrom] = useState(existing?.from || isoInDays(21));
  const [to, setTo] = useState(existing?.to || isoInDays(40));
  const [restriction, setRestriction] = useState(simulate ? "úplná uzavírka" : existing?.restriction || "úplná uzavírka");
  const [note, setNote] = useState(existing?.note || "");
  const [copied, setCopied] = useState(false);
  const [pinClass, setPinClass] = useState<PriorityClass>(pin?.priority || "kriticka");
  const [pinReason, setPinReason] = useState(pin?.reason || "");
  // Úředník: obsah rozdělený do záložek, simulace uzavírky zvlášť od přehledu a priority.
  const [tab, setTab] = useState<"prehled" | "uzavirka" | "priorita">(simulate ? "uzavirka" : "prehled");

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
  // Oba výpočty procházejí ~3 500 přípojů, proto jen při změně termínu nebo omezení.
  const liveAlerts = useMemo(
    () => impactAlerts(road, { from, to, restriction }, connections),
    [road, from, to, restriction, connections],
  );
  const text = useMemo(
    () => buildAnnouncement(road, draft, connections),
    // draft se mění jen s poli formuláře
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [road, from, to, restriction, note, connections],
  );

  return (
    <div className="panel">
      <div className="panel-kicker">{road.okres}</div>
      <h2>
        {formatSil(road.sil, road.trida)}
        <small>{road.usek}</small>
      </h2>
      <div className="stav-row">
        <span className="dot" style={{ background: STAV_COLOR[road.stav] }} />
        <strong title={STAV_HINT[road.stav]}>{stavLabel(road.stav)}</strong>
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
        {rank && (
          <div className="class-row">
            <span className="class-tag" style={{ "--cls": CLASS_COLOR[rank.priority] } as CSSProperties}>
              {CLASS_LABEL[rank.priority]}
            </span>
            <span>#{rank.rank} v kraji</span>
            {rank.pinned && (
              <span className="pin-tag">
                📌 připíchnuto{rank.modelClass !== rank.priority ? `, model: ${CLASS_LABEL[rank.modelClass]}` : ""}
              </span>
            )}
          </div>
        )}
        {rank?.pinned && rank.pinReason && <p>Důvod: {rank.pinReason}</p>}
        <p>
          {road.lastRepair ? `Poslední oprava ${road.lastRepair}` : "Bez evidované opravy od 2016"}
          {road.worse ? " · stav se zhoršuje" : ""}
          {road.winter ? ` · zimní údržba: ${road.winter}` : ""}
        </p>
      </div>

      {mode === "admin" && (
        <div className="tabs panel-tabs" role="tablist">
          {(
            [
              ["prehled", "Přehled"],
              ["uzavirka", "Uzavírka"],
              ["priorita", "Priorita"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {tab === "uzavirka" && mode === "admin" && onPlan && (
        <section className="plan-form">
          <div className="form-grid">
            <label>
              Od
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              Do
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
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
          {roadsById && onDetour && (
            <ClosureCard
              road={road}
              roadsById={roadsById}
              from={from}
              to={to}
              restriction={restriction}
              onDetour={onDetour}
            />
          )}
          <div className="row-actions">
            <button
              className="btn primary"
              onClick={() => {
                onPlan(draft);
              }}
            >
              {restriction.includes("uzavírka") ? "Potvrdit uzavírku" : "Zveřejnit v mapě"}
            </button>
            <button
              className="btn"
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                toast("Oznámení zkopírováno");
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Zkopírováno" : "Kopírovat oznámení"}
            </button>
          </div>
          <Fold title="Upozornění pro tento termín" meta={liveAlerts.length} open>
            <AlertList alerts={liveAlerts} />
          </Fold>
          <Fold title="Návrh oznámení pro obce">
            <pre className="announce">{text}</pre>
          </Fold>
        </section>
      )}

      {tab === "priorita" && mode === "admin" && onPin && (
        <section className="pin-form">
          <h3>Připíchnout prioritu</h3>
          <p className="muted">Volba úředníka má přednost před modelem. Třída modelu zůstane vidět.</p>
          <div className="pin-row">
            <select value={pinClass} onChange={(e) => setPinClass(e.target.value as PriorityClass)}>
              {CLASS_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CLASS_LABEL[c]}
                </option>
              ))}
            </select>
            <input placeholder="Důvod (povinný)" value={pinReason} onChange={(e) => setPinReason(e.target.value)} />
          </div>
          <div className="row-actions">
            <button
              className="btn primary"
              disabled={!pinReason.trim()}
              onClick={() => onPin({ road_id: road.id, priority: pinClass, reason: pinReason.trim() })}
            >
              {pin ? "Změnit" : "Připíchnout"}
            </button>
            {pin && (
              <button className="btn" onClick={() => onPin(null)}>
                Odepnout
              </button>
            )}
          </div>
          <p className="fine">Ukládá se zatím jen v tomto prohlížeči (backend S2/S4 ještě není).</p>
          <h3>Proč právě tento úsek</h3>
          <Breakdown road={road} weights={weights} />
        </section>
      )}

      {tab === "prehled" && (
        <>
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

          <Fold title="Upozornění při opravě" meta={alerts.length} open>
            <AlertList alerts={alerts} />
          </Fold>

          {road.lines.length > 0 && (
            <Fold title="Linky, které se budou muset změnit" meta={road.lines.length}>
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
            </Fold>
          )}

          {["school", "hospital", "zzs", "hzs", "stop", "social", "industry"].map((kind) => {
            const rows = uniqueSamples(road.samples[kind]);
            if (!rows?.length) return null;
            return (
              <Fold key={kind} title={KIND_LABEL[kind]} meta={rows.length}>
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
              </Fold>
            );
          })}

          <Fold title="Proč právě tento úsek">
            <Breakdown road={road} weights={weights} />
          </Fold>
        </>
      )}
    </div>
  );
}

function AlertList({ alerts }: { alerts: ReturnType<typeof impactAlerts> }) {
  return (
    <div className="alerts">
      {alerts.map((a) => (
        <article key={a.title} className={`alert ${a.level}`}>
          <strong>{a.title}</strong>
          <p>{a.detail}</p>
        </article>
      ))}
    </div>
  );
}

function Breakdown({ road, weights }: { road: Road; weights: Weights }) {
  return (
    <ul className="plain">
      {scoreBreakdown(road, weights).map((row) => (
        <li key={row.key}>
          {row.key}
          <em>{row.value}</em>
        </li>
      ))}
    </ul>
  );
}
