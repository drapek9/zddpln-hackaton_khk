import { useMemo, useState } from "react";
import MyTrip from "./MyTrip";
import { loadPlaces, savePlaces, tripImpact, type Place } from "../lib/commute";
import MapView from "./MapView";
import RoadPanel from "./RoadPanel";
import Fold from "./Fold";
import SheetBar, { isNarrow, type Sheet } from "./SheetBar";
import Resizer, { usePanelSizes } from "./Resizer";
import UserMenu from "./UserMenu";
import type { User } from "../lib/auth";
import { ThemeToggle, useTheme } from "../lib/theme";
import { HIGHLIGHT_COLOR } from "./MapView";
import type { Dataset, Repair, Report } from "../lib/types";
import { DEFAULT_WEIGHTS } from "../lib/types";
import { STATUS_LABEL, STAV_COLOR, formatPeriod } from "../lib/geo";

type Props = {
  data: Dataset;
  repairs: Repair[];
  reports: Report[];
  onReport: (report: Report) => void;
  onHome: () => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
};

export default function PublicApp({ data, repairs, reports, onReport, onHome, user, onLogin, onLogout }: Props) {
  const [selectedId, setSelectedIdState] = useState<number | null>(repairs[0]?.roadId ?? null);
  const [sheet, setSheet] = useState<Sheet>("map");
  const panels = usePanelSizes();
  const setSelectedId = (id: number | null) => {
    setSelectedIdState(id);
    if (id != null && isNarrow()) setSheet("right");
  };
  const [tab, setTab] = useState<"trip" | "repairs" | "bus" | "report">("trip");
  const { theme } = useTheme();
  const mapTheme = theme === "dark" ? "dark" : "light";
  const [places, setPlacesState] = useState<Place[]>(loadPlaces);
  const [picking, setPicking] = useState<Place["kind"] | null>(null);
  const setPlaces = (next: Place[]) => {
    setPlacesState(next);
    savePlaces(next);
  };
  const impact = useMemo(() => tripImpact(places, data.roads, repairs), [places, data.roads, repairs]);
  const highlight = useMemo(() => (impact ? impact.repairs.map((r) => r.road.id) : []), [impact]);
  const [status, setStatus] = useState<"all" | Repair["status"]>("all");
  const [busQuery, setBusQuery] = useState("");
  const [place, setPlace] = useState("");
  // Stav (ne ref), aby se tlačítko „Odeslat“ po kliknutí do mapy hned odemklo.
  const [clickPoint, setClickPoint] = useState<{ lng: number; lat: number } | null>(null);
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
    <div className="app-shell">
      <header className="topbar">
        <div className="tb-left">
          <button className="brand" onClick={onHome}>
            Cesty KHK
          </button>
          <span className={`mode-tag ${user?.role === "citizen" ? "" : "light"}`}>{user?.role === "citizen" ? "Občan" : "Veřejnost"}</span>
        </div>
        <div className="tb-center">
          <label className="search top-search">
            <input
              placeholder="Hledat okres, silnici nebo opravu"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
            />
          </label>
        </div>
        <div className="tb-right">
          <ThemeToggle />
          <UserMenu user={user} onLogin={onLogin} onLogout={onLogout} />
        </div>
      </header>
      <div className={`workspace ${panels.className}`} data-sheet={sheet} style={panels.style}>
        <Resizer side="left" sizes={panels.sizes} onChange={panels.update} />
        <Resizer side="right" sizes={panels.sizes} onChange={panels.update} />
        <aside className="side left">
          <div className="tabs four">
            <button className={tab === "trip" ? "active" : ""} onClick={() => setTab("trip")}>
              Moje cesty
            </button>
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
          {tab === "trip" && (
            <MyTrip
              places={places}
              onPlaces={setPlaces}
              picking={picking}
              onPicking={(k) => {
                setPicking(k);
                if (k && isNarrow()) setSheet("map");
              }}
              impact={impact}
              onSelectRoad={setSelectedId}
            />
          )}
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
              <Fold title="Seznam oprav" meta={(placeHits.length ? placeHits : visibleRepairs).length} open>
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
                            {STATUS_LABEL[r.status]} · {formatPeriod(r)}
                            {road ? ` · ${road.okres}` : ""}
                            {r.simulated ? " · simulace" : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Fold>
              <Fold title="Odebírat upozornění">
                <label className="sub">
                  Okres
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
              </Fold>
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
                            {STATUS_LABEL[r.status]} · {r.restriction} · {formatPeriod(r)}
                            {r.simulated ? " · simulace" : ""}
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
                const pt = clickPoint;
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
                setClickPoint(null);
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
              {clickPoint && (
                <p className="hint">
                  Místo: {clickPoint.lat.toFixed(5)}, {clickPoint.lng.toFixed(5)}
                </p>
              )}
              <button className="btn primary" type="submit" disabled={!clickPoint}>
                {clickPoint ? "Odeslat správě" : "Nejdřív klikněte do mapy"}
              </button>
              <p className="muted">Demo: hlášení se ukládá jen v tomto prohlížeči.</p>
              {reports.length > 0 && (
                <Fold title="Moje hlášení" meta={reports.length}>
                  <ul className="plain">
                    {reports.slice(0, 6).map((r) => (
                      <li key={r.id}>
                        {r.obec || "Kraj"} · {r.note}
                        <em>{r.created.slice(0, 10)}</em>
                      </li>
                    ))}
                  </ul>
                </Fold>
              )}
            </form>
          )}
        </aside>
        <div className="map-wrap">
          <MapView
            roads={data.roads}
            repairs={repairs}
            selectedId={selectedId}
            onSelect={(id, lngLat) => {
              if (picking && lngLat) {
                setPlaces([...places.filter((p) => p.kind !== picking), { kind: picking, x: Math.round(lngLat.lng * 1000) / 1000, y: Math.round(lngLat.lat * 1000) / 1000 }]);
                setPicking(null);
                return;
              }
              if (id != null) setSelectedId(id);
              if (lngLat) setClickPoint(lngLat);
            }}
            theme={mapTheme}
            showCondition
            pois={data.pois}
            showPois={false}
            places={places}
            highlight={highlight}
          />
          {picking && <div className="pick-banner">Klikněte do mapy: {picking === "home" ? "kde bydlíte" : "kam jezdíte"}</div>}
          <SheetBar value={sheet} onChange={setSheet} left="Přehled" right="Detail" />
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
            {highlight.length > 0 && (
              <span>
                <i style={{ background: HIGHLIGHT_COLOR[mapTheme] }} /> na mé cestě
              </span>
            )}
          </div>
        </div>
        <aside className="side right">
          {selected ? (
            <RoadPanel
              key={selected.id}
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
