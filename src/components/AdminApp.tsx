import { useEffect, useMemo, useState, type CSSProperties } from "react";
import MapView from "./MapView";
import RoadPanel from "./RoadPanel";
import Fold from "./Fold";
import { ThemeToggle, useTheme } from "../lib/theme";
import BudgetPlanner from "./BudgetPlanner";
import AdminSystem from "./AdminSystem";
import SheetBar, { isNarrow, type Sheet } from "./SheetBar";
import Resizer, { usePanelSizes } from "./Resizer";
import UserMenu from "./UserMenu";
import type { User } from "../lib/auth";
import type { Dataset, Repair, Weights } from "../lib/types";
import { DEFAULT_WEIGHTS } from "../lib/types";
import { STAV_COLOR, STAV_HINT, STAV_ORDER, formatKm, formatSil, stavLabel } from "../lib/geo";
import { CLASS_COLOR, CLASS_LABEL, CLASS_ORDER, fetchRanking, type RankRow, type RankingSource } from "../lib/ranking";
import { DEMO_CLOSURES } from "../lib/closure";
import { loadPins, loadRegionWeights, savePins, saveRegionWeights } from "../lib/store";
import type { Pin, PriorityClass } from "../lib/api";

type Props = {
  data: Dataset;
  repairs: Repair[];
  onRepairs: (next: Repair[]) => void;
  onHome: () => void;
  role: "official" | "admin";
  /** Přihlášený uživatel (kap. 15). Bez něj jde o demo bez serveru. */
  user: User | null;
  /** Demo bez serveru: přepnutí mezi úředníkem a adminem. S přihlášením roli dává účet. */
  onRole?: (role: "official" | "admin") => void;
  onLogout: () => void;
};

type View = "map" | "budget" | "system";
const VIEWS: { key: View; label: string; adminOnly?: boolean; soon?: boolean }[] = [
  { key: "map", label: "Priority a uzavírky" },
  { key: "budget", label: "Plán podle rozpočtu" },
  { key: "system", label: "Správa systému", adminOnly: true, soon: true },
];

// Kolik úseků žebříčku je vidět, než si je úředník rozbalí.
const LIST_STEP = 15;

const WEIGHT_LABELS: { key: keyof Weights; label: string }[] = [
  { key: "stav", label: "Stav povrchu" },
  { key: "worse", label: "Zhoršování" },
  { key: "trida", label: "Třída silnice" },
  { key: "schools", label: "Školy" },
  { key: "hospitals", label: "Nemocnice a lékaři" },
  { key: "rescue", label: "IZS" },
  { key: "transit", label: "Autobusy" },
  { key: "industry", label: "Průmysl" },
  { key: "social", label: "Ohrožené oblasti" },
  { key: "age", label: "Stáří opravy" },
];

export default function AdminApp({ data, repairs, onRepairs, onHome, role, user, onRole, onLogout }: Props) {
  const [view, setView] = useState<View>("map");
  useEffect(() => {
    if (role !== "admin" && view === "system") setView("map");
  }, [role, view]);
  const { theme } = useTheme();
  const mapTheme = theme === "dark" ? "dark" : "office";
  // Výchozí jsou trvalé váhy kraje od admina. Úředník je mění jen pro sebe, admin je může uložit trvale.
  const [regionWeights, setRegionWeights] = useState<Weights>(() => loadRegionWeights(DEFAULT_WEIGHTS));
  const [weights, setWeights] = useState<Weights>(regionWeights);
  const [savedNote, setSavedNote] = useState(false);
  const [selectedId, setSelectedIdState] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet>("map");
  const panels = usePanelSizes();
  const setSelectedId = (id: number | null) => {
    setSelectedIdState(id);
    if (id != null && isNarrow()) setSheet("right");
  };
  const [okres, setOkres] = useState("vše");
  const [stav, setStav] = useState("vše");
  const [query, setQuery] = useState("");
  const [showPois, setShowPois] = useState(true);
  const [showCondition, setShowCondition] = useState(true);
  const [cls, setCls] = useState<PriorityClass | "vše">("vše");
  const [pins, setPins] = useState<Pin[]>(loadPins);
  const [rows, setRows] = useState<RankRow[]>([]);
  const [source, setSource] = useState<RankingSource>("local");
  const [detour, setDetour] = useState<[number, number][] | null>(null);
  // Úsek vybraný z ukázkových uzavírek: simulace začne úplnou uzavírkou.
  const [demoId, setDemoId] = useState<number | null>(null);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [listLimit, setListLimit] = useState(LIST_STEP);
  const weightsChanged = WEIGHT_LABELS.some((w) => weights[w.key] !== regionWeights[w.key]);

  const roadsById = useMemo(() => new Map(data.roads.map((r) => [r.id, r])), [data.roads]);

  // Žebříček se počítá nad celou sítí (třídy jsou podíly sítě), filtry jen zužují výpis.
  useEffect(() => {
    let alive = true;
    fetchRanking(data.roads, weights, pins).then((res) => {
      if (!alive) return;
      setRows(res.rows);
      setSource(res.source);
    });
    return () => {
      alive = false;
    };
  }, [data.roads, weights, pins]);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const updatePins = (next: Pin[]) => {
    setPins(next);
    savePins(next);
  };

  const okresy = useMemo(
    () => ["vše", ...Array.from(new Set(data.roads.map((r) => r.okres))).sort()],
    [data.roads],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.roads.filter((r) => {
      if (okres !== "vše" && r.okres !== okres) return false;
      if (stav !== "vše" && r.stav !== stav) return false;
      if (q && !`${r.sil} ${r.usek} ${r.okres}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.roads, okres, stav, query]);

  const ranked = useMemo(() => {
    const visible = new Set(filtered.map((r) => r.id));
    return rows
      .filter((row) => visible.has(row.id) && (cls === "vše" || row.priority === cls))
      .map((row) => ({ r: roadsById.get(row.id)!, row }));
  }, [rows, filtered, cls, roadsById]);

  const classKm = useMemo(() => {
    const out: Record<string, number> = {};
    rows.forEach((row) => (out[row.priority] = (out[row.priority] || 0) + (roadsById.get(row.id)?.delka || 0)));
    return out;
  }, [rows, roadsById]);

  const selected = data.roads.find((r) => r.id === selectedId) || null;
  const existing = repairs.find((r) => r.roadId === selectedId);

  const kmBad = data.roads
    .filter((r) => r.stav === "havarijní" || r.stav === "SUPERhavarijní")
    .reduce((s, r) => s + r.delka, 0);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="tb-left">
          <button className="brand" onClick={onHome}>
            Cesty KHK
          </button>
          {onRole ? (
            <div className="role-switch" role="group" aria-label="Pohled (demo bez serveru)" title="Demo bez serveru: přepnutí role">
              <button className={role === "official" ? "on" : ""} onClick={() => onRole("official")}>
                Úředník
              </button>
              <button className={role === "admin" ? "on" : ""} onClick={() => onRole("admin")}>
                Admin
              </button>
            </div>
          ) : (
            <span className="mode-tag">{role === "admin" ? "Admin" : "Úředník"}</span>
          )}
        </div>
        <div className="tb-center">
          <nav className="top-nav">
            {VIEWS.filter((v) => !v.adminOnly || role === "admin").map((v) => (
              <button key={v.key} className={view === v.key ? "active" : ""} onClick={() => setView(v.key)}>
                {v.label}
                {v.soon && <small>návrh</small>}
              </button>
            ))}
          </nav>
        </div>
        <div className="tb-right">
          <div className="top-stats" title={repairs.some((r) => r.simulated) ? "Plánované a probíhající opravy jsou simulace" : undefined}>
            <span>
              <b>{Math.round(kmBad / 1000)} km</b> havarijních
            </span>
            <span>
              <b>{repairs.filter((r) => r.status === "active").length}</b> probíhá
            </span>
            <span>
              <b>{repairs.filter((r) => r.status === "planned").length}</b> v plánu
            </span>
          </div>
          <ThemeToggle />
          {user ? <UserMenu user={user} onLogout={onLogout} /> : <span className="sim-tag" title="Server s přihlášením neběží">demo</span>}
        </div>
      </header>
      {view === "budget" && <BudgetPlanner key="budget" data={data} weights={weights} />}
      {view === "system" && <AdminSystem key="system" weights={regionWeights} pins={pins} />}
      {view === "map" && (
      <div className={`workspace view-enter ${panels.className}`} data-sheet={sheet} style={panels.style}>
        <Resizer side="left" sizes={panels.sizes} onChange={panels.update} />
        <Resizer side="right" sizes={panels.sizes} onChange={panels.update} />
        <aside className="side left">
          <label className="search">
            <input
              placeholder="Číslo silnice nebo úsek"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="filters">
            <select value={okres} onChange={(e) => setOkres(e.target.value)}>
              {okresy.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <select value={stav} onChange={(e) => setStav(e.target.value)}>
              <option value="vše">všechny stavy</option>
              {STAV_ORDER.map((s) => (
                <option key={s} value={s}>
                  {stavLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="class-filter">
            {(["vše", ...CLASS_ORDER] as const).map((c) => (
              <button key={c} className={cls === c ? "on" : ""} onClick={() => setCls(c)}>
                {c !== "vše" && <i style={{ background: CLASS_COLOR[c] }} />}
                {c === "vše" ? "vše" : CLASS_LABEL[c]}
                {c !== "vše" && <small>{Math.round((classKm[c] || 0) / 1000)} km</small>}
              </button>
            ))}
          </div>
          <Fold title="Žebříček priority" meta={`${ranked.length} úseků`} open>
            <p className="muted">
              {source === "api" ? (
                <span className="src-tag">z API</span>
              ) : (
                <span className="src-tag" title="GET /api/ranking zatím neběží, stejný algoritmus jako backend">
                  lokální výpočet
                </span>
              )}{" "}
              Horních 10 % sítě je kritická, 20 % vysoká, 30 % střední, zbytek nízká.
            </p>
            <ul className="rank">
              {ranked.slice(0, listLimit).map(({ r, row }) => (
                <li key={r.id}>
                  <button className={r.id === selectedId ? "active" : ""} onClick={() => setSelectedId(r.id)}>
                    <span className="rank-sil">
                      <i style={{ background: STAV_COLOR[r.stav] }} />
                      {formatSil(r.sil, r.trida)}
                      <span className="class-tag" style={{ "--cls": CLASS_COLOR[row.priority] } as CSSProperties}>
                        {CLASS_LABEL[row.priority]}
                      </span>
                      {row.pinned && (
                        <span className="pin-tag" title={row.pinReason || "připíchnuto úředníkem"}>
                          📌
                        </span>
                      )}
                    </span>
                    <span className="rank-meta">
                      #{row.rank} · {r.okres} · {formatKm(r.delka)}
                    </span>
                    <b>{row.score}</b>
                  </button>
                </li>
              ))}
              {!ranked.length && <li className="muted">Filtrům neodpovídá žádný úsek.</li>}
            </ul>
            {ranked.length > LIST_STEP && (
              <div className="row-actions list-more">
                {listLimit < ranked.length && (
                  <button className="btn" onClick={() => setListLimit(listLimit + 50)}>
                    Dalších 50
                  </button>
                )}
                {listLimit < ranked.length ? (
                  <button className="btn" onClick={() => setListLimit(ranked.length)}>
                    Rozbalit vše ({ranked.length})
                  </button>
                ) : (
                  <button className="btn" onClick={() => setListLimit(LIST_STEP)}>
                    Sbalit
                  </button>
                )}
              </div>
            )}
          </Fold>
          <Fold title="Ukázkové uzavírky" meta={DEMO_CLOSURES.length}>
            <p className="muted">Vyberte ukázku nebo úsek v mapě. Vpravo v záložce Uzavírka uvidíte objížďku a dopady.</p>
            <div className="demo-closures">
              {DEMO_CLOSURES.map((d) => (
                <button
                  key={d.roadId}
                  className={d.roadId === selectedId ? "active" : ""}
                  onClick={() => {
                    setDemoId(d.roadId);
                    setSelectedId(d.roadId);
                  }}
                >
                  <strong>{d.label}</strong>
                  <span>{d.story}</span>
                </button>
              ))}
            </div>
          </Fold>
          <Fold title="Vrstvy mapy">
            <label className="check">
              <input type="checkbox" checked={showCondition} onChange={(e) => setShowCondition(e.target.checked)} />
              Stav povrchu
            </label>
            <label className="check">
              <input type="checkbox" checked={showPois} onChange={(e) => setShowPois(e.target.checked)} />
              Školy, IZS, nemocnice
            </label>
          </Fold>
        </aside>
        <div className="map-wrap">
          <MapView
            roads={filtered}
            repairs={repairs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            theme={mapTheme}
            showCondition={showCondition}
            pois={data.pois}
            stops={data.stops}
            showPois={showPois}
            detour={detour}
          />
          <div className={`params ${paramsOpen ? "open" : ""}`}>
            <button className="params-toggle" onClick={() => setParamsOpen(!paramsOpen)} aria-expanded={paramsOpen}>
              <span>Parametry priority</span>
              {weightsChanged && <span className="chip">upraveno</span>}
              <span className="muted" style={{ marginLeft: "auto" }}>{paramsOpen ? "▴" : "▾"}</span>
            </button>
            {paramsOpen && (
              <div className="params-body">
                <p className="params-scope">
                  {role === "admin" ? (
                    <>
                      Admin: můžete uložit <b>trvale pro celý kraj</b>.
                    </>
                  ) : (
                    <>
                      Změny platí <b>jen pro vás</b>. Trvalé váhy kraje mění admin.
                    </>
                  )}
                </p>
                {WEIGHT_LABELS.map((w) => (
                  <label key={w.key} className="weight">
                    <span>
                      {w.label}
                      <b>{weights[w.key]}</b>
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={weights[w.key]}
                      onChange={(e) => setWeights({ ...weights, [w.key]: Number(e.target.value) })}
                    />
                  </label>
                ))}
                <div className="row-actions">
                  <button className="btn" disabled={!weightsChanged} onClick={() => setWeights(regionWeights)}>
                    Vrátit váhy kraje
                  </button>
                  {role === "admin" && (
                    <button
                      className="btn primary"
                      disabled={!weightsChanged}
                      onClick={() => {
                        setRegionWeights(weights);
                        saveRegionWeights(weights);
                        setSavedNote(true);
                        setTimeout(() => setSavedNote(false), 2000);
                      }}
                    >
                      {savedNote ? "Uloženo" : "Uložit pro celý kraj"}
                    </button>
                  )}
                </div>
                {role === "admin" && <p className="fine">Demo: ukládá se v tomto prohlížeči, pro všechny až s backendem (v4).</p>}
              </div>
            )}
          </div>
          <SheetBar value={sheet} onChange={setSheet} left="Žebříček" right="Detail" />
          <div className="legend">
            {STAV_ORDER.map((s) => (
              <span key={s}>
                <i style={{ background: STAV_COLOR[s] }} />
                <span title={STAV_HINT[s]}>{stavLabel(s)}</span>
              </span>
            ))}
          </div>
        </div>
        <aside className="side right">
          {selected ? (
            <RoadPanel
              key={`${selected.id}-${demoId === selected.id}`}
              simulate={demoId === selected.id}
              road={selected}
              weights={weights}
              connections={data.connections}
              existing={existing}
              mode="admin"
              rank={rowById.get(selected.id)}
              pin={pins.find((p) => p.road_id === selected.id)}
              onPin={(pin) => updatePins([...pins.filter((p) => p.road_id !== selected.id), ...(pin ? [pin] : [])])}
              roadsById={roadsById}
              onDetour={setDetour}
              onPlan={(repair) => {
                const next = [repair, ...repairs.filter((r) => r.id !== repair.id && r.roadId !== repair.roadId)];
                onRepairs(next);
              }}
            />
          ) : (
            <div className="empty">
              <h2>Vyberte úsek</h2>
              <p>
                Klikněte na silnici v mapě nebo v žebříčku. Uvidíte školy, zastávky, linky a
                zaručené přípoje, které uzavírka ohrozí.
              </p>
              <ul className="legend-repairs">
                <li>
                  <i className="active" /> probíhající oprava
                </li>
                <li>
                  <i className="planned" /> plán
                </li>
                <li>
                  <i className="done" /> dokončeno
                </li>
              </ul>
            </div>
          )}
        </aside>
      </div>
      )}
    </div>
  );
}
