import { useState } from "react";

type Level = "q5" | "q20" | "q100";
type ObecImpact = { kod: string; nazev: string; obyvatel: number; studenti: number };
type Flood = {
  level: Level;
  ready?: boolean;
  closed_road_ids: number[];
  flooded_km?: number;
  students_per_day: number;
  cut_off_obce: ObecImpact[];
  cut_off_people: number;
  note?: string;
};

const LEVELS: { key: Level; label: string; hint: string }[] = [
  { key: "q5", label: "Q5", hint: "voda jednou za 5 let" },
  { key: "q20", label: "Q20", hint: "jednou za 20 let" },
  { key: "q100", label: "Q100", hint: "stoletá voda" },
];

const n = (v: number) => v.toLocaleString("cs-CZ");

// Povodňový scénář (GET /api/flood, jen pro správce): které úseky zaplaví voda a kdo zůstane odříznutý.
export default function FloodPanel({ onRoads }: { onRoads: (ids: number[]) => void }) {
  const [level, setLevel] = useState<Level | null>(null);
  const [data, setData] = useState<Flood | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const load = async (next: Level) => {
    if (next === level) {
      setLevel(null);
      setData(null);
      onRoads([]);
      return;
    }
    setLevel(next);
    setState("loading");
    try {
      const res = await fetch(`/api/flood?level=${next}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(String(res.status));
      const body: Flood = await res.json();
      setData(body);
      onRoads(body.closed_road_ids ?? []);
      setState("idle");
    } catch {
      setData(null);
      onRoads([]);
      setState("error");
    }
  };

  return (
    <>
      <p className="muted">Záplavová území (ČHMÚ): úseky pod vodou se zvýrazní v mapě. Opakovaným klepnutím scénář vypnete.</p>
      <div className="segmented small" role="group" aria-label="Úroveň povodně">
        {LEVELS.map((l) => (
          <button key={l.key} className={level === l.key ? "on" : ""} title={l.hint} onClick={() => load(l.key)}>
            {l.label}
          </button>
        ))}
      </div>
      {state === "loading" && <p className="muted">Počítám…</p>}
      {state === "error" && <p className="hint">Scénář se nepodařilo načíst. Je potřeba přihlášení správce a běžící server.</p>}
      {state === "idle" && data && (
        <div className="flood-result">
          {data.ready === false ? (
            <p className="muted">{data.note || "Záplavová data zatím nejsou načtená."}</p>
          ) : (
            <>
              <div className="flood-kpis">
                <div>
                  <b>{n(data.closed_road_ids.length)}</b>
                  <span>úseků pod vodou</span>
                </div>
                {data.flooded_km != null && (
                  <div>
                    <b>{data.flooded_km.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km</b>
                    <span>silnic kraje</span>
                  </div>
                )}
                <div>
                  <b>{n(data.students_per_day)}</b>
                  <span>studentů denně</span>
                </div>
                <div>
                  <b>{n(data.cut_off_people)}</b>
                  <span>lidí bez cesty do nemocnice</span>
                </div>
              </div>
              {data.cut_off_obce.length > 0 && (
                <p className="fine">
                  Odříznuté obce: {data.cut_off_obce.slice(0, 8).map((o) => o.nazev).join(", ")}
                  {data.cut_off_obce.length > 8 && ` a ${data.cut_off_obce.length - 8} dalších`}
                </p>
              )}
              {data.note && <p className="fine">{data.note}</p>}
            </>
          )}
        </div>
      )}
    </>
  );
}
