import { useEffect, useState, type KeyboardEvent } from "react";
import type { Weights } from "../lib/types";
import { WEIGHT_GROUPS, WEIGHT_META } from "../lib/weights";

type Props = {
  weights: Weights;
  onChange: (next: Weights) => void;
  /** Bez serveru: u parametrů, které počítá jen server, se ukáže poznámka. */
  serverOnline?: boolean;
};

// Číslo vedle posuvníku (F‑4): jde napsat, Enter potvrdí, šipky ±1, Shift ±10.
function WeightNumber({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (raw: string) => {
    const n = Math.round(Number(raw.replace(",", ".")));
    if (Number.isFinite(n)) onCommit(Math.max(0, Math.min(100, n)));
    else setText(String(value));
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit(text);
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const step = (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
      onCommit(Math.max(0, Math.min(100, value + step)));
    } else if (e.key === "Escape") setText(String(value));
  };
  return (
    <input
      className="weight-num"
      inputMode="numeric"
      aria-label={`${label}, hodnota 0 až 100`}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => commit(text)}
      onKeyDown={onKey}
    />
  );
}

/** Všech 14 parametrů ve skupinách s krátkým popisem (F‑3). */
export default function WeightSliders({ weights, onChange, serverOnline = true }: Props) {
  return (
    <div className="weight-groups">
      {WEIGHT_GROUPS.map((group) => (
        <fieldset key={group} className="weight-group">
          <legend>{group}</legend>
          {WEIGHT_META.filter((w) => w.group === group).map((w) => (
            <div key={w.key} className="weight">
              <span>
                <span className="weight-label">
                  {w.label}
                  <small>
                    {w.help}
                    {w.server && !serverOnline && " Počítá jen server."}
                  </small>
                </span>
                <WeightNumber value={weights[w.key] ?? 0} label={w.label} onCommit={(v) => onChange({ ...weights, [w.key]: v })} />
              </span>
              <input
                type="range"
                min={0}
                max={100}
                aria-label={w.label}
                value={weights[w.key] ?? 0}
                onChange={(e) => onChange({ ...weights, [w.key]: Number(e.target.value) })}
              />
            </div>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
