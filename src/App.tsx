import { useEffect, useState } from "react";
import Landing from "./components/Landing";
import AdminApp from "./components/AdminApp";
import PublicApp from "./components/PublicApp";
import Sources from "./components/Sources";
import Privacy from "./components/Privacy";
import LoginScreen from "./components/LoginScreen";
import { loadDataset } from "./lib/data";
import { loadLocalRepairs, loadReports, saveRepairs, saveReports } from "./lib/store";
import { logout, me, onUnauthorized, type Session, type User } from "./lib/auth";
import type { Dataset, Repair, Report } from "./lib/types";

export type View = "home" | "login" | "public" | "office" | "sources" | "privacy";
type OfficeRole = "official" | "admin";

export default function App() {
  const [view, setView] = useState<View>("home");
  const [data, setData] = useState<Dataset | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Přihlášení (kap. 15): při načtení se zeptáme serveru, kdo jsem.
  const [session, setSession] = useState<Session | null>(null);
  const [loginNote, setLoginNote] = useState("");
  // Demo bez backendu: roli úřadu jde zvolit ručně, jen když server s přihlášením neběží.
  const [demoRole, setDemoRole] = useState<OfficeRole | null>(null);

  useEffect(() => {
    loadDataset()
      .then(({ data: next, repairs: seed }) => {
        setData(next);
        setRepairs(loadLocalRepairs(seed));
        setReports(loadReports());
      })
      .catch((err: Error) => setError(err.message));
    me().then(setSession);
  }, []);

  const user: User | null = session?.status === "user" ? session.user : null;
  const offline = session?.status === "offline";

  // Vypršelé přihlášení (API vrátilo 401): zpět na přihlášení.
  useEffect(
    () =>
      onUnauthorized(() => {
        if (!user) return;
        setSession({ status: "anon" });
        setLoginNote("Přihlášení vypršelo. Přihlaste se znovu.");
        setView("login");
      }),
    [user],
  );

  const enterAs = (next: User) => {
    setSession({ status: "user", user: next });
    setDemoRole(null);
    setLoginNote("");
    setView(next.role === "citizen" ? "public" : "office");
  };

  const signOut = async () => {
    await logout();
    setSession(offline ? { status: "offline" } : { status: "anon" });
    setDemoRole(null);
    setView("home");
  };

  if (error) {
    return (
      <div className="boot">
        <h1>Cesty KHK</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (!data || !session) {
    return (
      <div className="boot">
        <h1>Cesty KHK</h1>
        <p>Načítám silnice, zastávky, školy a nemocnice kraje…</p>
      </div>
    );
  }

  const officeRole: OfficeRole | null =
    user && (user.role === "official" || user.role === "admin") ? user.role : offline ? demoRole : null;

  const go = (next: View) => setView(next);

  if (view === "sources") return <Sources stats={data.stats} onHome={() => go("home")} onNavigate={go} />;
  if (view === "privacy") return <Privacy onHome={() => go("home")} onNavigate={go} />;

  if (view === "login" || (view === "office" && !officeRole)) {
    return (
      <LoginScreen
        offline={offline}
        note={loginNote}
        onUser={enterAs}
        onDemo={(role) => {
          setDemoRole(role);
          setView("office");
        }}
        onPublic={() => go("public")}
        onHome={() => go("home")}
        onNavigate={go}
      />
    );
  }

  if (view === "office" && officeRole) {
    return (
      <AdminApp
        data={data}
        role={officeRole}
        user={user}
        onRole={offline && !user ? setDemoRole : undefined}
        onLogout={signOut}
        repairs={repairs}
        onRepairs={(next) => {
          setRepairs(next);
          saveRepairs(next);
        }}
        onHome={() => go("home")}
      />
    );
  }

  if (view === "public") {
    return (
      <PublicApp
        data={data}
        repairs={repairs}
        reports={reports}
        user={user}
        onLogin={() => go("login")}
        onLogout={signOut}
        onReport={(report) => {
          const next = [report, ...reports];
          setReports(next);
          saveReports(next);
        }}
        onHome={() => go("home")}
      />
    );
  }

  return <Landing data={data} user={user} onNavigate={go} onLogout={signOut} />;
}
