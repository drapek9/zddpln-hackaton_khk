import { navigate } from "../lib/route";

// Vlastní stránka 404 (kap. 25.9).
export default function NotFound() {
  return (
    <div className="staff-login staff-missing">
      <section className="staff-card view-enter">
        <span className="staff-tag">Chyba 404</span>
        <h1>Tahle stránka neexistuje</h1>
        <p className="muted">Adresa je špatně nebo stránka zmizela. Zkuste jednu z těchto:</p>
        <div className="missing-links">
          <button className="btn primary" onClick={() => navigate("/")}>
            Mapa silnic
          </button>
          <button className="btn" onClick={() => navigate("/sprava")}>
            Správa silnic
          </button>
        </div>
      </section>
    </div>
  );
}
