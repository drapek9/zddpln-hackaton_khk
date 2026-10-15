import { useEffect, useRef, useState, type RefObject } from "react";

type Obec = { kod: string; nazev: string; obyvatel: number; lon: number; lat: number };
type Hit =
  | { type: "obec"; key: string; label: string; meta: string; lon: number; lat: number }
  | { type: "road"; key: string; label: string; meta: string; id: number };

type Props = {
  placeholder: string;
  value: string;
  onValue: (v: string) => void;
  onRoad: (id: number) => void;
  onPlace: (lon: number, lat: number) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
};

// Obce z GET /api/obce načteme jednou (448 položek), silnice hledá server (GET /api/search, B‑2).
let obcePromise: Promise<Obec[]> | null = null;
const loadObce = () =>
  (obcePromise ??= fetch("/api/obce")
    .then((r) => (r.ok ? r.json() : null))
    .then((res: { items?: Obec[] } | null) => res?.items ?? [])
    .catch(() => []));

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Hledání obce nebo silnice s našeptávačem. Obec přiblíží mapu, silnice otevře detail. */
export default function SearchBox({ placeholder, value, onValue, onRoad, onPlace, inputRef }: Props) {
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const obce = (await loadObce())
        .filter((o) => norm(o.nazev).startsWith(norm(q)))
        .sort((a, b) => b.obyvatel - a.obyvatel)
        .slice(0, 5)
        .map((o): Hit => ({
          type: "obec",
          key: `o-${o.kod}`,
          label: o.nazev,
          meta: `obec · ${o.obyvatel.toLocaleString("cs-CZ")} obyvatel`,
          lon: o.lon,
          lat: o.lat,
        }));
      let roads: Hit[] = [];
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`, { signal: ctrl.signal });
        const body: { items?: { type: string; id: number; label: string }[] } = res.ok ? await res.json() : {};
        // Jedna silnice má víc úseků: ukážeme každou silnici jednou (první úsek).
        const seen = new Set<string>();
        roads = (body.items ?? [])
          .filter((i) => i.type === "road" && !seen.has(i.label) && seen.add(i.label))
          .slice(0, 6)
          .map((i): Hit => ({ type: "road", key: `r-${i.id}`, label: i.label, meta: "silnice kraje", id: i.id }));
      } catch {
        roads = [];
      }
      if (!ctrl.signal.aborted) {
        setHits([...obce, ...roads]);
        setActive(0);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (h: Hit) => {
    setOpen(false);
    onValue(h.label);
    if (h.type === "obec") onPlace(h.lon, h.lat);
    else onRoad(h.id);
  };

  return (
    <div className="search-box" ref={boxRef}>
      <label className="search">
        <input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          role="combobox"
          aria-expanded={open && hits.length > 0}
          aria-autocomplete="list"
          onChange={(e) => {
            onValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!hits.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(hits.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") pick(hits[active]);
            else if (e.key === "Escape") setOpen(false);
          }}
        />
      </label>
      {open && hits.length > 0 && (
        <ul className="search-hits" role="listbox">
          {hits.map((h, i) => (
            <li key={h.key} role="option" aria-selected={i === active}>
              <button className={i === active ? "on" : ""} onMouseEnter={() => setActive(i)} onClick={() => pick(h)}>
                <b>{h.label}</b>
                <small>{h.meta}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
