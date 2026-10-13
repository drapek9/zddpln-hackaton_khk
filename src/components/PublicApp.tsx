import { useMemo, useState } from "react";
import MapView from "./MapView";
import RoadPanel from "./RoadPanel";
import type { Dataset, Repair, Report } from "../lib/types";
import { DEFAULT_WEIGHTS } from "../lib/types";
import { STATUS_LABEL, STAV_COLOR } from "../lib/geo";

type Props = {
  data: Dataset;
  repairs: Repair[];
  reports: Report[];
  onReport: (report: Report) => void;
  onHome: () => void;
};

export default function PublicApp({ data, repairs, reports, onReport, onHome }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(repairs[0]?.roadId ?? null);
  const [tab, setTab] = useState<"repairs" | "bus" | "report">("repairs");
  const [status, setStatus] = useState<"all" | Repair["status"]>("all");
  const [busQuery, setBusQuery] = useState("");
  const [place, setPlace] = useState("");
  const clickLngLat = useMemo(() => ({ current: null as { lng: number; lat: number } | null }), []);
  const [reportName, setReportName] = useState("");
  const [reportNote, setReportNote] = useState("");
  const [reportObec, setReportObec] = useState("");
  const [subscribed, setSubscribed] = useState("");

  const selected = data.roads.find((r) => r.id === selectedId) || null;

  const visibleRepairs = repairs.filter((r) => (status === "all" ? r.status !== "done" : r.status === status));

  const busHits = useMemo(() => {
    const q = busQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const lines = data.lines.filter(
      (l) => l.linka.toLowerCase().includes(q) || l.trasa.toLowerCase().includes(q),
    );
    return lines.slice(0, 8).map((line) => {
      const roads = data.roads.filter((r) => r.lines.some((x) => x.linka === line.linka));
      const related = repairs.filter((rep) => roads.some((r) => r.id === rep.roadId) && rep.status !== "done");
      return { line, related };
    });
  }, [busQuery, data.lines, data.roads, repairs]);

  const placeHits = useMemo(() => {
    const q = place.trim().toLowerCase();
    if (q.length < 3) return [];
    return repairs.filter((r) => {
      const road = data.roads.find((x) => x.id === r.roadId);
      return road && `${road.okres} ${r.title} ${r.sil}`.toLowerCase().includes(q);
    });
  }, [place, repairs, data.roads]);

  return (
    <div className="app-shell public-theme">
      <header className="topbar">
        <button className="brand" onClick={onHome}>
          Cesty KHK
        </button>
        <span className="mode-tag light">Veřejnost</span>
        <label className="search grow">
          <input
            placeholder="Hledat okres, silnici nebo opravu"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </label>
      </header>
      <div className="workspace">
        <aside className="side left">
          <div className="tabs">
            <button className={tab === "repairs" ? "active" : ""} onClick={() => setTab("repairs")}>
              Opravy
            </button>
            <button className={tab === "bus" ? "active" : ""} onClick={() => setTab("bus")}>
              Můj autobus
            </button>
            <button className={tab === "report" ? "active" : ""} onClick={() => setTab("report")}>
              Nahlásit
            </button>
          </div>
          {tab === "repairs" && (
            <>
              <div className="filters">
                <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                  <option value="all">probíhá + plán</option>
                  <option value="active">probíhá</option>
                  <option value="planned">plánováno</option>
                  <option value="done">dokončeno</option>
                </select>
              </div>
              <ul className="rank">
                {(placeHits.length ? placeHits : visibleRepairs).map((r) => {
                  const road = data.roads.find((x) => x.id === r.roadId);
                  return (
                    <li key={r.id}>
                      <button className={r.roadId === selectedId ? "active" : ""} onClick={() => setSelectedId(r.roadId)}>
                        <span className="rank-sil">
                          <i className={r.status} />
                          {r.title}
                        </span>
                        <span className="rank-meta">
                          {STATUS_LABEL[r.status]} · {r.from} – {r.to}
                          {road ? ` · ${road.okres}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <label className="sub">
                Odebírat upozornění na okres
                <input
                  placeholder="např. Náchod"
                  value={subscribed}
                  onChange={(e) => setSubscribed(e.target.value)}
                />
              </label>
              {subscribed && (
                <p className="hint">
                  Demo: upozornění pro {subscribed} se uloží v tomto prohlížeči. V ostré verzi by odešly
                  e-mailem nebo do kalendáře.
                </p>
              )}
            </>
          )}
          {tab === "bus" && (
            <>
              <label className="search">
                <input
                  placeholder="Číslo linky nebo trasa, např. 101"
                  value={busQuery}
                  onChange={(e) => setBusQuery(e.target.value)}
                />
              </label>
              {busHits.length === 0 && <p className="muted">Zadejte linku IREDO a uvidíte, jestli ji něco omezuje.</p>}
              {busHits.map(({ line, related }) => (
                <article key={line.id} className="bus-card">
                  <strong>{line.linka}</strong>
                  <p>{line.trasa}</p>
                  {related.length === 0 ? (
                    <p className="ok">Na lince teď není evidovaná krajská uzavírka.</p>
                  ) : (
                    <ul>
                      {related.map((r) => (
                        <li key={r.id}>
                          <button onClick={() => setSelectedId(r.roadId)}>
                            {STATUS_LABEL[r.status]} · {r.restriction} · {r.from}–{r.to}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {line.jr && (
                    <a href={line.jr} target="_blank" rel="noreferrer">
                      Jízdní řád
                    </a>
                  )}
                </article>
              ))}
            </>
          )}
          {tab === "report" && (
            <form
              className="plan-form"
              onSubmit={(e) => {
                e.preventDefault();
                const pt = clickLngLat.current;
                if (!pt) return;
                onReport({
                  id: `rep-${Date.now()}`,
                  name: reportName || "Anonymní hlášení",
                  note: reportNote,
                  obec: reportObec,
                  created: new Date().toISOString(),
                  x: pt.lng,
                  y: pt.lat,
                });
                setReportNote("");
              }}
            >
              <p className="muted">Klikněte do mapy na výtluk nebo poškozený úsek, pak vyplňte hlášení.</p>
              <label>
                Jméno
                <input value={reportName} onChange={(e) => setReportName(e.target.value)} />
              </label>
              <label>
                Obec
                <input value={reportObec} onChange={(e) => setReportObec(e.target.value)} />
              </label>
              <label>
                Popis
                <textarea value={reportNote} onChange={(e) => setReportNote(e.target.value)} rows={3} required />
              </label>
              <button className="btn primary" type="submit" disabled={!clickLngLat.current}>
                {clickLngLat.current ? "Odeslat správě" : "Nejdřív klikněte do mapy"}
              </button>
              <ul className="plain">
                {reports.slice(0, 6).map((r) => (
                  <li key={r.id}>
                    {r.obec || "Kraj"} · {r.note}
                    <em>{r.created.slice(0, 10)}</em>
                  </li>
                ))}
              </ul>
            </form>
          )}
        </aside>
        <div className="map-wrap">
          <MapView
            roads={data.roads}
            repairs={repairs}
            selectedId={selectedId}
            onSelect={(id, lngLat) => {
              if (id != null) setSelectedId(id);
              if (lngLat) clickLngLat.current = lngLat;
            }}
            theme="light"
            showCondition
            pois={data.pois}
            showPois={false}
          />
          <div className="legend">
            <span>
              <i className="active" /> probíhá
            </span>
            <span>
              <i className="planned" /> plán
            </span>
            <span>
              <i className="done" /> hotovo
            </span>
            <span>
              <i style={{ background: STAV_COLOR.havarijní }} /> havarijní stav
            </span>
          </div>
        </div>
        <aside className="side right">
          {selected ? (
            <RoadPanel
              road={selected}
              weights={DEFAULT_WEIGHTS}
              connections={data.connections}
              existing={repairs.find((r) => r.roadId === selected.id)}
              mode="public"
            />
          ) : (
            <div className="empty">
              <h2>Aktuální opravy kraje</h2>
              <p>
                Veřejná mapa ukazuje, co se chystá a co se už opravuje. U každého úseku je vidět,
                proč má prioritu a které linky to potká.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
