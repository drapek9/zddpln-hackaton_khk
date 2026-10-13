import { useEffect, useState } from "react";
import Landing from "./components/Landing";
import AdminApp from "./components/AdminApp";
import PublicApp from "./components/PublicApp";
import Sources from "./components/Sources";
import { loadDataset } from "./lib/data";
import { loadLocalRepairs, loadReports, saveRepairs, saveReports } from "./lib/store";
import type { Dataset, Repair, Report } from "./lib/types";

export default function App() {
  const [mode, setMode] = useState<"home" | "admin" | "public" | "sources">("home");
  const [data, setData] = useState<Dataset | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDataset()
      .then(({ data: next, repairs: seed }) => {
        setData(next);
        setRepairs(loadLocalRepairs(seed));
        setReports(loadReports());
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="boot">
        <h1>Cesty KHK</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="boot">
        <h1>Cesty KHK</h1>
        <p>Načítám silnice, zastávky, školy a nemocnice kraje…</p>
      </div>
    );
  }

  if (mode === "home") return <Landing onChoose={setMode} />;
  if (mode === "sources") return <Sources stats={data.stats} onHome={() => setMode("home")} />;
  if (mode === "admin") {
    return (
      <AdminApp
        data={data}
        repairs={repairs}
        onRepairs={(next) => {
          setRepairs(next);
          saveRepairs(next);
        }}
        onHome={() => setMode("home")}
      />
    );
  }
  return (
    <PublicApp
      data={data}
      repairs={repairs}
      reports={reports}
      onReport={(report) => {
        const next = [report, ...reports];
        setReports(next);
        saveReports(next);
      }}
      onHome={() => setMode("home")}
    />
  );
}
