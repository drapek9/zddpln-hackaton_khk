import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import MapView from "./MapView";
import RoadPanel from "./RoadPanel";
import Fold from "./Fold";
import { ThemeToggle, useTheme } from "../lib/theme";
import BudgetPlanner from "./BudgetPlanner";
import AdminSystem from "./AdminSystem";
import SheetBar, { SheetClose, isNarrow, type Sheet } from "./SheetBar";
import Resizer, { usePanelSizes } from "./Resizer";
import UserMenu from "./UserMenu";
import DetailSheet from "./DetailSheet";
import { adminApi } from "../lib/adminApi";
import type { User } from "../lib/auth";
import type { Dataset, Repair, Weights } from "../lib/types";
import Dialog from "./Dialog";
import WeightSliders from "./WeightSliders";
import SearchBox from "./SearchBox";
import FloodPanel from "./FloodPanel";
import { WEIGHT_META, useWeightPresets } from "../lib/weights";
import { DEFAULT_WEIGHTS, WEIGHT_PRESETS } from "../lib/types";
import { STATUS_LABEL, STAV_COLOR, STAV_HINT, STAV_ORDER, formatKm, formatPeriod, formatSil, stavLabel } from "../lib/geo";
import { CLASS_COLOR, CLASS_LABEL, CLASS_ORDER, fetchRanking, type RankRow, type RankingSource } from "../lib/ranking";
import { DEMO_CLOSURES } from "../lib/closure";
import { loadOfficePrefs, loadPins, loadRegionWeights, saveOfficePrefs, savePins, saveRegionWeights } from "../lib/store";
import { toast } from "./Toaster";
import { mainReason } from "../lib/priority";
import { api, type Pin, type PriorityClass } from "../lib/api";
import { roadFromUrl, setRoadInUrl } from "../lib/route";

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
// Admin začíná na Správě systému (nastavení je pro něj hlavní), úředník na mapě.
const VIEWS: { key: View; label: string; adminOnly?: boolean; soon?: boolean }[] = [
  { key: "system", label: "Správa systému", adminOnly: true },
  { key: "map", label: "Priority a uzavírky" },
  { key: "budget", label: "Plán podle rozpočtu" },
];

// Kolik úseků žebříčku je vidět, než si je úředník rozbalí.
const LIST_STEP = 15;

const WEIGHT_LABELS = WEIGHT_META;

export default function AdminApp({ data, repairs, onRepairs, onHome, role, user, onRole, onLogout }: Props) {
  const [view, setView] = useState<View>(role === "admin" ? "system" : "map");
  // Demo přepínač rolí: admin jde na Správu systému, úředník ji nemá.
  useEffect(() => {
    setView((v) => (role === "admin" ? "system" : v === "system" ? "map" : v));
  }, [role]);
  const live = !!user && user.role === "admin";
  const [systemDirty, setSystemDirty] = useState(false);
  // Strop hlasů ze serveru, ať ho uložení vah nepřepíše (NAPADY D5).
  const voteCap = useRef<number | undefined>(undefined);
  const goView = (next: View) => {
    if (view === "system" && next !== "system" && systemDirty && !window.confirm("Máte neuložené váhy kraje. Odejít bez uložení?")) return;
    setView(next);
  };
  const { theme } = useTheme();
  const mapTheme = theme === "dark" ? "dark" : "office";
  // Výchozí jsou trvalé váhy kraje od admina. Úředník je mění jen pro sebe, admin je může uložit trvale.
  const [regionWeights, setRegionWeights] = useState<Weights>(() => loadRegionWeights(DEFAULT_WEIGHTS));
  const [weights, setWeights] = useState<Weights>(regionWeights);
  const [savedNote, setSavedNote] = useState(false);
  const [weightMode, setWeightMode] = useState<"simple" | "detail">("simple");
  const [preset, setPreset] = useState<string | null>(null);
  // Předvolby ze serveru (B‑3, GET /api/weights/presets), bez serveru návrh aplikace.
  const { presets, fromServer: presetsFromServer } = useWeightPresets(WEIGHT_PRESETS);

  // Přihlášený admin: trvalé váhy ze serveru (GET /api/admin/weights).
  useEffect(() => {
    if (!live) return;
    adminApi
      .weights()
      .then(({ weights: w, vote_cap }) => {
        voteCap.current = vote_cap;
        const next = { ...DEFAULT_WEIGHTS, ...w };
        setRegionWeights(next);
        setWeights(next);
      })
      .catch(() => {});
  }, [live]);

  const saveRegion = async (next: Weights) => {
    if (live) await adminApi.saveWeights(next, voteCap.current);
    else saveRegionWeights(next);
    setRegionWeights(next);
    setWeights(next);
  };
  // Úředník na /sprava: vybraný úsek je v adrese (/sprava/usek/123), odkaz jde poslat kolegovi a obnovení ho drží.
  const urlRoads = !onRole && role === "official";
  const [selectedId, setSelectedIdState] = useState<number | null>(() => (urlRoads ? roadFromUrl() : null));
  useEffect(() => {
    if (urlRoads) setRoadInUrl("sprava", selectedId);
  }, [urlRoads, selectedId]);
  const [sheet, setSheet] = useState<Sheet>("map");
  const panels = usePanelSizes();
  const setSelectedId = (id: number | null) => {
    setSelectedIdState(id);
    // F‑10: otevřený detail zavře plovoucí panel vah, ať se nepřekrývají.
    if (id != null) setParamsOpen(false);
    if (id != null && isNarrow()) setSheet("map");
  };
  // Filtry a vrstvy si úředník nastaví jednou, pamatují se v tomto prohlížeči.
  const prefs = useMemo(loadOfficePrefs, []);
  const [okres, setOkres] = useState(prefs.okres);
  const [stav, setStav] = useState(prefs.stav);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<{ lon: number; lat: number; t: number } | null>(null);
  const [floodIds, setFloodIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<"rank" | "score" | "length" | "stav">("rank");
  const [onlyBad, setOnlyBad] = useState(false);
  // Seznam uzavírek a oprav s filtrem termínu (kap. 25.2): ukáže ty, které do zvoleného období zasahují.
  const [closFrom, setClosFrom] = useState("");
  const [closTo, setClosTo] = useState("");
  const [showPois, setShowPois] = useState(prefs.showPois);
  // Uzavírky jsou na mapě jen po zaškrtnutí ve filtru, stejně jako u veřejnosti.
  const [layers, setLayers] = useState({ repairs: false, srti: false });
  const [showCondition, setShowCondition] = useState(prefs.showCondition);
  const [cls, setCls] = useState<PriorityClass | "vše">(prefs.cls);
  useEffect(() => saveOfficePrefs({ okres, stav, showPois, showCondition, cls }), [okres, stav, showPois, showCondition, cls]);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // F‑8: tlačítko „Nahoru“ po odscrollování levého panelu.
  const sideRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [pins, setPins] = useState<Pin[]>(loadPins);
  const [rows, setRows] = useState<RankRow[]>([]);
  const [source, setSource] = useState<RankingSource>("local");
  const [rankingLoading, setRankingLoading] = useState(false);
  // F‑2: „Jen parametry“ / „Parametry + AI“. AI jen posouvá v okně a má vždy štítek „návrh AI“.
  const [aiOn, setAiOn] = useState(false);
  const [aiState, setAiState] = useState<{ mode?: string; note?: string }>({});
  const [detour, setDetour] = useState<[number, number][] | null>(null);
  // Úsek vybraný z ukázkových uzavírek: simulace začne úplnou uzavírkou.
  const [demoId, setDemoId] = useState<number | null>(null);
  // Ukázkové uzavírky ze serveru (skutečný plán 2022), doporučené první; bez serveru lokální seznam.
  const [demos, setDemos] = useState(DEMO_CLOSURES);
  useEffect(() => {
    fetch("/api/demo-closures")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const ids = new Set(data.roads.map((r) => r.id));
        const items: { nazev: string; okres: string; termin: string; road_ids: number[]; recommended?: boolean }[] = res?.items || [];
        const mapped = items
          .filter((d) => d.road_ids.some((id) => ids.has(id)))
          .sort((a, b) => Number(!!b.recommended) - Number(!!a.recommended))
          .map((d) => ({
            roadId: d.road_ids.find((id) => ids.has(id))!,
            label: d.nazev,
            story: `${d.recommended ? "doporučená · " : ""}${d.okres} · ${d.termin} · skutečný plán 2022`,
          }));
        if (mapped.length) setDemos(mapped.slice(0, 8));
      })
      .catch(() => undefined);
  }, [data.roads]);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [listLimit, setListLimit] = useState(LIST_STEP);
  const weightsChanged = WEIGHT_LABELS.some((w) => weights[w.key] !== regionWeights[w.key]);

  const roadsById = useMemo(() => new Map(data.roads.map((r) => [r.id, r])), [data.roads]);

  // Žebříček: debounce 300 ms pro plynulý posuvník přes tunel a AbortController (D7).
  useEffect(() => {
    let timer: number | null = null;
    const controller = new AbortController();
    setRankingLoading(true);

    timer = window.setTimeout(() => {
      fetchRanking(data.roads, weights, pins, controller.signal, aiOn && !weightsChanged)
        .then((res) => {
          setRows(res.rows);
          setSource(res.source);
          setAiState({ mode: res.ai, note: res.aiNote });
          setRankingLoading(false);
          // Pokud API vrátilo serverové piny, sesynchronizujeme stav
          if (res.source === "api" && res.apiPins) {
            const server = res.apiPins;
            setPins((cur) => (JSON.stringify(cur) === JSON.stringify(server) ? cur : server));
          }
        })
        .catch((err) => {
          if (err?.name !== "AbortError") {
            setRankingLoading(false);
          }
        });
    }, 300);

    return () => {
      if (timer) clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.roads, weights, pins, aiOn]);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const official = user?.role === "official" || user?.role === "admin";
  // Uzavírka čekající na potvrzení a oznámení pro veřejnost po potvrzení (kap. 25.2).
  const [ask, setAsk] = useState<{ repair: Repair; citizens: number | null } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [announce, setAnnounce] = useState<{ title: string; text: string; label: string } | null>(null);
  const publish = (repair: Repair) =>
    onRepairs([repair, ...repairs.filter((r) => r.id !== repair.id && r.roadId !== repair.roadId)]);
  const confirmAsked = async () => {
    if (!ask) return;
    const { repair } = ask;
    setConfirming(true);
    publish(repair);
    try {
      const title = repair.title || `Uzavírka ${repair.sil}`;
      const done = await api.confirmClosure({
        road_id: repair.roadId,
        title,
        date_from: repair.from,
        date_to: repair.to,
        restriction: repair.restriction,
        note: repair.note,
        simulated: false,
      });
      toast(`Uzavírka potvrzena, upozorněno občanů: ${done.notified}`);
      setAsk(null);
      // Návrh oznámení pro web a sociální sítě. AI jen navrhuje, úředník text zkontroluje.
      api
        .aiAnnouncement(done.closure.id)
        .then((res) => setAnnounce({ title, text: res.text, label: res.source === "ai" ? "návrh AI, zkontrolujte" : "šablona" }))
        .catch(() => undefined);
    } catch (e) {
      toast("Uzavírku se nepodařilo potvrdit na serveru, je jen v tomto prohlížeči", "warn");
      console.warn(e);
      setAsk(null);
    } finally {
      setConfirming(false);
    }
  };

  // „Co se pohnulo“ (kap. 25.2): top 20 při vahách kraje si pamatujeme a porovnáváme s top 20 po změně.
  const [baseTop, setBaseTop] = useState<number[] | null>(null);
  const top20 = useMemo(() => rows.slice(0, 20).map((r) => r.id), [rows]);
  useEffect(() => {
    if (!rankingLoading && !weightsChanged && top20.length) setBaseTop(top20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top20, rankingLoading]);
  const moved = useMemo(() => {
    if (!baseTop || rankingLoading) return null;
    const before = new Set(baseTop);
    const after = new Set(top20);
    return { in: top20.filter((id) => !before.has(id)), out: baseTop.filter((id) => !after.has(id)) };
  }, [baseTop, top20, rankingLoading]);

  const updatePin = async (roadId: number, pin: Pin | null) => {
    // 1. Optimistická lokální aktualizace
    const next = [...pins.filter((p) => p.road_id !== roadId), ...(pin ? [pin] : [])];
    setPins(next);
    savePins(next);

    // 2. Odeslání na server přes API (D3)
    const official = user?.role === "official" || user?.role === "admin";
    if (!official) {
      toast(pin ? "Priorita připíchnuta jen v tomto prohlížeči (nejste přihlášen jako správce)" : "Připíchnutí zrušeno");
      return;
    }
    {
      try {
        if (pin) {
          await api.setPin({ road_id: pin.road_id, priority: pin.priority, reason: pin.reason });
        } else {
          await api.deletePin(roadId);
        }
        // Po změně pinu na serveru znovunačteme ranking
        const res = await fetchRanking(data.roads, weights, next);
        setRows(res.rows);
        setSource(res.source);
        if (res.apiPins) setPins(res.apiPins);
      } catch (e) {
        console.warn("Chyba při ukládání pinu na server:", e);
        toast("Server pin nepřijal, platí jen v tomto prohlížeči", "warn");
        return;
      }
    }
    toast(pin ? "Priorita připíchnuta" : "Připíchnutí zrušeno");
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
      if (onlyBad && r.stav !== "havarijní" && r.stav !== "SUPERhavarijní") return false;
      if (q && !`${r.sil} ${r.usek} ${r.okres}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.roads, okres, stav, query, onlyBad]);

  const ranked = useMemo(() => {
    const visible = new Set(filtered.map((r) => r.id));
    const list = rows
      .filter((row) => visible.has(row.id) && (cls === "vše" || row.priority === cls))
      .map((row) => ({ r: roadsById.get(row.id)!, row }));
    const stavIdx = (s: string) => STAV_ORDER.indexOf(s as (typeof STAV_ORDER)[number]);
    if (sortBy === "score") list.sort((a, b) => b.row.score - a.row.score);
    else if (sortBy === "length") list.sort((a, b) => b.r.delka - a.r.delka);
    else if (sortBy === "stav") list.sort((a, b) => stavIdx(a.r.stav) - stavIdx(b.r.stav) || a.row.rank - b.row.rank);
    return list;
  }, [rows, filtered, cls, roadsById, sortBy]);

  // Vybraný úsek (i kliknutím v mapě) se v žebříčku posune do zorného pole.
  useEffect(() => {
    if (selectedId == null) return;
    const idx = ranked.findIndex((x) => x.r.id === selectedId);
    if (idx >= listLimit) setListLimit(Math.ceil((idx + 1) / 50) * 50);
    requestAnimationFrame(() =>
      listRef.current?.querySelector(`[data-road="${selectedId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Klávesy: / hledat, ↑ ↓ další úsek v žebříčku, Esc zavřít detail a parametry.
  useEffect(() => {
    if (view !== "map") return;
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]");
      if (e.key === "Escape") {
        if (paramsOpen) setParamsOpen(false);
        else if (selectedId != null) setSelectedId(null);
        (e.target as HTMLElement)?.blur?.();
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "j" || e.key === "k") {
        if (!ranked.length) return;
        e.preventDefault();
        const idx = ranked.findIndex((x) => x.r.id === selectedId);
        const down = e.key === "ArrowDown" || e.key === "j";
        const nextIdx = idx < 0 ? 0 : Math.min(ranked.length - 1, Math.max(0, idx + (down ? 1 : -1)));
        setSelectedId(ranked[nextIdx].r.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, ranked, selectedId, paramsOpen]);

  const classKm = useMemo(() => {
    const out: Record<string, number> = {};
    rows.forEach((row) => (out[row.priority] = (out[row.priority] || 0) + (roadsById.get(row.id)?.delka || 0)));
    return out;
  }, [rows, roadsById]);

  const closureList = useMemo(
    () =>
      repairs
        .filter((r) => (!closTo || r.from <= closTo) && (!closFrom || r.to >= closFrom))
        .sort((a, b) => a.from.localeCompare(b.from)),
    [repairs, closFrom, closTo],
  );

  const selected = data.roads.find((r) => r.id === selectedId) || null;
  const existing = repairs.find((r) => r.roadId === selectedId);

  const kmBad = data.roads
    .filter((r) => r.stav === "havarijní" || r.stav === "SUPERhavarijní")
    .reduce((s, r) => s + r.delka, 0);

  return (
    <div className="app-shell aud-office">
      <header className="topbar">
        <div className="tb-left">
          <button className="brand" onClick={onHome}>
            Cesty KHK
          </button>
          {onRole ? (
            <div className="role-switch" role="group" aria-label="Pohled (ukázka bez přihlášení)" title="Ukázka bez přihlášení: přepnutí role">
              <button className={role === "official" ? "on" : ""} onClick={() => onRole("official")}>
                Správce
              </button>
              <button className={role === "admin" ? "on" : ""} onClick={() => onRole("admin")}>
                Admin
              </button>
            </div>
          ) : (
            <span className="mode-tag">{role === "admin" ? "Admin" : "Správce"}</span>
          )}
        </div>
        <div className="tb-center">
          <nav className="top-nav">
            {VIEWS.filter((v) => !v.adminOnly || role === "admin").map((v) => (
              <button key={v.key} className={view === v.key ? "active" : ""} onClick={() => goView(v.key)}>
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
          <span
            className={`mode-tag ${source === "api" ? "live" : "local"}`}
            title={source === "api" ? "Data žebříčku a priority počítá backend" : "Offline režim: výpočet probíhá v prohlížeči"}
            style={{ fontSize: "12px", opacity: 0.9 }}
          >
            {rankingLoading ? "načítám…" : source === "api" ? "živá data" : "offline režim"}
          </span>
          <ThemeToggle />
          {user ? <UserMenu user={user} onLogout={onLogout} /> : <span className="sim-tag" title="Ukázka bez přihlášení: změny se ukládají jen v tomto prohlížeči">demo</span>}
        </div>
      </header>
      {view === "budget" && (
        <BudgetPlanner key="budget" data={data} weights={weights} online={user?.role === "official" || user?.role === "admin"} />
      )}
      {view === "system" && (
        <AdminSystem
          key="system"
          weights={regionWeights}
          onSaveWeights={saveRegion}
          pins={pins}
          live={live}
          onDirty={setSystemDirty}
          onOpenMap={() => goView("map")}
          map={
            <MapView
              roads={data.roads}
              repairs={repairs}
              selectedId={null}
              onSelect={(id) => {
                if (id == null) return;
                setSelectedId(id);
                goView("map");
              }}
              theme={mapTheme}
              showCondition
              showRepairs={false}
              showSrti={false}
            />
          }
        />
      )}
      {view === "map" && (
      <div className={`workspace no-right view-enter ${panels.className}`} data-sheet={sheet} style={panels.style}>
        <Resizer side="left" sizes={panels.sizes} onChange={panels.update} />
        <aside className="side left" ref={sideRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 400)}>
          <SheetClose onClose={() => setSheet("map")} />
          <div className="side-sticky">
          <SearchBox
            inputRef={searchRef}
            placeholder="Hledat obec, silnici nebo úsek   /"
            value={query}
            onValue={setQuery}
            onRoad={(id) => {
              setQuery("");
              setSelectedId(id);
            }}
            onPlace={(lon, lat) => {
              setQuery("");
              setFocus({ lon, lat, t: Date.now() });
            }}
          />
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
          <div className="seg ai-mode" role="group" aria-label="Jak se počítá pořadí">
            <button className={!aiOn ? "on" : ""} onClick={() => setAiOn(false)}>
              Jen parametry
            </button>
            <button
              className={aiOn ? "on" : ""}
              disabled={source !== "api" || weightsChanged}
              title={
                source !== "api"
                  ? "AI teď není dostupná (server neběží)"
                  : weightsChanged
                    ? "Návrh AI je jen u vah kraje. Vraťte váhy kraje."
                    : "Pořadí podle parametrů, AI může úsek posunout nejvýš o 5 míst"
              }
              onClick={() => setAiOn(true)}
            >
              Parametry + AI
            </button>
          </div>
          {aiOn && aiState.note && (
            <p className={`fine ai-note ${aiState.mode === "nedostupne" ? "warn" : ""}`}>
              {aiState.mode === "nedostupne" ? "AI teď není dostupná. " : ""}
              {aiState.note}
            </p>
          )}
          </div>
          <div className="rank-tools">
            <label className="check">
              <input type="checkbox" checked={onlyBad} onChange={(e) => setOnlyBad(e.target.checked)} />
              Jen havarijní
            </label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="Řadit podle">
              <option value="rank">Řadit: priorita</option>
              <option value="score">Řadit: skóre</option>
              <option value="stav">Řadit: nejhorší stav</option>
              <option value="length">Řadit: délka</option>
            </select>
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
            <ul className="rank" ref={listRef}>
              {ranked.slice(0, listLimit).map(({ r, row }) => (
                <li key={r.id}>
                  <button
                    data-road={r.id}
                    className={r.id === selectedId ? "active" : ""}
                    onClick={() => setSelectedId(r.id)}
                    onMouseEnter={() => setHoverId(r.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onFocus={() => setHoverId(r.id)}
                    onBlur={() => setHoverId(null)}
                  >
                    <span className="rank-sil">
                      <i style={{ background: STAV_COLOR[r.stav] }} />
                      {formatSil(r.sil, r.trida)}
                      <span className="class-tag" style={{ "--cls": CLASS_COLOR[row.priority] } as CSSProperties}>
                        {CLASS_LABEL[row.priority]}
                      </span>
                      {row.pinned && (
                        <span className="pin-tag" title={row.pinReason || "připíchnuto správcem"}>
                          📌
                        </span>
                      )}
                    </span>
                    <span className="rank-meta">
                      #{row.rank} · {r.okres} · {formatKm(r.delka)}
                    </span>
                    {row.aiShift ? (
                      <span className="rank-why ai" title={row.aiReason || undefined}>
                        <span className="ai-tag">
                          návrh AI {row.aiShift > 0 ? `↑${row.aiShift}` : `↓${-row.aiShift}`}
                        </span>{" "}
                        {row.aiReason || mainReason(r, weights)}
                      </span>
                    ) : (
                      <span className="rank-why">{mainReason(r, weights)}</span>
                    )}
                    <b>{row.score}</b>
                  </button>
                </li>
              ))}
              {!rows.length &&
                rankingLoading &&
                Array.from({ length: 6 }, (_, i) => (
                  <li key={`sk-${i}`} className="rank-skeleton" aria-hidden="true">
                    <span />
                    <span />
                  </li>
                ))}
              {!ranked.length && !(rankingLoading && !rows.length) && (
                <li className="rank-empty">
                  <b>Filtrům neodpovídá žádný úsek.</b>
                  <button
                    className="link"
                    onClick={() => {
                      setQuery("");
                      setOkres("vše");
                      setStav("vše");
                      setCls("vše");
                      setOnlyBad(false);
                    }}
                  >
                    Zrušit filtry
                  </button>
                </li>
              )}
            </ul>
            <p className="kbd-hint">
              <kbd>↑</kbd> <kbd>↓</kbd> další úsek · <kbd>/</kbd> hledat · <kbd>Esc</kbd> zavřít
            </p>
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
          {scrolled && (
            <button className="to-top" onClick={() => sideRef.current?.scrollTo({ top: 0, behavior: "smooth" })}>
              ↑ Nahoru
            </button>
          )}
          <Fold title="Uzavírky a opravy" meta={closureList.length}>
            <div className="form-grid">
              <label>
                Od
                <input type="date" value={closFrom} onChange={(e) => setClosFrom(e.target.value)} />
              </label>
              <label>
                Do
                <input type="date" value={closTo} onChange={(e) => setClosTo(e.target.value)} />
              </label>
            </div>
            <ul className="rank closure-list">
              {closureList.slice(0, 40).map((rep) => (
                <li key={rep.id}>
                  <button className={rep.roadId === selectedId ? "active" : ""} onClick={() => setSelectedId(rep.roadId)}>
                    <span className="rank-sil">
                      {rep.title || rep.sil}
                      {rep.simulated && <span className="sim-tag">simulace</span>}
                    </span>
                    <span className="rank-meta">
                      {STATUS_LABEL[rep.status]} · {formatPeriod(rep)} · {rep.restriction}
                    </span>
                  </button>
                </li>
              ))}
              {!closureList.length && <li className="rank-empty">V tomto období není žádná uzavírka ani oprava.</li>}
            </ul>
            {(closFrom || closTo) && (
              <button
                className="link"
                onClick={() => {
                  setClosFrom("");
                  setClosTo("");
                }}
              >
                Zrušit filtr termínu
              </button>
            )}
          </Fold>
          <Fold title="Ukázkové uzavírky" meta={demos.length}>
            <p className="muted">Vyberte ukázku nebo úsek v mapě. Vpravo v záložce Uzavírka uvidíte objížďku a dopady.</p>
            <div className="demo-closures">
              {demos.map((d) => (
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
          {official && (
            <Fold title="Povodňový scénář" meta={floodIds.length ? `${floodIds.length} úseků` : undefined}>
              <FloodPanel onRoads={setFloodIds} />
            </Fold>
          )}
          <Fold title="Vrstvy mapy">
            <label className="check">
              <input type="checkbox" checked={showCondition} onChange={(e) => setShowCondition(e.target.checked)} />
              Stav povrchu
            </label>
            <label className="check">
              <input type="checkbox" checked={showPois} onChange={(e) => setShowPois(e.target.checked)} />
              Školy, IZS, nemocnice
            </label>
            <label className="check">
              <input type="checkbox" checked={layers.repairs} onChange={(e) => setLayers({ ...layers, repairs: e.target.checked })} />
              Opravy a uzavírky kraje
            </label>
            <label className="check">
              <input type="checkbox" checked={layers.srti} onChange={(e) => setLayers({ ...layers, srti: e.target.checked })} />
              Uzavírky ŘSD (SRTI)
            </label>
          </Fold>
        </aside>
        <div className="map-wrap">
          <MapView
            focus={focus}
            hoverId={hoverId}
            roads={filtered}
            repairs={repairs}
            selectedId={selectedId}
            onSelect={setSelectedId}
            theme={mapTheme}
            showCondition={showCondition}
            pois={data.pois}
            stops={data.stops}
            showPois={showPois}
            showRepairs={layers.repairs}
            showSrti={layers.srti}
            detour={detour}
            highlight={floodIds}
          />
          <div className={`params ${paramsOpen ? "open" : ""}`}>
            <button
              className="params-toggle"
              onClick={() => {
                if (!paramsOpen) setSelectedIdState(null);
                setParamsOpen(!paramsOpen);
              }}
              aria-expanded={paramsOpen}
            >
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
                <div className="seg weight-mode" role="group" aria-label="Režim vah">
                  <button className={weightMode === "simple" ? "on" : ""} onClick={() => setWeightMode("simple")}>
                    Jednoduché
                  </button>
                  <button className={weightMode === "detail" ? "on" : ""} onClick={() => setWeightMode("detail")}>
                    Podrobné
                  </button>
                </div>
                {weightMode === "simple" ? (
                  <div className="presets">
                    {presets.map((p) => (
                      <button
                        key={p.key}
                        className={preset === p.key ? "on" : ""}
                        onClick={() => {
                          setPreset(p.key);
                          setWeights({ ...regionWeights, ...p.weights });
                        }}
                      >
                        <strong>{p.label}</strong>
                        <span>{p.hint}</span>
                      </button>
                    ))}
                    <p className="fine">
                      {presetsFromServer ? "Předvolby ze serveru." : "Předvolby jsou návrh aplikace, ne nastavení kraje."} Přesné hodnoty jsou v
                      režimu Podrobné.
                    </p>
                  </div>
                ) : (
                  <>
                    <WeightSliders
                      weights={weights}
                      serverOnline={source === "api"}
                      onChange={(next) => {
                        setPreset(null);
                        setWeights(next);
                      }}
                    />
                    <button className="link" onClick={() => setWeights(DEFAULT_WEIGHTS)}>
                      Výchozí hodnoty aplikace
                    </button>
                  </>
                )}
                {weightsChanged && moved && (
                  <div className="moved">
                    <b>Co se pohnulo v top 20</b>
                    {moved.in.length || moved.out.length ? (
                      <>
                        <span>
                          {moved.in.length} nových, {moved.out.length} vypadlo oproti vahám kraje
                        </span>
                        <ul>
                          {moved.in.slice(0, 4).map((id) => (
                            <li key={`in-${id}`} className="up">
                              <button className="link" onClick={() => setSelectedId(id)}>
                                ↑ {roadsById.get(id) ? formatSil(roadsById.get(id)!.sil, roadsById.get(id)!.trida) : id}
                              </button>
                            </li>
                          ))}
                          {moved.out.slice(0, 4).map((id) => (
                            <li key={`out-${id}`} className="down">
                              <button className="link" onClick={() => setSelectedId(id)}>
                                ↓ {roadsById.get(id) ? formatSil(roadsById.get(id)!.sil, roadsById.get(id)!.trida) : id}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <span>Prvních 20 úseků zůstalo stejných.</span>
                    )}
                  </div>
                )}
                <div className="row-actions">
                  <button
                    className="btn"
                    disabled={!weightsChanged}
                    onClick={() => {
                      setPreset(null);
                      setWeights(regionWeights);
                    }}
                  >
                    Zpět na výchozí kraje
                  </button>
                  {role === "admin" && (
                    <button
                      className="btn primary"
                      disabled={!weightsChanged}
                      onClick={async () => {
                        await saveRegion(weights);
                        setSavedNote(true);
                        setTimeout(() => setSavedNote(false), 2000);
                      }}
                    >
                      {savedNote ? "Uloženo" : "Uložit pro celý kraj"}
                    </button>
                  )}
                </div>
                {role === "admin" && !live && <p className="fine">Demo: ukládá se jen v tomto prohlížeči.</p>}
              </div>
            )}
          </div>
          <SheetBar value={sheet} onChange={setSheet} left="Žebříček" />
          <div className="legend map-filter" role="group" aria-label="Co ukázat na mapě">
            <span className="map-filter-base">
              {STAV_ORDER.map((s) => (
                <span key={s} title={STAV_HINT[s]}>
                  <i style={{ background: STAV_COLOR[s] }} /> {stavLabel(s)}
                </span>
              ))}
            </span>
            <button className={`filter-toggle ${layers.repairs ? "on" : ""}`} aria-pressed={layers.repairs} onClick={() => setLayers({ ...layers, repairs: !layers.repairs })}>
              <i className="active" /> Opravy a uzavírky kraje
            </button>
            <button className={`filter-toggle ${layers.srti ? "on" : ""}`} aria-pressed={layers.srti} onClick={() => setLayers({ ...layers, srti: !layers.srti })}>
              <i className="srti" /> Uzavírky ŘSD
            </button>
            {!!detour?.length && (
              <span className="map-filter-sub">
                <i className="detour-sw" /> objížďka
              </span>
            )}
            {layers.repairs && (
              <span className="map-filter-sub">
                <i className="active" /> probíhá <i className="planned" /> plán <i className="done" /> hotovo
              </span>
            )}
          </div>
          {ask && (
            <Dialog title="Potvrdit uzavírku?" onClose={() => !confirming && setAsk(null)}>
              <p>
                <b>{ask.repair.title || `Uzavírka ${ask.repair.sil}`}</b>
                <br />
                {ask.repair.restriction} · {ask.repair.from} až {ask.repair.to}
              </p>
              <p>
                {ask.citizens == null
                  ? "Počet občanů s trasou přes úsek se nepodařilo zjistit."
                  : ask.citizens === 0
                    ? "Nikdo z přihlášených občanů tudy podle uložené trasy nejezdí."
                    : `Upozornění dostane ${ask.citizens.toLocaleString("cs-CZ")} ${ask.citizens === 1 ? "občan" : ask.citizens < 5 ? "občané" : "občanů"} s trasou přes tento úsek.`}
              </p>
              <div className="row-actions">
                <button className="btn primary" disabled={confirming} onClick={confirmAsked}>
                  {confirming
                    ? "Potvrzuji…"
                    : ask.citizens
                      ? `Potvrdit a upozornit ${ask.citizens.toLocaleString("cs-CZ")}`
                      : "Potvrdit uzavírku"}
                </button>
                <button className="btn" disabled={confirming} onClick={() => setAsk(null)}>
                  Zpět
                </button>
              </div>
            </Dialog>
          )}
          {announce && (
            <Dialog title="Oznámení pro veřejnost" onClose={() => setAnnounce(null)}>
              <p className="muted">
                {announce.title} · <span className="sim-tag">{announce.label}</span>
              </p>
              <textarea
                className="announce-text"
                rows={8}
                value={announce.text}
                onChange={(e) => setAnnounce({ ...announce, text: e.target.value })}
              />
              <div className="row-actions">
                <button
                  className="btn primary"
                  onClick={() =>
                    navigator.clipboard?.writeText(announce.text).then(() => {
                      toast("Oznámení zkopírováno");
                      setAnnounce(null);
                    })
                  }
                >
                  Kopírovat a zavřít
                </button>
                <button className="btn" onClick={() => setAnnounce(null)}>
                  Zavřít
                </button>
              </div>
            </Dialog>
          )}
          {selected ? (
            <DetailSheet
              id={`${selected.id}-${demoId === selected.id}`}
              onClose={() => setSelectedId(null)}
              shareUrl={urlRoads ? `${window.location.origin}/sprava/usek/${selected.id}` : undefined}
            >
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
                onPin={(pin) => updatePin(selected.id, pin)}
                roadsById={roadsById}
                onDetour={setDetour}
                aiEnabled={user?.role === "official" || user?.role === "admin"}
                onPlan={async (repair) => {
                  // Přihlášený úředník: před potvrzením řekneme, kolik občanů dostane upozornění (kap. 25.2).
                  const closing = repair.restriction.includes("uzavírka");
                  if (closing && official) {
                    let citizens: number | null = null;
                    try {
                      const preview = await api.closurePreview({
                        road_id: repair.roadId,
                        date_from: repair.from,
                        date_to: repair.to,
                        restriction: repair.restriction,
                        note: repair.note,
                      });
                      citizens = preview.citizens_on_route;
                    } catch {
                      citizens = null;
                    }
                    setAsk({ repair, citizens });
                    return;
                  }
                  publish(repair);
                  toast(closing ? "Uzavírka je v mapě jen v tomto prohlížeči (nepřihlášen)" : "Oprava zveřejněna v mapě");
                }}
              />
            </DetailSheet>
          ) : (
            <div className="map-hint">Klikněte na silnici v mapě nebo v žebříčku, detail se ukáže tady dole.</div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
