import Footer from "./Footer";
import { ThemeToggle } from "../lib/theme";
import type { View } from "../App";

type Props = {
  onHome: () => void;
  onNavigate: (view: View) => void;
};

// Zásady ochrany údajů (F7, NAPADY č. 5 přesunuto do plánu kap. 17). Krátce a srozumitelně.
export default function Privacy({ onHome, onNavigate }: Props) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="tb-left">
          <button className="brand" onClick={onHome}>
            Cesty KHK
          </button>
          <span className="mode-tag light">Ochrana údajů</span>
        </div>
        <div className="tb-center" />
        <div className="tb-right">
          <ThemeToggle />
        </div>
      </header>
      <main className="sources doc">
        <h1>Ochrana osobních údajů</h1>
        <p className="muted">Krátce: ukládáme jen to, co je potřeba pro upozornění na uzavírky, a vše jde smazat.</p>

        <h2>Bez přihlášení</h2>
        <p>
          Veřejnou mapu můžete používat bez účtu. Na server nic neposíláme. V prohlížeči si pamatujeme jen vaše nastavení
          (světlý/tmavý režim, šířky panelů) a místa z „Moje cesty“. Ta jsou zaokrouhlená asi na 100 m a smažete je
          tlačítkem „Smazat moje místa“.
        </p>

        <h2>Účet občana</h2>
        <table>
          <thead>
            <tr>
              <th>Co ukládáme</th>
              <th>Proč</th>
              <th>Jak dlouho</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>E-mail</td>
              <td>Přihlášení a upozornění na uzavírky</td>
              <td>Do smazání účtu</td>
            </tr>
            <tr>
              <td>Heslo jen jako otisk (hash)</td>
              <td>Ověření při přihlášení. Samotné heslo neukládáme nikde.</td>
              <td>Do smazání účtu</td>
            </tr>
            <tr>
              <td>Domov a práce jako bod na mapě, ne adresa</td>
              <td>Najít uzavírky na vaší trase</td>
              <td>Do smazání míst nebo účtu</td>
            </tr>
            <tr>
              <td>Hlášení závad (text, místo)</td>
              <td>Předat správě silnic</td>
              <td>Do vyřízení hlášení</td>
            </tr>
          </tbody>
        </table>

        <h2>Přihlášení</h2>
        <p>
          Po přihlášení si prohlížeč drží přihlašovací cookie, kterou nečte žádný skript na stránce (httpOnly). Platí
          7 dní. Odhlášení ji smaže a zneplatní i její kopie.
        </p>

        <h2>Správci a admini</h2>
        <p>
          Účty úřadu zakládá kraj, registrací vzniká vždy jen účet občana. Změny priorit a vah se zapisují do záznamu
          změn (kdo, kdy a proč).
        </p>

        <h2>Smazání</h2>
        <p>
          Účet a uložená místa smažete v nastavení účtu, nebo napište správci aplikace. <span className="sim-tag">připravujeme</span>
        </p>
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
}
