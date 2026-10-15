import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import type { Poi, Repair, Road, Stop } from "../lib/types";
import { KIND_COLOR, KIND_LABEL, STAV_COLOR, formatSil, midpoint } from "../lib/geo";

type Props = {
  roads: Road[];
  repairs: Repair[];
  selectedId: number | null;
  onSelect: (id: number | null, lngLat?: { lng: number; lat: number }) => void;
  /** Podklad mapy: světlý režim (barevný Voyager), tmavý režim (dark matter). */
  theme: MapTheme;
  showCondition: boolean;
  pois?: Poi[];
  stops?: Stop[];
  showPois?: boolean;
  /** Objížďka uzavřeného úseku ([lon, lat]), simulátor uzavírky. */
  detour?: [number, number][] | null;
  /** Zvýrazněné úseky (rozpočtový plán, komplikace na mé cestě). */
  highlight?: number[];
  /** Moje místa a spojnice mezi nimi (veřejnost, Moje cesty). */
  places?: { id: string; name: string; x: number; y: number }[];
  /** Úsek pod myší v seznamu (náhled před kliknutím). */
  hoverId?: number | null;
  /** Opravy a uzavírky kraje (zář kolem silnice). Veřejnost je zapíná ve filtru. */
  showRepairs?: boolean;
  /** Právě probíhající uzavírky ŘSD (SRTI). Veřejnost je zapíná ve filtru. */
  showSrti?: boolean;
};

// Výchozí pohled na celý kraj, tlačítko „Zpět na kraj“ se k němu vrací.
const HOME_VIEW = { center: [15.83, 50.35] as [number, number], zoom: 8.4, bearing: 0, pitch: 0 };

// Hranice kraje (Data KHK, „Hranice Královéhradeckého kraje“, CC0). Okolí kraje je šedé, kraj zůstane barevný.
type Ring = [number, number][];
let krajPromise: Promise<Ring[] | null> | null = null;
function loadKraj() {
  krajPromise ??= fetch("/geo/kraj.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((fc) => {
      const g = fc?.features?.[0]?.geometry;
      if (!g) return null;
      return (g.type === "Polygon" ? [g.coordinates[0]] : g.coordinates.map((p: Ring[]) => p[0])) as Ring[];
    })
    .catch(() => null);
  return krajPromise;
}

const WORLD: Ring = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

/** Hranice kraje i státu: tmavě zelená čára (v tmavém režimu světlejší, aby byla vidět). */
// Neutrální tmavě šedá (TODO_FRONTEND F‑7): zelená se pletla se silnicí ve stavu „dobrý“.
export const BORDER_COLOR = { light: "#3f3f46", dark: "#a1a1aa" };

// Opravy a uzavírky jsou jiný kanál než stav (F‑6): přerušovaná čára přes silnici, ne další odstín.
export const REPAIR_DASH = {
  light: { active: "#111827", planned: "#7c3aed", done: "#64748b" },
  dark: { active: "#f8fafc", planned: "#c4b5fd", done: "#94a3b8" },
};

// Objížďka (Tomáš 15. 10.): výrazná, s bílým lemem a měkkou září, ať je vidět přes stav silnic.
const DETOUR_COLOR = { light: "#6d28d9", dark: "#c4b5fd" };

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** Státní hranici z podkladové mapy přebarvíme stejně jako hranici kraje. */
function styleCountryBorder(map: MapLibreMap, dark: boolean) {
  if (!map.getLayer("boundary_country_inner")) return;
  map.setPaintProperty("boundary_country_inner", "line-color", dark ? BORDER_COLOR.dark : BORDER_COLOR.light);
  map.setPaintProperty("boundary_country_inner", "line-width", ["interpolate", ["linear"], ["zoom"], 6, 1.5, 12, 3]);
  map.setPaintProperty("boundary_country_inner", "line-opacity", 0.9);
}

/**
 * Žluté a oranžové silnice podkladu přebarvíme na neutrální šedou. Naše data leží kousek vedle
 * silnice z OpenStreetMap, takže se při přiblížení barvy stavu míchaly se žlutou podkladu.
 */
function neutralBaseRoads(map: MapLibreMap, dark: boolean) {
  if (dark) return;
  for (const layer of map.getStyle().layers) {
    if (layer.type !== "line" || !/^(road|bridge|tunnel)_(sec|pri|trunk|mot)_/.test(layer.id)) continue;
    map.setPaintProperty(layer.id, "line-color", layer.id.includes("_case") ? "#dedad2" : "#ffffff");
  }
}

function addKraj(map: MapLibreMap, rings: Ring[], dark: boolean) {
  if (map.getSource("kraj")) return;
  const before = map.getLayer("roads-glow") ? "roads-glow" : undefined;
  map.addSource("kraj-mask", {
    type: "geojson",
    data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [WORLD, ...rings] } },
  });
  map.addSource("kraj", {
    type: "geojson",
    data: { type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: rings } },
  });
  map.addLayer(
    {
      id: "kraj-mask",
      type: "fill",
      source: "kraj-mask",
      paint: { "fill-color": dark ? "#05080c" : "#8a8f96", "fill-opacity": dark ? 0.42 : 0.3 },
    },
    before,
  );
  map.addLayer(
    {
      id: "kraj-line",
      type: "line",
      source: "kraj",
      layout: { "line-join": "round" },
      paint: {
        "line-color": dark ? BORDER_COLOR.dark : BORDER_COLOR.light,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.8, 12, 3.5],
        "line-opacity": 0.9,
      },
    },
    before,
  );
}

const EMPTY: number[] = [];
const EMPTY_PLACES: NonNullable<Props["places"]> = [];

function placesToGeo(places: NonNullable<Props["places"]>) {
  const pts = places.map((p, i) => ({
    type: "Feature" as const,
    properties: { kind: i === 0 ? "first" : "place", label: p.name },
    geometry: { type: "Point" as const, coordinates: [p.x, p.y] },
  }));
  const line =
    places.length >= 2
      ? [{ type: "Feature" as const, properties: { kind: "link", label: "" }, geometry: { type: "LineString" as const, coordinates: places.map((p) => [p.x, p.y]) } }]
      : [];
  return { type: "FeatureCollection" as const, features: [...line, ...pts] };
}

export type MapTheme = "dark" | "light" | "office";

const STYLES: Record<MapTheme, string> = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  office: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
};

/** Barva zvýrazněných úseků podle podkladu (stejná v legendě). */
// Zvýraznění (stavby rozpočtu, úseky na cestě): modrá, aby se nepletla se zelenou hranicí kraje.
export const HIGHLIGHT_COLOR: Record<MapTheme, string> = { dark: "#5eb2ff", light: "#1d5fd6", office: "#1d5fd6" };

function roadsToGeo(roads: Road[], repairs: Repair[]) {
  const byRoad = new Map(repairs.map((r) => [r.roadId, r.status]));
  return {
    type: "FeatureCollection" as const,
    features: roads.map((r) => ({
      type: "Feature" as const,
      id: r.id,
      properties: {
        id: r.id,
        stav: r.stav,
        sil: r.sil,
        repair: byRoad.get(r.id) || "",
      },
      geometry: { type: "LineString" as const, coordinates: r.g },
    })),
  };
}

function detourToGeo(detour: [number, number][] | null | undefined) {
  return {
    type: "FeatureCollection" as const,
    features: detour?.length
      ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: detour } }]
      : [],
  };
}

function pointsToGeo(points: { id: string; x: number; y: number; name: string; kind?: string }[]) {
  return {
    type: "FeatureCollection" as const,
    features: points.map((p) => ({
      type: "Feature" as const,
      properties: { id: p.id, name: p.name, kind: p.kind || "stop" },
      geometry: { type: "Point" as const, coordinates: [p.x, p.y] },
    })),
  };
}

function MapInner({
  roads,
  repairs,
  selectedId,
  onSelect,
  theme,
  showCondition,
  pois = [],
  stops = [],
  showPois = false,
  detour = null,
  highlight = EMPTY,
  places = EMPTY_PLACES,
  hoverId = null,
  showRepairs = true,
  showSrti = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const prevSelectedRef = useRef<number | null>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const detourRef = useRef(detour);
  detourRef.current = detour;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const showConditionRef = useRef(showCondition);
  showConditionRef.current = showCondition;
  const showPoisRef = useRef(showPois);
  showPoisRef.current = showPois;
  const showRepairsRef = useRef(showRepairs);
  showRepairsRef.current = showRepairs;
  const showSrtiRef = useRef(showSrti);
  showSrtiRef.current = showSrti;
  const highlightRef = useRef(highlight);
  highlightRef.current = highlight;
  const placesRef = useRef(places);
  placesRef.current = places;
  const roadsRef = useRef(roads);
  roadsRef.current = roads;
  const fitKeyRef = useRef<string | null>(null);
  // Otáčení a náklon (3D) je ve výchozím stavu vypnuté, aby se mapa omylem nepřetočila.
  const [tilt, setTilt] = useState(false);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLES[theme],
      center: HOME_VIEW.center,
      zoom: HOME_VIEW.zoom,
      attributionControl: false,
      dragRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.touchPitch.disable();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: "Silnice I. třídy pro objížďky © přispěvatelé OpenStreetMap (ODbL)",
      }),
      "bottom-left",
    );
    mapRef.current = map;
    // Mapa se přizpůsobí, když si uživatel roztáhne boční panel.
    // Jednou za snímek a hned překreslit, jinak plátno na snímek zčerná (blikání).
    let resizeFrame = 0;
    const ro = new ResizeObserver(() => {
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        map.resize();
        map.redraw();
      });
    });
    ro.observe(ref.current);

    map.on("load", () => {
      const labels = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
      map.addSource("roads", { type: "geojson", data: roadsToGeo(roads, repairs), promoteId: "id" });
      styleCountryBorder(map, theme === "dark");
      neutralBaseRoads(map, theme === "dark");
      loadKraj().then((rings) => rings && mapRef.current === map && addKraj(map, rings, theme === "dark"));
      map.addSource("pois", { type: "geojson", data: pointsToGeo(pois) });
      map.addSource("stops", { type: "geojson", data: pointsToGeo(stops.map((s) => ({ ...s, kind: "stop" }))) });

      const dash = REPAIR_DASH[theme === "dark" ? "dark" : "light"];
      map.addLayer({
        id: "roads-glow",
        type: "line",
        source: "roads",
        filter: ["!=", ["get", "repair"], ""],
        layout: { visibility: showRepairsRef.current ? "visible" : "none", "line-cap": "butt", "line-join": "round" },
        paint: {
          "line-color": ["match", ["get", "repair"], "active", dash.active, "planned", dash.planned, dash.done],
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 2.5, 12, 4, 14, 6, 16, 9, 18, 14],
          "line-dasharray": [1.4, 1.1],
          "line-opacity": 0.95,
        },
      }, labels);
      map.addLayer({
        id: "roads-line",
        type: "line",
        source: "roads",
        // Kulaté konce: navazující úseky se nepřekrývají zubatými rohy.
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": [
            "match",
            ["get", "stav"],
            "SUPERhavarijní",
            STAV_COLOR.SUPERhavarijní,
            "havarijní",
            STAV_COLOR.havarijní,
            "nevyhovující",
            STAV_COLOR.nevyhovující,
            "vyhovující",
            STAV_COLOR.vyhovující,
            "dobrý",
            STAV_COLOR.dobrý,
            "výborný",
            STAV_COLOR.výborný,
            "#94a3b8",
          ],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            ["case", ["boolean", ["feature-state", "selected"], false], 3.5, ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "pointer"], false]], 3, 1.2],
            12,
            ["case", ["boolean", ["feature-state", "selected"], false], 8, ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "pointer"], false]], 7, 3.2],
            // Při velkém přiblížení silnice překryje podkladovou silnici, barvy se nemíchají.
            14,
            ["case", ["boolean", ["feature-state", "selected"], false], 12, ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "pointer"], false]], 11, 7],
            16,
            ["case", ["boolean", ["feature-state", "selected"], false], 20, ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "pointer"], false]], 19, 14],
            18,
            ["case", ["boolean", ["feature-state", "selected"], false], 34, ["any", ["boolean", ["feature-state", "hover"], false], ["boolean", ["feature-state", "pointer"], false]], 33, 26],
          ],
          "line-opacity": showConditionRef.current ? 1 : 0.32,
        },
      }, labels);
      // Přerušovaná čára oprav je nad barvou stavu, mezerami je stav pořád vidět.
      map.moveLayer("roads-glow", labels);
      // Neviditelná široká čára jen pro klik a najetí: trefit tenkou silnici prstem je jinak těžké.
      map.addLayer({
        id: "roads-hit",
        type: "line",
        source: "roads",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#000",
          "line-opacity": 0,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 14, 12, 22, 16, 30, 18, 40],
        },
      }, labels);
      map.addLayer(
        {
          id: "roads-highlight",
          type: "line",
          source: "roads",
          filter: ["in", ["get", "id"], ["literal", highlightRef.current]],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": HIGHLIGHT_COLOR[theme],
            "line-width": ["interpolate", ["linear"], ["zoom"], 7, 4.5, 12, 10, 14, 15, 16, 24, 18, 38],
            "line-opacity": 1,
          },
        },
        // Nad ostatními silnicemi, aby vybrané úseky byly vidět hned.
        labels,
      );
      // Právě probíhající uzavírky ŘSD (SRTI, CC BY 4.0). Při chybě backendu se vrstva nezobrazí.
      map.addSource("srti", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "srti-points",
        type: "circle",
        source: "srti",
        layout: { visibility: showSrtiRef.current ? "visible" : "none" },
        // Bílý bod s tmavým okrajem, aby se nesplýval s barvami silnic.
        paint: {
          "circle-radius": 7,
          "circle-color": "#ffffff",
          "circle-stroke-color": "#0b1220",
          "circle-stroke-width": 2.5,
        },
      });
      fetch("/api/closures", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { srti?: { id: string; label: string; full_closure: boolean; lon: number; lat: number }[] } | null) => {
          const items = body?.srti ?? [];
          const src = map.getSource("srti") as GeoJSONSource | undefined;
          src?.setData({
            type: "FeatureCollection",
            features: items.map((s) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [s.lon, s.lat] },
              properties: { id: s.id, label: s.label, full: s.full_closure },
            })),
          });
        })
        .catch(() => undefined);
      map.addSource("places", { type: "geojson", data: placesToGeo(placesRef.current) });
      map.addSource("detour", { type: "geojson", data: detourToGeo(detourRef.current) });
      const detourColor = DETOUR_COLOR[theme === "dark" ? "dark" : "light"];
      map.addLayer({
        id: "detour-glow",
        type: "line",
        source: "detour",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": detourColor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 14, 12, 22, 16, 34],
          "line-blur": 6,
          "line-opacity": 0.3,
        },
      }, labels);
      map.addLayer({
        id: "detour-casing",
        type: "line",
        source: "detour",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": theme === "dark" ? "#0b1220" : "#ffffff",
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 8, 12, 12, 16, 20],
        },
      }, labels);
      map.addLayer({
        id: "detour-line",
        type: "line",
        source: "detour",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": detourColor,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 4.5, 12, 7, 16, 12],
        },
      }, labels);
      map.addLayer({
        id: "poi-circles",
        type: "circle",
        source: "pois",
        minzoom: 9,
        layout: { visibility: showPoisRef.current ? "visible" : "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3, 13, 6],
          "circle-color": [
            "match",
            ["get", "kind"],
            "hospital",
            KIND_COLOR.hospital,
            "school",
            KIND_COLOR.school,
            "zzs",
            KIND_COLOR.zzs,
            "hzs",
            KIND_COLOR.hzs,
            "police",
            KIND_COLOR.police,
            "industry",
            KIND_COLOR.industry,
            "social",
            KIND_COLOR.social,
            "rail",
            KIND_COLOR.rail,
            "#64748b",
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff",
          "circle-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "stop-circles",
        type: "circle",
        source: "stops",
        minzoom: 11,
        paint: {
          "circle-radius": 3,
          "circle-color": KIND_COLOR.stop,
          "circle-opacity": 0.7,
        },
      });

      map.addLayer({
        id: "places-link",
        type: "line",
        source: "places",
        filter: ["==", ["get", "kind"], "link"],
        paint: { "line-color": theme === "dark" ? "#93c5fd" : "#1e3a5f", "line-width": 3, "line-dasharray": [2, 1.5], "line-opacity": 0.8 },
      });
      map.addLayer({
        id: "places-dot",
        type: "circle",
        source: "places",
        filter: ["!=", ["get", "kind"], "link"],
        paint: {
          "circle-radius": 9,
          "circle-color": ["match", ["get", "kind"], "first", "#0f6b5c", theme === "dark" ? "#3b82f6" : "#1e3a5f"],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#fff",
        },
      });

      if (selectedRef.current != null) {
        map.setFeatureState({ source: "roads", id: selectedRef.current }, { selected: true });
        prevSelectedRef.current = selectedRef.current;
      }

      const nearestRoad = (point: maplibregl.PointLike) => {
        const hits = map.queryRenderedFeatures(point, { layers: ["roads-hit"] });
        if (hits.length < 2) return hits[0]?.properties?.id as number | undefined;
        const at = map.unproject(point);
        let best: number | undefined;
        let bestD = Infinity;
        for (const f of hits) {
          const g = f.geometry;
          const lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
          for (const line of lines)
            for (const [x, y] of line) {
              const d = (x - at.lng) ** 2 + (y - at.lat) ** 2;
              if (d < bestD) {
                bestD = d;
                best = f.properties?.id;
              }
            }
        }
        return best;
      };
      // F‑5: tečky (školy, nemocnice, IZS, zastávky, uzavírky ŘSD) mají vlastní kartu s názvem a vzdáleností k silnici.
      const pointLayers = ["poi-circles", "stop-circles", "srti-points"];
      let popup: maplibregl.Popup | null = null;
      map.on("click", (e) => {
        const visible = pointLayers.filter((l) => map.getLayer(l) && map.getLayoutProperty(l, "visibility") !== "none");
        const point = visible.length ? map.queryRenderedFeatures(e.point, { layers: visible })[0] : undefined;
        if (point && point.geometry.type === "Point") {
          const [lng, lat] = point.geometry.coordinates as [number, number];
          const p = point.properties || {};
          const kind = point.layer.id === "srti-points" ? "Uzavírka ŘSD" : KIND_LABEL[p.kind as string] || (p.kind === "stop" ? "Zastávka" : "Místo");
          const name = String(p.name || p.label || kind);
          // Nejbližší silnice kraje a vzdálenost k ní (rovinná aproximace, na kraj stačí).
          const k = Math.cos((lat * Math.PI) / 180) * 111.32;
          let best: Road | null = null;
          let bestD = Infinity;
          for (const r of roadsRef.current)
            for (const [x, y] of r.g) {
              const d = Math.hypot((x - lng) * k, (y - lat) * 110.57);
              if (d < bestD) {
                bestD = d;
                best = r;
              }
            }
          const dist = bestD < 1 ? `${Math.round(bestD * 1000)} m` : `${bestD.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} km`;
          popup?.remove();
          popup = new maplibregl.Popup({ closeButton: true, maxWidth: "260px", className: "poi-popup" })
            .setLngLat([lng, lat])
            .setHTML(
              `<span class="poi-kind">${escapeHtml(kind)}</span><b>${escapeHtml(name)}</b>` +
                (best ? `<small>${dist} od silnice ${escapeHtml(formatSil(best.sil, best.trida))}</small>` : ""),
            )
            .addTo(map);
          return;
        }
        const id = nearestRoad(e.point);
        onSelectRef.current(id != null ? Number(id) : null, e.lngLat);
      });
      for (const l of pointLayers) {
        map.on("mouseenter", l, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", l, () => (map.getCanvas().style.cursor = ""));
      }
      let pointerId: number | null = null;
      const setPointer = (id: number | null) => {
        if (id === pointerId) return;
        if (pointerId != null) map.setFeatureState({ source: "roads", id: pointerId }, { pointer: false });
        if (id != null) map.setFeatureState({ source: "roads", id }, { pointer: true });
        pointerId = id;
      };
      map.on("mousemove", "roads-hit", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const id = nearestRoad(e.point);
        setPointer(id != null ? Number(id) : null);
      });
      map.on("mouseleave", "roads-hit", () => {
        map.getCanvas().style.cursor = "";
        setPointer(null);
      });
    });

    return () => {
      ro.disconnect();
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      map.remove();
      mapRef.current = null;
    };
    // theme is applied by recreating — handled in a dedicated effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("roads") as GeoJSONSource | undefined;
      src?.setData(roadsToGeo(roads, repairs));
      const poisSrc = map.getSource("pois") as GeoJSONSource | undefined;
      poisSrc?.setData(pointsToGeo(pois));
      const stopSrc = map.getSource("stops") as GeoJSONSource | undefined;
      stopSrc?.setData(pointsToGeo(stops.map((s) => ({ ...s, kind: "stop" }))));
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [roads, repairs, pois, stops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      (map.getSource("detour") as GeoJSONSource | undefined)?.setData(detourToGeo(detour));
      if (!detour?.length) return;
      const bounds = new maplibregl.LngLatBounds(detour[0], detour[0]);
      detour.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 700 });
    };
    if (map.getSource("detour")) apply();
    else map.once("load", apply);
  }, [detour]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (map.getLayer("roads-highlight")) map.setFilter("roads-highlight", ["in", ["get", "id"], ["literal", highlight]]);
    };
    if (map.getLayer("roads-highlight")) apply();
    else map.once("load", apply);
  }, [highlight]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      (map.getSource("places") as GeoJSONSource | undefined)?.setData(placesToGeo(places));
      // Přiblížit jen když se body opravdu posunuly. Přepnutí filtru nebo přejmenování
      // bodu nechá mapu tam, kde ji uživatel má.
      const key = places.map((p) => `${p.x},${p.y}`).join(";");
      if (key === fitKeyRef.current) return;
      const first = fitKeyRef.current === null;
      fitKeyRef.current = key;
      if (!places.length || first) return;
      const bounds = new maplibregl.LngLatBounds([places[0].x, places[0].y], [places[0].x, places[0].y]);
      places.forEach((p) => bounds.extend([p.x, p.y]));
      map.fitBounds(bounds, { padding: 120, maxZoom: 12, duration: 700 });
    };
    if (map.getSource("places")) apply();
    else map.once("load", apply);
  }, [places]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("roads-line")) return;
    map.setPaintProperty("roads-line", "line-opacity", showCondition ? 1 : 0.32);
    const vis = (on: boolean) => (on ? "visible" : "none");
    if (map.getLayer("poi-circles")) map.setLayoutProperty("poi-circles", "visibility", vis(showPois));
    if (map.getLayer("roads-glow")) map.setLayoutProperty("roads-glow", "visibility", vis(showRepairs));
    if (map.getLayer("srti-points")) map.setLayoutProperty("srti-points", "visibility", vis(showSrti));
  }, [showCondition, showPois, showRepairs, showSrti]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Přepnout jen předchozí a nový výběr (dřív se procházelo všech ~4 700 úseků).
    if (map.getSource("roads")) {
      const prev = prevSelectedRef.current;
      if (prev != null && prev !== selectedId) map.setFeatureState({ source: "roads", id: prev }, { selected: false });
      if (selectedId != null) map.setFeatureState({ source: "roads", id: selectedId }, { selected: true });
      prevSelectedRef.current = selectedId;
    }
    if (selectedId) {
      const road = roads.find((r) => r.id === selectedId);
      if (road) {
        const [lng, lat] = midpoint(road);
        map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 11), duration: 600 });
      }
    }
  }, [selectedId, roads]);

  // Náhled úseku pod myší v žebříčku.
  const prevHoverRef = useRef<number | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("roads")) return;
    const prev = prevHoverRef.current;
    if (prev != null && prev !== hoverId) map.setFeatureState({ source: "roads", id: prev }, { hover: false });
    if (hoverId != null) map.setFeatureState({ source: "roads", id: hoverId }, { hover: true });
    prevHoverRef.current = hoverId;
  }, [hoverId]);

  const toggleTilt = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !tilt;
    setTilt(next);
    if (next) {
      map.dragRotate.enable();
      map.touchZoomRotate.enableRotation();
      map.touchPitch.enable();
      map.easeTo({ pitch: 50, duration: 500 });
    } else {
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.touchPitch.disable();
      map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
    }
  };

  const goHome = () => mapRef.current?.flyTo({ ...HOME_VIEW, pitch: tilt ? 50 : 0, duration: 900 });

  return (
    <>
      <div ref={ref} className="map" />
      <div className="map-tools">
        <button
          className={tilt ? "on" : ""}
          onClick={toggleTilt}
          title={tilt ? "Vypnout otáčení a náklon" : "Zapnout otáčení a náklon (pravé tlačítko myši nebo dva prsty)"}
        >
          3D {tilt ? "zap." : "vyp."}
        </button>
        <button onClick={goHome} title="Vrátit mapu na celý kraj">
          ⌂ Celý kraj
        </button>
      </div>
    </>
  );
}

// Při změně režimu se mapa vytvoří znovu (setStyle by smazal naše vrstvy).
export default function MapView(props: Props) {
  return <MapInner key={props.theme} {...props} />;
}
