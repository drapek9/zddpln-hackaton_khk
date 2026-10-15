import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import type { Poi, Repair, Road, Stop } from "../lib/types";
import { KIND_COLOR, STAV_COLOR, midpoint } from "../lib/geo";

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
      paint: { "fill-color": dark ? "#05080c" : "#8a8f96", "fill-opacity": dark ? 0.4 : 0.26 },
    },
    before,
  );
  map.addLayer(
    {
      id: "kraj-line",
      type: "line",
      source: "kraj",
      layout: { "line-join": "round" },
      paint: { "line-color": dark ? "#94a3b8" : "#475569", "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.4, 12, 2.4], "line-opacity": 0.9 },
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
export const HIGHLIGHT_COLOR: Record<MapTheme, string> = { dark: "#2bb3b1", light: "#0e7c7b", office: "#0e7c7b" };

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
  const highlightRef = useRef(highlight);
  highlightRef.current = highlight;
  const placesRef = useRef(places);
  placesRef.current = places;
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
      loadKraj().then((rings) => rings && mapRef.current === map && addKraj(map, rings, theme === "dark"));
      map.addSource("pois", { type: "geojson", data: pointsToGeo(pois) });
      map.addSource("stops", { type: "geojson", data: pointsToGeo(stops.map((s) => ({ ...s, kind: "stop" }))) });

      map.addLayer({
        id: "roads-glow",
        type: "line",
        source: "roads",
        paint: {
          "line-color": [
            "match",
            ["get", "repair"],
            "active",
            "#38bdf8",
            "planned",
            "#fbbf24",
            "done",
            "#34d399",
            "#94a3b8",
          ],
          "line-width": 6,
          "line-opacity": ["case", ["==", ["get", "repair"], ""], 0, 0.45],
        },
      }, labels);
      map.addLayer({
        id: "roads-line",
        type: "line",
        source: "roads",
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
          ],
          "line-opacity": showConditionRef.current ? 0.95 : 0.18,
        },
      }, labels);
      // Neviditelná široká čára jen pro klik a najetí: trefit tenkou silnici prstem je jinak těžké.
      map.addLayer({
        id: "roads-hit",
        type: "line",
        source: "roads",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#000",
          "line-opacity": 0,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 14, 12, 22],
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
            "line-width": ["interpolate", ["linear"], ["zoom"], 7, 4, 12, 10],
            "line-opacity": 0.85,
          },
        },
        "roads-line",
      );
      // Právě probíhající uzavírky ŘSD (SRTI, CC BY 4.0). Při chybě backendu se vrstva nezobrazí.
      map.addSource("srti", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "srti-points",
        type: "circle",
        source: "srti",
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
      map.addLayer({
        id: "detour-casing",
        type: "line",
        source: "detour",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#0b1220", "line-width": 8, "line-opacity": 0.6 },
      }, labels);
      map.addLayer({
        id: "detour-line",
        type: "line",
        source: "detour",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#a78bfa", "line-width": 4, "line-dasharray": [1.5, 1] },
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
      map.on("click", (e) => {
        const id = nearestRoad(e.point);
        onSelectRef.current(id != null ? Number(id) : null, e.lngLat);
      });
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
      if (!places.length) return;
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
    map.setPaintProperty("roads-line", "line-opacity", showCondition ? 0.95 : 0.18);
    if (map.getLayer("poi-circles")) {
      map.setLayoutProperty("poi-circles", "visibility", showPois ? "visible" : "none");
    }
  }, [showCondition, showPois]);

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
