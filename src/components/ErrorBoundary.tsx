import { Component, type ReactNode } from "react";

// Zachycení chyb (kap. 25.9): místo bílé obrazovky karta s tlačítkem „Načíst znovu“.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="staff-login staff-missing">
        <section className="staff-card">
          <span className="staff-tag">Chyba</span>
          <h1>Něco se pokazilo</h1>
          <p className="muted">Stránka narazila na chybu. Data jsou v pořádku, stačí ji načíst znovu.</p>
          <div className="missing-links">
            <button className="btn primary" onClick={() => window.location.reload()}>
              Načíst znovu
            </button>
            <button className="btn" onClick={() => window.location.assign("/")}>
              Na úvod
            </button>
          </div>
        </section>
      </div>
    );
  }
}
