import { useEffect, useState } from "react";
import Fold from "./Fold";
import type { Place, TripImpact } from "../lib/commute";
import { MIN_PLACES, isSet, newPlace, roundCoord, setPlaces } from "../lib/commute";
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

const SUGGEST = ["Domov", "Práce", "Škola", "Lékař", "Nemocnice", "Nákupy"];

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
  const remove = (id: string) => {
    if (picking === id) onPicking(null);
    onPlaces(places.filter((p) => p.id !== id));
  };
  const add = (name = "") => onPlaces([...places, newPlace(name)]);
  const unused = SUGGEST.filter((s) => !places.some((p) => p.name.trim().toLowerCase() === s.toLowerCase()));
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
        Zadejte místa, mezi kterými jezdíte, třeba domov, práci nebo lékaře. Ukážeme opravy a uzavírky, které vás cestou
        potkají.
      </p>

      <ol className="place-list">
        {places.map((p, i) => {
          const ok = isSet(p);
          const active = picking === p.id;
          return (
            <li key={p.id} className={`place-row ${active ? "picking" : ""}`}>
              <span className={`place-pin ${ok ? "set" : ""}`} aria-hidden="true">
                {i + 1}
              </span>
              <div className="place-body">
                <div className="place-head">
                  <input
                    className="place-name"
                    value={p.name}
                    placeholder="Název, např. nemocnice"
                    aria-label={`Název místa ${i + 1}`}
                    maxLength={40}
                    onChange={(e) => patch(p.id, { name: e.target.value })}
                  />
                  {places.length > MIN_PLACES && (
                    <button className="icon-btn" title="Odebrat místo" aria-label={`Odebrat ${p.name || `místo ${i + 1}`}`} onClick={() => remove(p.id)}>
                      ×
                    </button>
                  )}
                </div>
                <small>{active ? "klikněte do mapy…" : ok ? "vybráno na mapě" : "zatím nevybráno"}</small>
                <div className="place-actions">
                  <button className={`btn small ${!ok && !active ? "primary" : ""}`} onClick={() => onPicking(active ? null : p.id)}>
                    {active ? "Zrušit" : ok ? "Změnit" : "Vybrat v mapě"}
                  </button>
                  <button className="btn small" onClick={() => locate(p.id)} disabled={locating != null} title="Použít mou polohu">
                    {locating === p.id ? "Zjišťuji…" : "◎ Moje poloha"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="place-add">
        <button className="btn small" onClick={() => add()}>
          + Přidat místo
        </button>
        {unused.slice(0, 4).map((s) => (
          <button key={s} className="chip chip-btn" onClick={() => add(s)}>
            + {s}
          </button>
        ))}
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
            {set.length > 1 ? `vzdušně ${impact.directKm.toFixed(1)} km` : `okruh 3 km kolem místa ${set[0]?.name || ""}`.trim()} ·{" "}
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
        Odhad: bereme silnice v pásu 1,5 km kolem spojnic mezi místy v pořadí seznamu. Místa jsou v tomto prohlížeči,
        zaokrouhlená na ~100 m. Přihlášenému občanovi pošleme první dvě na server kvůli upozornění na uzavírky.{" "}
        {set.length > 0 && (
          <button className="link" onClick={() => onPlaces(places.map((p) => ({ ...p, x: null, y: null })))}>
            Smazat polohy míst
          </button>
        )}
      </p>
    </div>
  );
}
