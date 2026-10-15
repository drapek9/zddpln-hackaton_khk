import { useEffect, useMemo, useState } from "react";
import MapView, { HIGHLIGHT_COLOR } from "./MapView";
import { useTheme } from "../lib/theme";
import Fold from "./Fold";
import SheetBar, { SheetClose, isNarrow, type Sheet } from "./SheetBar";
import Resizer, { usePanelSizes } from "./Resizer";
import type { Dataset, Weights } from "../lib/types";
import { STAV_COLOR, formatSil, stavLabel } from "../lib/geo";
import AiSuggest from "./AiSuggest";
import { api, ApiUnavailable, type ServerPlan } from "../lib/api";
import { BAD_STAVY, DEFAULT_PRICES, FOCUS_LABEL, STRATEGY_LABEL, buildStavby, formatMil, planBudget, type Focus, type Strategy } from "../lib/budget";

type Props = {
  data: Dataset;
  weights: Weights;
  /** Přihlášený úředník nebo admin: /api/budget a /api/ai/budget vyžadují účet. */
  online: boolean;
};

type ServerState =
  | { status: "off" }
  | { status: "loading" }
  | { status: "ok"; plan: ServerPlan; source?: string }
  | { status: "waiting"; note: string }
  | { status: "down" };

const PRESETS = [50, 100, 250, 500, 1000];

// Rozpočtový asistent: úředník zadá částku, dostane souvislé stavby, které se vejdou.
export default function BudgetPlanner({ data, weights, online }: Props) {
  const { theme } = useTheme();
  const mapTheme = theme === "dark" ? "dark" : "office";
  const [budget, setBudget] = useState(250);
  const [okres, setOkres] = useState("vše");
  const [focus, setFocus] = useState<Focus[]>(["stav"]);
  const [strategy, setStrategy] = useState<Strategy>("worst");
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>("map");
  // Výpočet jádra na serveru (F8). Bere jen částku a váhy účtu, okres a ceny z panelu nezná.
  const [server, setServer] = useState<ServerState>({ status: online ? "loading" : "off" });
  const [showServer, setShowServer] = useState(false);
  // Porovnání dvou částek (kap. 25.2): stejné stavby a ceny, jen jiný rozpočet.
  const [compareTo, setCompareTo] = useState<number | null>(null);
  useEffect(() => {
    if (!online) return;
    const ctrl = new AbortController();
    setServer({ status: "loading" });
    const t = setTimeout(() => {
      api
        .budget(budget * 1_000_000, ctrl.signal)
        .then((res) => {
          if (ctrl.signal.aborted) return;
          const plan = res.ready ? res.plans[0] : undefined;
          setServer(plan ? { status: "ok", plan, source: res.weights_source } : { status: "waiting", note: res.note });
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return;
          if (!(err instanceof ApiUnavailable)) console.warn(err);
          setServer({ status: "down" });
        });
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [budget, online]);
  const serverPlan = server.status === "ok" ? server.plan : null;
  const weightsSrc = server.status === "ok" ? server.source : undefined;
  const panels = usePanelSizes();

  const okresy = useMemo(() => ["vše", ...Array.from(new Set(data.roads.map((r) => r.okres))).sort()], [data.roads]);
  const stavby = useMemo(() => buildStavby(data.roads, weights, focus, prices, okres), [data.roads, weights, focus, prices, okres]);
  const plan = useMemo(() => planBudget(stavby, budget, data.roads, strategy), [stavby, budget, data.roads, strategy]);
  const planB = useMemo(
    () => (compareTo != null ? planBudget(stavby, compareTo, data.roads, strategy) : null),
    [stavby, compareTo, data.roads, strategy],
  );

  // Export vybraných staveb do CSV pro Excel (středník, BOM kvůli češtině). Ceny jsou předpoklad.
  const exportCsv = () => {
    const head = ["poradi", "silnice", "okres", "delka_km", "cena_mil_kc_predpoklad", "skore", "nejhorsi_stav", "useky_id"];
    const rows = plan.chosen.map((s, i) => [
      i + 1,
      formatSil(s.sil, s.trida),
      s.okres,
      s.km.toFixed(2).replace(".", ","),
      s.cost.toFixed(1).replace(".", ","),
      s.score,
      stavLabel(s.worst),
      s.roadIds.join(" "),
    ]);
    const esc = (v: string | number) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const csv = "﻿" + [head, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `plan-oprav-${budget}-mil-${okres === "vše" ? "kraj" : okres}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const highlight = useMemo(
    () => (showServer && serverPlan ? serverPlan.projects.flatMap((p) => p.road_ids) : plan.chosen.flatMap((s) => s.roadIds)),
    [plan, showServer, serverPlan],
  );
  const active = plan.chosen.find((s) => s.key === selected) || null;
  const roadsById = useMemo(() => new Map(data.roads.map((r) => [r.id, r])), [data.roads]);
  const usedPct = Math.min(100, (plan.spent / Math.max(budget, 1)) * 100);
  const badFixedPct = plan.kmBadTotal ? ((plan.kmBadTotal - plan.kmBadLeft) / plan.kmBadTotal) * 100 : 0;

  const toggleFocus = (f: Focus) => setFocus(focus.includes(f) ? focus.filter((x) => x !== f) : [...focus, f]);

  return (
    <div className={`workspace budget view-enter ${panels.className}`} data-sheet={sheet} style={panels.style}>
      <Resizer side="left" sizes={panels.sizes} onChange={panels.update} />
      <Resizer side="right" sizes={panels.sizes} onChange={panels.update} />
      <aside className="side left">
        <SheetClose onClose={() => setSheet("map")} />
        <div className="budget-input">
          <span className="panel-kicker">Kolik můžeme utratit</span>
          <div className="budget-value">{formatMil(budget)}</div>
          <input
            type="range"
            min={10}
            max={2000}
            step={10}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            aria-label="Rozpočet v milionech Kč"
          />
          <div className="chips">
            {PRESETS.map((p) => (
              <button key={p} className={`chip-btn ${budget === p ? "on" : ""}`} onClick={() => setBudget(p)}>
                {formatMil(p)}
              </button>
            ))}
          </div>
        </div>

        <h3>Strategie</h3>
        <div className="segmented">
          {(Object.keys(STRATEGY_LABEL) as Strategy[]).map((s) => (
            <button key={s} className={strategy === s ? "on" : ""} onClick={() => setStrategy(s)}>
              {STRATEGY_LABEL[s]}
            </button>
          ))}
        </div>
        <p className="fine">
          {strategy === "worst"
            ? "Nejdřív stavby s nejvyšším skóre, i když jsou drahé."
            : "Nejvíc skóre za korunu. Upřednostní levné opravy opotřebovaného povrchu, než se zhorší."}
        </p>

        <h3>Okres</h3>
        <div className="filters">
          <select value={okres} onChange={(e) => setOkres(e.target.value)}>
            {okresy.map((o) => (
              <option key={o} value={o}>
                {o === "vše" ? "celý kraj" : o}
              </option>
            ))}
          </select>
        </div>

        <h3>Co má přednost</h3>
        <div className="chips">
          {(Object.keys(FOCUS_LABEL) as Focus[]).map((f) => (
            <button key={f} className={`chip-btn ${focus.includes(f) ? "on" : ""}`} onClick={() => toggleFocus(f)}>
              {FOCUS_LABEL[f]}
            </button>
          ))}
        </div>

        <Fold title="Cena opravy za km" meta={<span className="est-tag">předpoklad</span>}>
          {BAD_STAVY.map((s) => (
            <label key={s} className="weight">
              <span>
                <span>
                  <i className="dot" style={{ background: STAV_COLOR[s] }} /> {stavLabel(s)}
                </span>
                <b>{prices[s].toLocaleString("cs-CZ")} mil./km</b>
              </span>
              <input
                type="range"
                min={0.5}
                max={30}
                step={0.5}
                value={prices[s]}
                onChange={(e) => setPrices({ ...prices, [s]: Number(e.target.value) })}
              />
            </label>
          ))}
          <p className="fine">
            Výchozí ceny podle CDV a zakázky Libereckého kraje (III/28711). Ukazují pořadí a poměry, ne přesný
            rozpočet.
          </p>
          <button className="btn" onClick={() => setPrices(DEFAULT_PRICES)}>
            Vrátit výchozí ceny
          </button>
        </Fold>

        <Fold title="Jak se stavby skládají">
          <ul className="plain explain">
            <li>Navazující úseky stejné silnice ve stavu opotřebovaná, havarijní nebo rozpadlá vozovka.</li>
            <li>Celá stavba je v jednom okrese, délka nejvýš ~5 km.</li>
            <li>Výběr podle zvolené strategie, dokud se stavby vejdou. Stejný vstup dá vždy stejný výsledek.</li>
          </ul>
          <p className="fine">Náhled ve frontendu. Přesné sestavení staveb s objížďkou dodá jádro (Engine.budget).</p>
        </Fold>
      </aside>

      <div className="map-wrap">
        <MapView
          roads={data.roads}
          repairs={[]}
          selectedId={active ? active.roadIds[0] : null}
          onSelect={(id) => {
            const hit = plan.chosen.find((s) => id != null && s.roadIds.includes(id));
            setSelected(hit ? hit.key : null);
            if (hit && isNarrow()) setSheet("right");
          }}
          theme={mapTheme}
          showCondition={false}
          showRepairs={false}
          showSrti={false}
          highlight={highlight}
        />
        <SheetBar value={sheet} onChange={setSheet} left="Rozpočet" right="Stavby" />
        <div className="legend">
          <span>
            <i style={{ background: HIGHLIGHT_COLOR[mapTheme] }} /> vybrané stavby
          </span>
          <span className="muted">ostatní silnice ztlumené</span>
        </div>
      </div>

      <aside className="side right">
        <SheetClose onClose={() => setSheet("map")} />
        <div className="budget-kpis">
          <div>
            <span>Opravíme</span>
            <b>{plan.kmFixed.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km</b>
            <small>{plan.chosen.length} staveb</small>
          </div>
          <div>
            <span>Využito</span>
            <b>{formatMil(plan.spent)}</b>
            <small>z {formatMil(budget)}</small>
          </div>
        </div>
        <div className="meter" title="Využití rozpočtu">
          <div style={{ width: `${usedPct}%` }} />
        </div>
        <div className="bad-left">
          <span>Havarijních km zůstane</span>
          <b>
            {plan.kmBadLeft.toLocaleString("cs-CZ", { maximumFractionDigits: 0 })} z{" "}
            {plan.kmBadTotal.toLocaleString("cs-CZ", { maximumFractionDigits: 0 })} km
          </b>
          <div className="meter bad">
            <div style={{ width: `${badFixedPct}%` }} />
          </div>
          <small>opraví se {badFixedPct.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} % havarijních a rozpadlých km</small>
        </div>

        <Fold title="Porovnat s jinou částkou" meta={compareTo != null ? formatMil(compareTo) : undefined}>
          <div className="chips">
            {PRESETS.filter((p) => p !== budget).map((p) => (
              <button key={p} className={`chip-btn ${compareTo === p ? "on" : ""}`} onClick={() => setCompareTo(compareTo === p ? null : p)}>
                {formatMil(p)}
              </button>
            ))}
          </div>
          {planB && compareTo != null ? (
            <table className="compare">
              <thead>
                <tr>
                  <th />
                  <th>{formatMil(budget)}</th>
                  <th>{formatMil(compareTo)}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Opravíme</td>
                  <td>{plan.kmFixed.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km</td>
                  <td>{planB.kmFixed.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km</td>
                </tr>
                <tr>
                  <td>Staveb</td>
                  <td>{plan.chosen.length}</td>
                  <td>{planB.chosen.length}</td>
                </tr>
                <tr>
                  <td>Havarijních km zůstane</td>
                  <td>{plan.kmBadLeft.toLocaleString("cs-CZ", { maximumFractionDigits: 0 })}</td>
                  <td>{planB.kmBadLeft.toLocaleString("cs-CZ", { maximumFractionDigits: 0 })}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="fine">Vyberte druhou částku. Porovnání bere stejné stavby, okres a ceny.</p>
          )}
        </Fold>

        <Fold
          title="Výpočet serveru (jádro)"
          meta={
            <span className={`mode-tag ${serverPlan ? "live" : "local"}`}>
              {server.status === "ok" ? "živá data" : server.status === "loading" ? "načítám…" : "nedostupné"}
            </span>
          }
          open={online}
        >
          {server.status === "off" && <p className="fine">Výpočet serveru je pro přihlášeného správce. Vlevo je náhled v prohlížeči.</p>}
          {server.status === "down" && <p className="fine">Server teď neodpovídá. Platí náhled v prohlížeči.</p>}
          {server.status === "waiting" && <p className="fine">{server.note}</p>}
          {serverPlan && (
            <>
              <div className="budget-kpis server">
                <div>
                  <span>Opraví</span>
                  <b>{(serverPlan.repaired_km ?? 0).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km</b>
                  <small>{serverPlan.projects.length} staveb</small>
                </div>
                <div>
                  <span>Stojí</span>
                  <b>{formatMil((serverPlan.cost_kc ?? 0) / 1_000_000)}</b>
                  <small>předpoklad</small>
                </div>
              </div>
              {serverPlan.remaining_emergency_km != null && (
                <p className="fine">
                  Havarijních km zůstane {serverPlan.remaining_emergency_km.toLocaleString("cs-CZ", { maximumFractionDigits: 0 })}.
                  Váhy: {weightsSrc === "official" ? "moje" : weightsSrc === "admin" ? "krajské" : "výchozí"}. Jen částka, bez okresu a cen z
                  panelu.
                </p>
              )}
              <label className="check toggle-row">
                <input type="checkbox" checked={showServer} onChange={(e) => setShowServer(e.target.checked)} />
                Ukázat stavby serveru na mapě
              </label>
              <ol className="stavby server">
                {serverPlan.projects.slice(0, 12).map((p, i) => {
                  const road = roadsById.get(p.road_ids[0]);
                  return (
                    <li key={`${p.road_ids[0]}-${i}`}>
                      <span className="stavba-head">
                        <em>{i + 1}</em>
                        <strong>{road ? formatSil(road.sil, road.trida) : p.sil || "silnice"}</strong>
                        <span className="stavba-cost">{formatMil((p.cost_kc ?? 0) / 1_000_000)}</span>
                      </span>
                      <span className="rank-meta">
                        {p.okres || road?.okres} · {(p.km ?? 0).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km
                        {p.extra_km != null && ` · objížďka +${p.extra_km.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km`}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </Fold>

        <AiSuggest label="Zdůvodnit výběr" enabled={online} load={() => api.aiBudget(budget * 1_000_000)} />

        <Fold title="Vybrané stavby" meta={plan.chosen.length} open>
          <ol className="stavby">
            {plan.chosen.map((s, i) => (
              <li key={s.key}>
                <button className={s.key === selected ? "active" : ""} onClick={() => setSelected(s.key === selected ? null : s.key)}>
                  <span className="stavba-head">
                    <em>{i + 1}</em>
                    <strong>{formatSil(s.sil, s.trida)}</strong>
                    <span className="dot" style={{ background: STAV_COLOR[s.worst] }} title={stavLabel(s.worst)} />
                    <span className="stavba-cost">{formatMil(s.cost)}</span>
                  </span>
                  <span className="rank-meta">
                    {s.okres} · {s.km.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km · skóre {s.score}
                  </span>
                  {s.key === selected && (
                    <span className="stavba-detail">
                      <span>{s.roadIds.length} úseků · nejhorší: {stavLabel(s.worst)}</span>
                      {s.schools > 0 && <span>školy v okolí: {s.schools}</span>}
                      {s.rescue > 0 && <span>nemocnice, ZZS a HZS: {s.rescue}</span>}
                      {s.lines > 0 && <span>autobusové linky: {s.lines}</span>}
                      <span className="muted">
                        Obce: {Array.from(new Set(s.roadIds.flatMap((id) => roadsById.get(id)?.obce || []))).slice(0, 4).join(", ") || "—"}
                      </span>
                      <span className="muted">Objížďka celé stavby: připravujeme (jádro).</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
            {!plan.chosen.length && <li className="muted">Do rozpočtu se nevejde žádná stavba. Zvyšte částku.</li>}
          </ol>
        </Fold>
        <Fold title="Nevešlo se" meta={plan.skipped.length}>
          <p className="muted">Nejlepší stavby, na které už nezbylo:</p>
          <ul className="plain">
            {plan.skipped
              .slice()
              .sort((a, b) => b.score - a.score)
              .slice(0, 8)
              .map((s) => (
                <li key={s.key}>
                  {formatSil(s.sil, s.trida)} · {s.okres}
                  <em>
                    {s.km.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km · {formatMil(s.cost)} · skóre {s.score}
                  </em>
                </li>
              ))}
          </ul>
        </Fold>
        <div className="row-actions">
          <button className="btn primary" disabled={!plan.chosen.length} onClick={exportCsv} title="Vybrané stavby do tabulky (Excel)">
            Export CSV
          </button>
          <button className="btn" onClick={() => window.print()} title="Vytisknout nebo uložit jako PDF">
            Tisk
          </button>
        </div>
      </aside>
    </div>
  );
}
