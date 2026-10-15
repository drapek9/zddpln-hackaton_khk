import { useEffect, useState } from "react";
import Fold from "./Fold";
import type { Place, TripImpact } from "../lib/commute";
import { roundPlace } from "../lib/commute";
import { STATUS_LABEL, formatPeriod, formatSil } from "../lib/geo";
import { enablePush, fetchNotices, markNoticeRead, pushSupported, type Notice } from "../lib/notifications";
import type { User } from "../lib/auth";

type Props = {
  places: Place[];
  onPlaces: (next: Place[]) => void;
  picking: Place["kind"] | null;
  onPicking: (kind: Place["kind"] | null) => void;
  impact: TripImpact | null;
  onSelectRoad: (id: number) => void;
  user: User | null;
};

const NAME = { home: "Domov", work: "Práce" } as const;

// Veřejnost: „Moje cesty“. Ráno si zkontroluju, jestli mě cestou do práce něco nečeká.
export default function MyTrip({ places, onPlaces, picking, onPicking, impact, onSelectRoad, user }: Props) {
  const [geoError, setGeoError] = useState("");
  const [locating, setLocating] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pushState, setPushState] = useState<"idle" | "on" | "off">("idle");
  const citizen = user?.role === "citizen";

  useEffect(() => {
    if (!citizen) return;
    fetchNotices().then(setNotices).catch(() => setNotices([]));
  }, [citizen]);

  const enable = async () => {
    const ok = await enablePush().catch(() => false);
    setPushState(ok ? "on" : "off");
  };

  const read = async (id: number) => {
    await markNoticeRead(id).catch(() => undefined);
    setNotices((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const setPlace = (p: Place) => onPlaces([...places.filter((x) => x.kind !== p.kind), roundPlace(p)]);

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoError("Prohlížeč polohu nepodporuje. Klikněte místo toho do mapy.");
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPlace({ kind: "home", x: pos.coords.longitude, y: pos.coords.latitude });
      },
      () => {
        setLocating(false);
        setGeoError("Polohu se nepodařilo zjistit. Klikněte místo toho do mapy.");
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const problems = impact?.repairs.length || 0;
  const status = !impact ? null : problems ? "warn" : impact.badKm > 2 ? "meh" : "ok";

  return (
    <div className="mytrip">
      <p className="muted">Zadejte, kde bydlíte a kam jezdíte. Ukážeme opravy a uzavírky, které vás cestou potkají.</p>

      {(["home", "work"] as const).map((kind) => {
        const p = places.find((x) => x.kind === kind);
        return (
          <div key={kind} className={`place-row ${picking === kind ? "picking" : ""}`}>
            <span className={`place-pin ${kind}`}>{kind === "home" ? "⌂" : "▣"}</span>
            <div className="grow">
              <strong>{NAME[kind]}</strong>
              <small>{p ? `nastaveno (${p.y.toFixed(3)}, ${p.x.toFixed(3)})` : picking === kind ? "klikněte do mapy…" : "nenastaveno"}</small>
            </div>
            <button className="btn small" onClick={() => onPicking(picking === kind ? null : kind)}>
              {picking === kind ? "Zrušit" : p ? "Změnit" : "Vybrat v mapě"}
            </button>
          </div>
        );
      })}
      <div className="row-actions">
        <button className="btn primary grow" onClick={locate} disabled={locating}>
          {locating ? "Zjišťuji polohu…" : "◎ Použít mou polohu jako domov"}
        </button>
      </div>
      {geoError && <p className="hint">{geoError}</p>}

      {impact && (
        <div className={`trip-status ${status}`}>
          <b>
            {status === "warn"
              ? `Na cestě ${problems === 1 ? "je 1 omezení" : problems < 5 ? `jsou ${problems} omezení` : `je ${problems} omezení`}`
              : status === "meh"
                ? "Bez omezení, ale cestou je špatná silnice"
                : "Cesta je bez omezení"}
          </b>
          <span>
            {places.length === 2 ? `vzdušně ${impact.directKm.toFixed(1)} km` : "okruh 3 km kolem domova"} ·{" "}
            {impact.badKm.toFixed(1)} km havarijních silnic v okolí
          </span>
        </div>
      )}

      {impact && problems > 0 && (
        <Fold title="Co vás čeká" meta={problems} open>
          <ul className="trip-list">
            {impact.repairs.map(({ repair, road }) => (
              <li key={repair.id}>
                <button onClick={() => onSelectRoad(road.id)}>
                  <span className="rank-sil">
                    <i className={repair.status} />
                    {formatSil(road.sil, road.trida)} · {repair.restriction}
                  </span>
                  <span className="rank-meta">
                    {STATUS_LABEL[repair.status]} · {formatPeriod(repair)} · {road.okres}
                    {repair.simulated ? " · simulace" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Fold>
      )}

      {impact && impact.lines.length > 0 && (
        <Fold title="Autobusové linky ve vašem okolí" meta={impact.lines.length}>
          <div className="chips">
            {impact.lines.map((l) => (
              <span key={l} className="chip">
                {l}
              </span>
            ))}
          </div>
        </Fold>
      )}

      <Fold title="Upozornění" meta={notices.filter((n) => !n.read).length || undefined}>
        {!citizen && <p className="fine">Upozornění uvidí občan po přihlášení.</p>}
        {citizen && notices.length === 0 && <p className="fine">Zatím žádná upozornění.</p>}
        {citizen &&
          notices.map((n) => (
            <div key={n.id} className={n.read ? "notice" : "notice unread"} onClick={() => read(n.id)}>
              <b>{n.title}</b>
              <p className="fine">{n.body}</p>
            </div>
          ))}
        {citizen && pushSupported() && pushState !== "on" && (
          <button className="link" onClick={enable}>
            Zapnout upozornění v prohlížeči
          </button>
        )}
        {citizen && pushState === "on" && <p className="fine">Upozornění v prohlížeči zapnuta.</p>}
        {citizen && pushState === "off" && (
          <p className="fine">Upozornění v prohlížeči nejdou zapnout (chybí souhlas nebo klíč serveru). Seznam výše platí dál.</p>
        )}
      </Fold>

      <p className="fine">
        Odhad: bereme silnice v pásu 1,5 km kolem spojnice domov–práce. Trasu po silnicích dodá backend. Místa jsou jen v
        tomto prohlížeči, zaokrouhlená na ~100 m.{" "}
        {places.length > 0 && (
          <button className="link" onClick={() => onPlaces([])}>
            Smazat moje místa
          </button>
        )}
      </p>
    </div>
  );
}
