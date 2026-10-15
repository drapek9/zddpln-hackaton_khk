import { useEffect, useMemo, useRef, useState } from "react";
import type { Dataset } from "../lib/types";
import { STAV_COLOR, STAV_ORDER, stavLabel } from "../lib/geo";
import { ThemeToggle, useTheme } from "../lib/theme";
import Footer from "./Footer";
import UserMenu from "./UserMenu";
import type { User } from "../lib/auth";
import type { View } from "../App";

type Props = {
  data: Dataset;
  user: User | null;
  onNavigate: (view: View) => void;
  onLogout: () => void;
};

const BAD = new Set(["havarijní", "SUPERhavarijní"]);
const WORSE = new Set(["havarijní", "SUPERhavarijní", "nevyhovující"]);

// Čísla se „dopočítají“ od nuly, když se stránka otevře.
function useCountUp(target: number, ms = 1600, delay = 300) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return value;
}

// Síť silnic kraje se postupně vykreslí od středu ven, barvou podle stavu.
function RoadNetwork({ data }: { data: Dataset }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const dark = theme === "dark";

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    data.roads.forEach((r) => {
      minX = Math.min(minX, r.b[0]);
      minY = Math.min(minY, r.b[1]);
      maxX = Math.max(maxX, r.b[2]);
      maxY = Math.max(maxY, r.b[3]);
    });
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const k = Math.cos((cy * Math.PI) / 180);
    // Od středu kraje ven, špatné úseky až nakonec, ať „rozsvítí“ mapu.
    const order = [...data.roads].sort((a, b) => {
      const da = Math.hypot((a.g[0][0] - cx) * k, a.g[0][1] - cy) + (BAD.has(a.stav) ? 0.25 : 0);
      const db = Math.hypot((b.g[0][0] - cx) * k, b.g[0][1] - cy) + (BAD.has(b.stav) ? 0.25 : 0);
      return da - db;
    });

    let raf = 0;
    let drawn = 0;
    let started = 0;
    const DURATION = 2600;

    const setup = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pad = 24;
      const s = Math.min((width - pad * 2) / ((maxX - minX) * k), (height - pad * 2) / (maxY - minY));
      const ox = (width - (maxX - minX) * k * s) / 2;
      const oy = (height - (maxY - minY) * s) / 2;
      return (p: [number, number]) => [ox + (p[0] - minX) * k * s, oy + (maxY - p[1]) * s] as const;
    };
    let project = setup();

    const drawRoad = (i: number) => {
      const r = order[i];
      const bad = BAD.has(r.stav);
      // Barvu mají jen špatné úseky, ostatní jsou neutrálně šedé.
      const colored = WORSE.has(r.stav);
      ctx.strokeStyle = colored ? STAV_COLOR[r.stav] : dark ? "#5b6676" : "#a8a29e";
      // Klidné čáry bez záře: špatné úseky o něco výraznější, ostatní ztlumené.
      ctx.globalAlpha = bad ? 0.85 : colored ? 0.7 : dark ? 0.45 : 0.55;
      ctx.lineWidth = bad ? 1.4 : 1;
      ctx.beginPath();
      r.g.forEach((p, j) => {
        const [x, y] = project(p);
        if (j) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
    };

    const redrawAll = () => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < drawn; i++) drawRoad(i);
    };

    const tick = (now: number) => {
      if (!started) started = now;
      const t = Math.min(1, (now - started) / DURATION);
      const target = Math.floor(order.length * (1 - Math.pow(1 - t, 2)));
      for (; drawn < target; drawn++) drawRoad(drawn);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    if (reduce) {
      drawn = order.length;
      redrawAll();
    } else raf = requestAnimationFrame(tick);

    const onResize = () => {
      project = setup();
      redrawAll();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [data.roads, dark]);

  return <canvas ref={ref} className="network" aria-hidden="true" />;
}

export default function Landing({ data, user, onNavigate, onLogout }: Props) {
  const office = user?.role === "official" || user?.role === "admin";
  const kmBad = useMemo(
    () => Math.round(data.roads.filter((r) => BAD.has(r.stav)).reduce((s, r) => s + r.delka, 0) / 1000),
    [data.roads],
  );
  const km = useCountUp(data.stats.km);
  const bad = useCountUp(kmBad, 1800, 700);
  const schools = useCountUp(
    data.pois.filter((p) => p.kind === "school").length,
    1600,
    1000,
  );

  return (
    <div className="landing2">
      <div className="landing2-glow" />
      <div className="landing2-toggle">
        <UserMenu user={user} onLogin={() => onNavigate("login")} onLogout={onLogout} />
        <ThemeToggle />
      </div>
      <RoadNetwork data={data} />

      <header className="landing2-hero">
        <p className="eyebrow reveal" style={{ animationDelay: "0.1s" }}>
          Královéhradecký kraj · otevřená data
        </p>
        <h1 className="reveal" style={{ animationDelay: "0.25s" }}>
          Cesty <span>KHK</span>
        </h1>
        <p className="landing2-lead reveal" style={{ animationDelay: "0.45s" }}>
          Které silnice opravit dřív, co uzavírka udělá s autobusy, školami a záchrankou, a co se právě opravuje
          na vaší cestě do práce.
        </p>
        <div className="landing2-stats reveal" style={{ animationDelay: "0.6s" }}>
          <div>
            <b>{km.toLocaleString("cs-CZ")}</b>
            <span>km krajských silnic</span>
          </div>
          <div className="bad">
            <b>{bad.toLocaleString("cs-CZ")}</b>
            <span>km v havarijním stavu</span>
          </div>
          <div>
            <b>{schools.toLocaleString("cs-CZ")}</b>
            <span>škol u silnic</span>
          </div>
        </div>
        <div className="landing2-legend reveal" style={{ animationDelay: "0.8s" }}>
          {STAV_ORDER.filter((s) => WORSE.has(s)).map((s) => (
            <span key={s}>
              <i style={{ background: STAV_COLOR[s] }} />
              {stavLabel(s)}
            </span>
          ))}
          <span>
            <i className="neutral" />
            ucházející až výborná
          </span>
        </div>
      </header>

      <section className="roles">
        <button className="role public reveal" style={{ animationDelay: "0.9s" }} onClick={() => onNavigate("public")}>
          <span className="role-icon">◎</span>
          <span className="portal-kicker">Pro každého</span>
          <strong>
            Veřejnost<span className="role-badge">{user?.role === "citizen" ? "přihlášen" : "bez přihlášení"}</span>
          </strong>
          <p>Mapa oprav a uzavírek, moje cesta domov–práce, jede můj autobus, nahlášení výtluku.</p>
          <span className="portal-go">{user ? "Otevřít mapu →" : "Pokračovat bez přihlášení →"}</span>
        </button>
        <button className="role official reveal" style={{ animationDelay: "1.05s" }} onClick={() => onNavigate("office")}>
          <span className="role-icon">▲</span>
          <span className="portal-kicker">Pro úřad a cestmistrovství</span>
          <strong>
            Úředník<span className="role-badge">{office ? "přihlášen" : "přihlášení"}</span>
          </strong>
          <p>Žebříček priority, simulátor uzavírky s objížďkou, plán podle rozpočtu. Přístup dává kraj, admin má navíc správu systému.</p>
          <span className="portal-go">{office ? "Pokračovat do správy →" : "Přihlásit se do správy →"}</span>
        </button>
      </section>

      <div className="landing2-foot">
        <Footer onNavigate={onNavigate} />
      </div>
    </div>
  );
}
