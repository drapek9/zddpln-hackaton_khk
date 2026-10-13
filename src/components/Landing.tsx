type Props = {
  onChoose: (mode: "admin" | "public" | "sources") => void;
};

export default function Landing({ onChoose }: Props) {
  return (
    <div className="landing">
      <div className="landing-bg" />
      <header className="landing-top">
        <div>
          <p className="eyebrow">Královéhradecký kraj · otevřená data</p>
          <h1>Cesty KHK</h1>
        </div>
        <p className="landing-lead">
          Opravy silnic podle stavu, škol, nemocnic a autobusů. Jedna mapa pro správu kraje
          a druhá pro kohokoliv, kdo potřebuje vědět, kudy dnes projede.
        </p>
      </header>
      <div className="landing-cards">
        <button className="portal-card admin" onClick={() => onChoose("admin")}>
          <span className="portal-kicker">Vstup pro úřad</span>
          <strong>Správa silnic</strong>
          <p>
            Prioritizace úseků, dopady uzavírky na IZS, školy a linky IREDO, návrh opravy
            a hotové oznámení pro obce i dopravce.
          </p>
          <span className="portal-go">Otevřít správu →</span>
        </button>
        <button className="portal-card public" onClick={() => onChoose("public")}>
          <span className="portal-kicker">Veřejný přehled</span>
          <strong>Co se opravuje</strong>
          <p>
            Probíhající i plánované práce, zda jede váš autobus, proč se opravuje právě
            tenhle úsek, a hlášení výtluku.
          </p>
          <span className="portal-go">Podívat se na mapu →</span>
        </button>
      </div>
      <p className="landing-note">
        Data: stav povrchu (poslední měření každého úseku), opravy od 2016, zastávky a linky VDKHK,
        školy, nemocnice, ZZS, HZS, policie a zaručené přípoje z katalogu{" "}
        <a href="https://www.datakhk.cz" target="_blank" rel="noreferrer">
          datakhk.cz
        </a>
        .{" "}
        <button className="link" onClick={() => onChoose("sources")}>
          Všechny zdroje dat →
        </button>
      </p>
    </div>
  );
}
