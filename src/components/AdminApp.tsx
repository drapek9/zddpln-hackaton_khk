import { useEffect, useMemo, useState } from "react";
import MapView from "./MapView";
import RoadPanel from "./RoadPanel";
import Fold from "./Fold";
import type { Dataset, Repair, Weights } from "../lib/types";
import { DEFAULT_WEIGHTS } from "../lib/types";
import { STAV_COLOR, STAV_ORDER, formatKm, formatSil } from "../lib/geo";
import { CLASS_COLOR, CLASS_LABEL, CLASS_ORDER, fetchRanking, type RankRow, type RankingSource } from "../lib/ranking";
import { DEMO_CLOSURES } from "../lib/closure";
import { loadPins, savePins } from "../lib/store";
import type { Pin, PriorityClass } from "../lib/api";

type Props = {
  data: Dataset;
  repairs: Repair[];
  onRepairs: (next: Repair[]) => void;
  onHome: () => void;
};

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

export default function AdminApp({ data, repairs, onRepairs, onHome }: Props) {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [selectedId, setSelectedId] = useState<number | null>(null);
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
  const weightsChanged = WEIGHT_LABELS.some((w) => weights[w.key] !== DEFAULT_WEIGHTS[w.key]);

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
                      <span className="class-tag" style={{ background: CLASS_COLOR[row.priority] }}>
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
            theme="dark"
            showCondition={showCondition}
            pois={data.pois}
            stops={data.stops}
            showPois={showPois}
            detour={detour}
          />
          <div className={`params ${paramsOpen ? "open" : ""}`}>
            <button className="params-toggle" onClick={() => setParamsOpen(!paramsOpen)} aria-expanded={paramsOpen}>
              ⚙ Parametry priority{weightsChanged ? " · upraveno" : ""} {paramsOpen ? "▴" : "▾"}
            </button>
            {paramsOpen && (
              <div className="params-body">
                <p className="muted">Váhy mění pořadí úseků jen pro vás. Do dat kraje se nic neukládá.</p>
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
                <button className="btn" disabled={!weightsChanged} onClick={() => setWeights(DEFAULT_WEIGHTS)}>
                  Vrátit výchozí váhy
                </button>
              </div>
            )}
          </div>
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
    </div>
  );
}
