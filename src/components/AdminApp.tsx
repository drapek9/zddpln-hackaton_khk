import { useMemo, useState } from "react";
import MapView from "./MapView";
import RoadPanel from "./RoadPanel";
import type { Dataset, Repair, Weights } from "../lib/types";
import { DEFAULT_WEIGHTS } from "../lib/types";
import { STAV_COLOR, STAV_ORDER, formatKm, formatSil } from "../lib/geo";
import { roadScore } from "../lib/priority";

type Props = {
  data: Dataset;
  repairs: Repair[];
  onRepairs: (next: Repair[]) => void;
  onHome: () => void;
};

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

export default function AdminApp({ data, repairs, onRepairs, onHome }: Props) {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [okres, setOkres] = useState("vše");
  const [stav, setStav] = useState("vše");
  const [query, setQuery] = useState("");
  const [showPois, setShowPois] = useState(true);
  const [showCondition, setShowCondition] = useState(true);

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

  const ranked = useMemo(
    () =>
      [...filtered]
        .map((r) => ({ r, score: roadScore(r, weights) }))
        .sort((a, b) => b.score - a.score),
    [filtered, weights],
  );

  const selected = data.roads.find((r) => r.id === selectedId) || null;
  const existing = repairs.find((r) => r.roadId === selectedId);

  const kmBad = data.roads
    .filter((r) => r.stav === "havarijní" || r.stav === "SUPERhavarijní")
    .reduce((s, r) => s + r.delka, 0);

  return (
    <div className="app-shell admin-theme">
      <header className="topbar">
        <button className="brand" onClick={onHome}>
          Cesty KHK
        </button>
        <span className="mode-tag">Správa silnic</span>
        <div className="top-stats">
          <b>{data.stats.km} km</b> sítě
          <b>{Math.round(kmBad / 1000)} km</b> havarijních
          <b>{repairs.filter((r) => r.status === "active").length}</b> probíhá
          <b>{repairs.filter((r) => r.status === "planned").length}</b> v plánu
          {repairs.some((r) => r.simulated) && <span className="sim-tag">plán a probíhající = simulace</span>}
        </div>
      </header>
      <div className="workspace">
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
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <label className="check">
            <input type="checkbox" checked={showCondition} onChange={(e) => setShowCondition(e.target.checked)} />
            Stav povrchu
          </label>
          <label className="check">
            <input type="checkbox" checked={showPois} onChange={(e) => setShowPois(e.target.checked)} />
            Školy, IZS, nemocnice
          </label>
          <h3>Váhy priority</h3>
          <p className="muted">Posuvníky mění pořadí úseků. Nic se neukládá do dat kraje.</p>
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
          <h3>Nejvyšší priorita</h3>
          <ul className="rank">
            {ranked.slice(0, 18).map(({ r, score }) => (
              <li key={r.id}>
                <button className={r.id === selectedId ? "active" : ""} onClick={() => setSelectedId(r.id)}>
                  <span className="rank-sil">
                    <i style={{ background: STAV_COLOR[r.stav] }} />
                    {formatSil(r.sil, r.trida)}
                  </span>
                  <span className="rank-meta">
                    {r.okres} · {formatKm(r.delka)}
                  </span>
                  <b>{score}</b>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="map-wrap">
          <MapView
            roads={filtered}
            repairs={repairs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            theme="dark"
            showCondition={showCondition}
            pois={data.pois}
            stops={data.stops}
            showPois={showPois}
          />
          <div className="legend">
            {STAV_ORDER.map((s) => (
              <span key={s}>
                <i style={{ background: STAV_COLOR[s] }} />
                {s}
              </span>
            ))}
          </div>
        </div>
        <aside className="side right">
          {selected ? (
            <RoadPanel
              key={selected.id}
              road={selected}
              weights={weights}
              connections={data.connections}
              existing={existing}
              mode="admin"
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
    </div>
  );
}
