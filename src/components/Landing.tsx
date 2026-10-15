import Footer from "./Footer";
import LoginCard from "./LoginCard";
import { ThemeToggle } from "../lib/theme";
import { ROLE_LABEL, type User } from "../lib/auth";
import type { View } from "../App";

type Props = {
  user: User | null;
  offline: boolean;
  note?: string;
  onUser: (user: User) => void;
  onDemo: (role: "official" | "admin") => void;
  onNavigate: (view: View) => void;
  onLogout: () => void;
};

// Úvod = přihlášení (kap. 15.1): vlevo název a krátký popis, vpravo přihlášení nebo vstup bez přihlášení.
export default function Landing({ user, offline, note, onUser, onDemo, onNavigate, onLogout }: Props) {
  const office = user?.role === "official" || user?.role === "admin";

  return (
    <div className="landing3">
      <div className="landing3-top">
        <ThemeToggle />
      </div>

      <section className="landing3-intro">
        <p className="eyebrow reveal" style={{ animationDelay: "0.05s" }}>
          Královéhradecký kraj · otevřená data
        </p>
        <h1 className="reveal" style={{ animationDelay: "0.15s" }}>
          Cesty KHK
        </h1>
        <p className="landing3-lead reveal" style={{ animationDelay: "0.3s" }}>
          Mapa krajských silnic: které opravit dřív, co uzavírka udělá s autobusy, školami a záchrankou, a co se
          opravuje na vaší cestě.
        </p>
        <ul className="landing3-points reveal" style={{ animationDelay: "0.45s" }}>
          <li>
            <b>Veřejnost</b> vidí opravy a uzavírky a zkontroluje si cestu do práce.
          </li>
          <li>
            <b>Úředníci</b> plánují opravy podle priority a rozpočtu.
          </li>
          <li>
            <b>Admin</b> spravuje váhy kraje a přístupy.
          </li>
        </ul>
      </section>

      <section className="landing3-auth">
        {user ? (
          <div className="auth-card view-enter">
            <p className="eyebrow">Přihlášeno</p>
            <h1>Vítejte</h1>
            <div className="user-menu">
              <span className="user-avatar" aria-hidden="true">
                {user.email.slice(0, 1).toUpperCase()}
              </span>
              <span className="user-id">
                <b>{user.email}</b>
                <small>{ROLE_LABEL[user.role]}</small>
              </span>
            </div>
            <button className="btn primary auth-submit" onClick={() => onNavigate(office ? "office" : "public")}>
              {office ? "Pokračovat do správy →" : "Otevřít mapu →"}
            </button>
            {office && (
              <button className="btn auth-public" onClick={() => onNavigate("public")}>
                Veřejná mapa
              </button>
            )}
            <button className="link" onClick={onLogout}>
              Odhlásit
            </button>
          </div>
        ) : (
          <LoginCard
            offline={offline}
            note={note}
            onUser={onUser}
            onDemo={onDemo}
            onPublic={() => onNavigate("public")}
            onNavigate={onNavigate}
          />
        )}
      </section>

      <div className="landing3-foot">
        <Footer onNavigate={onNavigate} />
      </div>
    </div>
  );
}
