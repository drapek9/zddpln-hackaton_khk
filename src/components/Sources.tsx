import { EXTERNAL_SOURCES, PLANNED_KHK_SOURCES, SOURCES, searchUrl, sourceUrl } from "../lib/sources";
import type { Dataset } from "../lib/types";
import { ThemeToggle } from "../lib/theme";
import Footer from "./Footer";
import type { View } from "../App";

type Props = {
  stats: Dataset["stats"];
  onHome: () => void;
  onNavigate: (view: View) => void;
};

export default function Sources({ stats, onHome, onNavigate }: Props) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="tb-left">
          <button className="brand" onClick={onHome}>
            Cesty KHK
          </button>
          <span className="mode-tag light">Zdroje dat</span>
        </div>
        <div className="tb-center" />
        <div className="tb-right">
          <ThemeToggle />
        </div>
      </header>
      <main className="sources">
        <h1>Zdroje dat</h1>
        <p>
          Aplikace stojí na otevřených datech Královéhradeckého kraje z katalogu{" "}
          <a href="https://www.datakhk.cz" target="_blank" rel="noreferrer">
            datakhk.cz
          </a>{" "}
          (registrovaného v{" "}
          <a href="https://data.gov.cz" target="_blank" rel="noreferrer">
            Národním katalogu otevřených dat
          </a>
          ). Stav povrchu je poslední měření každého úseku z let {stats.updated}: {stats.useky} úseků,{" "}
          {stats.km} km silnic II. a III. třídy.
        </p>
        <p className="hint">
          Plánované a probíhající opravy kraj jako otevřená data nezveřejňuje. Takové opravy jsou v aplikaci
          označené jako <b>simulace</b>.
        </p>
        <table>
          <thead>
            <tr>
              <th>Datová sada</th>
              <th>K čemu ji používáme</th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => (
              <tr key={s.itemId}>
                <td>
                  <a href={sourceUrl(s)} target="_blank" rel="noreferrer">
                    {s.name}
                  </a>
                </td>
                <td>{s.use}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Další sady Data KHK (připravujeme)</h2>
        <table>
          <thead>
            <tr>
              <th>Datová sada</th>
              <th>K čemu ji použijeme</th>
            </tr>
          </thead>
          <tbody>
            {PLANNED_KHK_SOURCES.map((s) => (
              <tr key={s.name}>
                <td>
                  <a href={searchUrl(s.query)} target="_blank" rel="noreferrer">
                    {s.name}
                  </a>
                </td>
                <td>{s.use}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Externí data a licence</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Licence</th>
              <th>K čemu</th>
              <th>Stav</th>
            </tr>
          </thead>
          <tbody>
            {EXTERNAL_SOURCES.map((s) => (
              <tr key={s.name}>
                <td>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.name}
                  </a>
                  <br />
                  <small>{s.publisher}</small>
                </td>
                <td>{s.license}</td>
                <td>{s.use}</td>
                <td>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">
          Objížďky počítá jádro aplikace nad grafem silnic kraje a silnic I. třídy z OpenStreetMap. Délky a časy
          objížďky jsou <b>odhad</b>, počet aut za den doplníme ze sčítání ŘSD.
        </p>
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
