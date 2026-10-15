import { useEffect, useState } from "react";
import type { Road } from "../lib/types";
import { formatSil } from "../lib/geo";
import { simulateClosure, type ClosureResult } from "../lib/closure";

type Props = {
  road: Road;
  roadsById: Map<number, Road>;
  from: string;
  to: string;
  restriction: string;
  /** Čára objížďky pro mapu ([lon, lat]), null = žádná. */
  onDetour: (geometry: [number, number][] | null) => void;
};

const SOURCE_TAG: Record<ClosureResult["source"], string> = {
  api: "z API",
  snapshot: "předpočítáno jádrem",
  none: "",
};

function km(x: number | null | undefined) {
  return x == null ? "–" : `${x.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km`;
}

export default function ClosureCard({ road, roadsById, from, to, restriction, onDetour }: Props) {
  const full = restriction.includes("uzavírka");
  const [result, setResult] = useState<ClosureResult | null>(null);

  useEffect(() => {
    let alive = true;
    setResult(null);
    if (!full) {
      onDetour(null);
      return;
    }
    simulateClosure(road.id, from, to, restriction).then((res) => {
      if (!alive) return;
      setResult(res);
      onDetour(res.detour?.found ? res.detour.geometry : null);
    });
    return () => {
      alive = false;
    };
    // onDetour je stabilní setter z rodiče
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [road.id, from, to, restriction, full]);

  useEffect(() => () => onDetour(null), [onDetour]);

  if (!full) {
    return (
      <div className="closure-card">
        <p className="muted">Při omezení „{restriction}“ zůstává úsek průjezdný, objížďka se nepočítá.</p>
      </div>
    );
  }
  if (!result) return <div className="closure-card muted">Počítám objížďku…</div>;

  const d = result.detour;
  const via = d
    ? Array.from(new Set(d.via_road_ids.map((id) => roadsById.get(id)).filter(Boolean).map((r) => formatSil(r!.sil, r!.trida))))
    : [];

  return (
    <div className="closure-card">
      <div className="closure-head">
        <strong>Objížďka</strong>
        {result.source !== "none" && <span className="src-tag">{SOURCE_TAG[result.source]}</span>}
      </div>
      {!d ? (
        <p className="muted">
          Objížďka pro tento úsek zatím není spočítaná. Ukázka obsahuje 300 úseků z vrcholu žebříčku, ostatní
          dopočítá backend (POST /api/closures).
        </p>
      ) : !d.found ? (
        <p className="muted">Objížďka po silnicích kraje a I. třídy nenalezena. {d.note}</p>
      ) : (
        <>
          <div className="kpis">
            <div>
              <span>navíc</span>
              <b>+{km(d.extra_km)}</b>
            </div>
            <div>
              <span>času navíc</span>
              <b>+{Math.round(d.extra_min ?? 0)} min</b>
            </div>
            <div>
              <span>objížďka</span>
              <b>{km(d.detour_km)}</b>
            </div>
            <div>
              <span>aut za den</span>
              <b className="pending" title="Chybí intenzita dopravy ŘSD (úkol T7)">
                čeká na data
              </b>
            </div>
          </div>
          <p className="closure-meta">
            Zavřeno {km(d.closed_km)}
            {d.havarijni_km > 0 && <> · z objížďky {km(d.havarijni_km)} po havarijních úsecích</>}
            {d.class1_km > 0 && <> · {km(d.class1_km)} po I. třídě (OSM)</>}
          </p>
          {via.length > 0 && (
            <p className="closure-meta">
              Vede přes: {via.slice(0, 6).join(", ")}
              {via.length > 6 ? ` a ${via.length - 6} dalších` : ""}
            </p>
          )}
        </>
      )}
      {result.detourAlerts.length > 0 && (
        <div className="alerts">
          {result.detourAlerts.map((a) => (
            <article key={a.title} className={`alert ${a.level}`}>
              <strong>{a.title}</strong>
              <p>{a.detail}</p>
            </article>
          ))}
        </div>
      )}
      {result.source === "snapshot" && (
        <p className="fine">
          Snímek {result.generated} z jádra backendu (Engine.detour), výchozí váhy. Délky a časy jsou{" "}
          <span className="est-tag">odhad</span> podle grafu silnic.
        </p>
      )}
    </div>
  );
}
