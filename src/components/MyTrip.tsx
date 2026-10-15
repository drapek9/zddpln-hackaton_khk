import { useEffect, useState } from "react";
import Fold from "./Fold";
import type { Place, TripImpact } from "../lib/commute";
import { MIN_PLACES, isSet, newPlace, placeLabel, roundCoord, setPlaces } from "../lib/commute";
import { STATUS_LABEL, formatPeriod, formatSil } from "../lib/geo";
import { enablePush, fetchNotices, markNoticeRead, pushSupported, type Notice } from "../lib/notifications";
import type { User } from "../lib/auth";

type Props = {
  places: Place[];
  onPlaces: (next: Place[]) => void;
  picking: string | null;
  onPicking: (id: string | null) => void;
  impact: TripImpact | null;
  onSelectRoad: (id: number) => void;
  user: User | null;
};


// Veřejnost: „Moje cesty“. Ráno si zkontroluju, jestli mě cestou do práce něco nečeká.
export default function MyTrip({ places, onPlaces, picking, onPicking, impact, onSelectRoad, user }: Props) {
  const [geoError, setGeoError] = useState("");
  const [locating, setLocating] = useState<string | null>(null);
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

  const patch = (id: string, change: Partial<Place>) =>
    onPlaces(places.map((p) => (p.id === id ? { ...p, ...change } : p)));
  // Nad minimem bod zmizí celý, u prvních dvou se jen vymaže výběr i název.
  const remove = (id: string) => {
    if (picking === id) onPicking(null);
    if (places.length > MIN_PLACES) onPlaces(places.filter((p) => p.id !== id));
    else patch(id, { name: "", x: null, y: null });
  };
  const add = () => onPlaces([...places, newPlace()]);
  const set = setPlaces(places);

  const locate = (id: string) => {
    if (!navigator.geolocation) {
      setGeoError("Prohlížeč polohu nepodporuje. Klikněte místo toho do mapy.");
      return;
    }
    setLocating(id);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(null);
        patch(id, { x: roundCoord(pos.coords.longitude), y: roundCoord(pos.coords.latitude) });
      },
      () => {
        setLocating(null);
        setGeoError("Polohu se nepodařilo zjistit. Klikněte místo toho do mapy.");
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const problems = impact?.repairs.length || 0;
  const status = !impact ? null : problems ? "warn" : impact.badKm > 2 ? "meh" : "ok";

  return (
    <div className="mytrip">
      <p className="muted">
        Vyberte v mapě body, mezi kterými jezdíte. Pojmenovat je můžete, nemusíte. Ukážeme, co vás cestou čeká.
      </p>

      <ol className="place-list">
        {places.map((p, i) => {
          const ok = isSet(p);
          const active = picking === p.id;
          return (
            <li key={p.id} className={`place-row ${active ? "picking" : ""}`}>
              <div className="place-head">
                <span className={`place-pin ${ok ? "set" : ""}`} aria-hidden="true">
                  {i + 1}
                </span>
                <div className="place-title">
                  <input
                    className="place-name"
                    value={p.name}
                    placeholder={`Bod ${i + 1}`}
                    aria-label={`Název bodu ${i + 1}`}
                    maxLength={40}
                    onChange={(e) => patch(p.id, { name: e.target.value })}
                  />
                  <small>{active ? "klikněte do mapy…" : ok ? "vybráno na mapě" : "zatím nevybráno"}</small>
                </div>
                {(ok || p.name || places.length > MIN_PLACES) && (
                  <button
                    className="icon-btn place-remove"
                    title={places.length > MIN_PLACES ? "Odebrat bod" : "Vymazat bod"}
                    aria-label={`Odebrat ${placeLabel(p, i)}`}
                    onClick={() => remove(p.id)}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="place-actions">
                  <button className={`btn small ${!ok && !active ? "primary" : ""}`} onClick={() => onPicking(active ? null : p.id)}>
                    {active ? "Zrušit" : ok ? "Změnit" : "Vybrat v mapě"}
                  </button>
                  <button className="btn small" onClick={() => locate(p.id)} disabled={locating != null} title="Použít mou polohu">
                    {locating === p.id ? "Zjišťuji…" : "◎ Moje poloha"}
                  </button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="place-add">
        <button className="btn small place-add-btn" onClick={add}>
          + Přidat bod
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
            {set.length > 1 ? `vzdušně ${impact.directKm.toFixed(1)} km` : `okruh 3 km kolem bodu ${placeLabel(set[0], places.indexOf(set[0]))}`} ·{" "}
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
        Odhad: bereme silnice v pásu 1,5 km kolem spojnic mezi body v pořadí seznamu. Body jsou v tomto prohlížeči,
        zaokrouhlená na ~100 m. Přihlášenému občanovi pošleme první dva na server kvůli upozornění na uzavírky.{" "}
        {set.length > 0 && (
          <button className="link" onClick={() => onPlaces(places.map((p) => ({ ...p, x: null, y: null })))}>
            Smazat všechny body
          </button>
        )}
      </p>
    </div>
  );
}
