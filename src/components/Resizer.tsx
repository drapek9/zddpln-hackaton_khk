import { useCallback, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

// Roztahovací boční panely. Každý si pracovní plochu nastaví po svém, šířky se pamatují v tomto prohlížeči.
// Když panel stáhnete až ke kraji, schová se a na okraji mapy zůstane jazýček, kterým ho zase vysunete.
// v2: výchozí šířka je nejmenší možná (dřív 340 / 400 px).
const KEY = "cesty-khk-panels-v2";
const MIN_W = 260;
const DEFAULTS = { left: MIN_W, right: MIN_W };
const MIN = MIN_W;
const MAX = 620;
/** Pod touto šířkou se panel při tažení sbalí. */
const COLLAPSE_AT = 170;

type Side = "left" | "right";
type Sizes = { left: number; right: number; leftHidden: boolean; rightHidden: boolean };

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n)));
const hiddenKey = (side: Side) => (side === "left" ? "leftHidden" : "rightHidden");

function load(): Sizes {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<Sizes>) : {};
    return {
      left: clamp(Number(v.left) || DEFAULTS.left),
      right: clamp(Number(v.right) || DEFAULTS.right),
      leftHidden: v.leftHidden === true,
      rightHidden: v.rightHidden === true,
    };
  } catch {
    return { ...DEFAULTS, leftHidden: false, rightHidden: false };
  }
}

/** Šířky panelů, styl a třídy pro .workspace. */
export function usePanelSizes() {
  const [sizes, setSizes] = useState<Sizes>(load);

  const update = useCallback((next: Sizes) => {
    setSizes(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // úložiště není dostupné, šířky platí do zavření stránky
    }
  }, []);

  const style = {
    "--left-w": sizes.leftHidden ? "0px" : `${sizes.left}px`,
    "--right-w": sizes.rightHidden ? "0px" : `${sizes.right}px`,
  } as CSSProperties;
  const className = `${sizes.leftHidden ? "left-hidden" : ""} ${sizes.rightHidden ? "right-hidden" : ""}`;
  return { sizes, update, style, className };
}

type Props = {
  side: Side;
  sizes: Sizes;
  onChange: (next: Sizes) => void;
};

export default function Resizer({ side, sizes, onChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const hidden = sizes[hiddenKey(side)];
  const label = side === "left" ? "levý panel" : "pravý panel";

  // Tažení funguje z okraje panelu i z jazýčku sbaleného panelu.
  const startDrag = (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const start = hidden ? 0 : sizes[side];
    let moved = false;
    setDragging(true);
    document.body.classList.add("is-resizing");
    // Během tažení se mění jen CSS proměnná na .workspace (bez překreslení Reactu).
    // Stav a uložení až po puštění myši, jinak by se při každém pohybu překreslila celá aplikace.
    const ws = (e.currentTarget as HTMLElement).closest(".workspace") as HTMLElement | null;
    let next: Sizes = sizes;
    let frame = 0;
    const apply = () => {
      frame = 0;
      if (!ws) return;
      const isHidden = next[hiddenKey(side)];
      ws.style.setProperty(`--${side}-w`, isHidden ? "0px" : `${next[side]}px`);
      ws.classList.toggle(`${side}-hidden`, isHidden);
    };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      if (!moved) return;
      const raw = side === "left" ? start + dx : start - dx;
      next =
        raw < COLLAPSE_AT
          ? { ...sizes, [hiddenKey(side)]: true }
          : { ...sizes, [side]: clamp(raw), [hiddenKey(side)]: false };
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const up = () => {
      if (frame) cancelAnimationFrame(frame);
      setDragging(false);
      document.body.classList.remove("is-resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (moved) onChange(next);
      // Klik na jazýček bez tažení panel vysune na poslední šířku.
      else if (hidden) onChange({ ...sizes, [hiddenKey(side)]: false });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const nudge = (delta: number) => onChange({ ...sizes, [side]: clamp(sizes[side] + delta), [hiddenKey(side)]: false });

  if (hidden) {
    return (
      <button
        className={`panel-tab ${side}`}
        onPointerDown={startDrag}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onChange({ ...sizes, [hiddenKey(side)]: false });
        }}
        aria-label={`Vysunout ${label}`}
        title={`Vysunout ${label} (klik nebo tažení)`}
      >
        {side === "left" ? "›" : "‹"}
      </button>
    );
  }

  return (
    <>
    <button
      className={`panel-collapse ${side}`}
      onClick={() => onChange({ ...sizes, [hiddenKey(side)]: true })}
      aria-label={`Schovat ${label}`}
      title={`Schovat ${label}`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
    <div
      className={`resizer ${side} ${dragging ? "dragging" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Šířka: ${label}`}
      aria-valuenow={sizes[side]}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      tabIndex={0}
      title="Táhněte pro změnu šířky, až ke kraji panel schová. Dvojklik vrátí výchozí."
      onPointerDown={startDrag}
      onDoubleClick={() => onChange({ ...sizes, [side]: DEFAULTS[side], [hiddenKey(side)]: false })}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") nudge(side === "left" ? -20 : 20);
        if (e.key === "ArrowRight") nudge(side === "left" ? 20 : -20);
        if (e.key === "Escape") onChange({ ...sizes, [hiddenKey(side)]: true });
      }}
    />
    </>
  );
}
