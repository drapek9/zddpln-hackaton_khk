import type { View } from "../App";

type Props = {
  onNavigate: (view: View) => void;
};

// Patička (F7): zásady ochrany údajů, zdroje dat, odkaz na otevřená data kraje.
export default function Footer({ onNavigate }: Props) {
  return (
    <footer className="site-foot">
      <span>Cesty KHK · Hackathon KHK 2026 · data Královéhradeckého kraje</span>
      <nav>
        <button className="link" onClick={() => onNavigate("privacy")}>
          Ochrana osobních údajů
        </button>
        <button className="link" onClick={() => onNavigate("sources")}>
          Zdroje dat
        </button>
        <a href="https://www.datakhk.cz" target="_blank" rel="noreferrer">
          datakhk.cz
        </a>
      </nav>
    </footer>
  );
}
