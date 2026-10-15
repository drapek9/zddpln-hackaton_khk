import { useMemo, useState } from "react";
import MapView, { HIGHLIGHT_COLOR } from "./MapView";
import { useTheme } from "../lib/theme";
import Fold from "./Fold";
import SheetBar, { isNarrow, type Sheet } from "./SheetBar";
import Resizer, { usePanelSizes } from "./Resizer";
import type { Dataset, Weights } from "../lib/types";
import { STAV_COLOR, formatSil, stavLabel } from "../lib/geo";
import { BAD_STAVY, DEFAULT_PRICES, FOCUS_LABEL, STRATEGY_LABEL, buildStavby, formatMil, planBudget, type Focus, type Strategy } from "../lib/budget";

type Props = {
  data: Dataset;
  weights: Weights;
};

const PRESETS = [50, 100, 250, 500, 1000];

// Rozpočtový asistent: úředník zadá částku, dostane souvislé stavby, které se vejdou.
export default function BudgetPlanner({ data, weights }: Props) {
  const { theme } = useTheme();
  const mapTheme = theme === "dark" ? "dark" : "office";
  const [budget, setBudget] = useState(250);
  const [okres, setOkres] = useState("vše");
  const [focus, setFocus] = useState<Focus[]>(["stav"]);
  const [strategy, setStrategy] = useState<Strategy>("worst");
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>("map");
  const panels = usePanelSizes();

  const okresy = useMemo(() => ["vše", ...Array.from(new Set(data.roads.map((r) => r.okres))).sort()], [data.roads]);
  const stavby = useMemo(() => buildStavby(data.roads, weights, focus, prices, okres), [data.roads, weights, focus, prices, okres]);
  const plan = useMemo(() => planBudget(stavby, budget, data.roads, strategy), [stavby, budget, data.roads, strategy]);

  const highlight = useMemo(() => plan.chosen.flatMap((s) => s.roadIds), [plan]);
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

        <div className="ai-note">
          <span className="ai-tag">návrh AI · připravujeme</span>
          <p>
            Tady bude 3–5 vět, proč právě tyto stavby. AI dostane jen čísla z výpočtu, rozhoduje úředník.
          </p>
        </div>

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
          <button className="btn primary" disabled title="Uložení plánu přijde s backendem (POST /api/budget)">
            Uložit jako návrh plánu
          </button>
          <button className="btn" disabled title="Export připravujeme">
            Export CSV
          </button>
        </div>
      </aside>
    </div>
  );
}
