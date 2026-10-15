import { useEffect, useState } from "react";
import Landing from "./components/Landing";
import AdminApp from "./components/AdminApp";
import PublicApp from "./components/PublicApp";
import Sources from "./components/Sources";
import Privacy from "./components/Privacy";
import StaffLogin from "./components/StaffLogin";
import NotFound from "./components/NotFound";
import { areaOf, homeOf, navigate, onRoute } from "./lib/route";
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
  // Ukázka správy bez účtu: roli úřadu jde zvolit ručně (tlačítka Demo na přihlášení). Na server nic nezapisuje.
  const [demoRole, setDemoRole] = useState<OfficeRole | null>(null);
  // Adresa: "/" veřejnost, "/sprava" úředník, "/admin" admin (kap. 25).
  const [area, setArea] = useState(() => areaOf(window.location.pathname));
  useEffect(() => onRoute(() => setArea(areaOf(window.location.pathname))), []);

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
    // Na /sprava a /admin zůstaneme (špatná role uvidí „Nemáte oprávnění“), z "/" jdeme na domovskou adresu role.
    if (areaOf(window.location.pathname) === "public") {
      if (next.role === "citizen") setView("public");
      else navigate(homeOf(next.role));
    }
  };

  const signOut = async () => {
    await logout();
    setSession(offline ? { status: "offline" } : { status: "anon" });
    setDemoRole(null);
    setView("home");
  };

  useEffect(() => {
    const titles = { public: "Cesty KHK – mapa silnic", sprava: "Správa silnic – Cesty KHK", admin: "Administrace – Cesty KHK", missing: "Stránka neexistuje – Cesty KHK" };
    document.title = titles[area];
  }, [area]);

  if (error) {
    return (
      <div className="boot">
        <h1>Cesty KHK</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (area === "missing") return <NotFound />;
  if (!data || !session) {
    return (
      <div className="boot">
        <h1>Cesty KHK</h1>
        <p>Načítám silnice, zastávky, školy a nemocnice kraje…</p>
      </div>
    );
  }

  // /sprava a /admin: vlastní přihlášení, bez registrace a bez demo vstupu (kap. 25.8).
  if (area === "sprava" || area === "admin") {
    const allowed = !!user && (area === "admin" ? user.role === "admin" : user.role !== "citizen");
    if (!allowed) {
      return (
        <StaffLogin
          area={area}
          denied={user}
          offline={offline}
          note={loginNote}
          onUser={enterAs}
          onLogout={signOut}
        />
      );
    }
    return (
      <AdminApp
        key={area}
        data={data}
        role={area === "admin" ? "admin" : "official"}
        user={user}
        onLogout={async () => {
          await signOut();
          navigate(area === "admin" ? "/admin" : "/sprava");
        }}
        repairs={repairs}
        onRepairs={(next) => {
          setRepairs(next);
          saveRepairs(next);
        }}
        onHome={() => navigate("/")}
      />
    );
  }

  const officeRole: OfficeRole | null =
    user && (user.role === "official" || user.role === "admin") ? user.role : !user ? demoRole : null;

  const go = (next: View) => setView(next);

  if (view === "sources") return <Sources stats={data.stats} onHome={() => go("home")} onNavigate={go} />;
  if (view === "privacy") return <Privacy onHome={() => go("home")} onNavigate={go} />;

  // Přihlášení je přímo na úvodní stránce (vpravo).
  const showLanding = view === "home" || view === "login" || (view === "office" && !officeRole);

  if (!showLanding && view === "office" && officeRole) {
    return (
      <AdminApp
        data={data}
        role={officeRole}
        user={user}
        onRole={!user ? setDemoRole : undefined}
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

  return (
    <Landing
      user={user}
      offline={offline}
      note={loginNote}
      onUser={enterAs}
      onDemo={(role) => {
        setDemoRole(role);
        setView("office");
      }}
      onNavigate={go}
      onLogout={signOut}
    />
  );
}
