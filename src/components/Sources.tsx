import { SOURCES, sourceUrl } from "../lib/sources";
import type { Dataset } from "../lib/types";

type Props = {
  stats: Dataset["stats"];
  onHome: () => void;
};

export default function Sources({ stats, onHome }: Props) {
  return (
    <div className="app-shell public-theme">
      <header className="topbar">
        <button className="brand" onClick={onHome}>
          Cesty KHK
        </button>
        <span className="mode-tag light">Zdroje dat</span>
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
      </main>
    </div>
  );
}
