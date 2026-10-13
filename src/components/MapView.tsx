import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import type { Poi, Repair, Road, Stop } from "../lib/types";
import { KIND_COLOR, STAV_COLOR, midpoint } from "../lib/geo";

type Props = {
  roads: Road[];
  repairs: Repair[];
  selectedId: number | null;
  onSelect: (id: number | null, lngLat?: { lng: number; lat: number }) => void;
  theme: "dark" | "light";
  showCondition: boolean;
  pois?: Poi[];
  stops?: Stop[];
  showPois?: boolean;
};

const STYLES = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
};

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

export default function MapView({
  roads,
  repairs,
  selectedId,
  onSelect,
  theme,
  showCondition,
  pois = [],
  stops = [],
  showPois = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLES[theme],
      center: [15.83, 50.35],
      zoom: 8.4,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("roads", { type: "geojson", data: roadsToGeo(roads, repairs), promoteId: "id" });
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
      });
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
            ["case", ["boolean", ["feature-state", "selected"], false], 3.5, 1.2],
            12,
            ["case", ["boolean", ["feature-state", "selected"], false], 8, 3.2],
          ],
          "line-opacity": 0.95,
        },
      });
      map.addLayer({
        id: "poi-circles",
        type: "circle",
        source: "pois",
        minzoom: 9,
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

      map.on("click", "roads-line", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id != null) onSelectRef.current(Number(id));
      });
      map.on("click", (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: ["roads-line"] });
        if (!hits.length) onSelectRef.current(null, e.lngLat);
      });
      map.on("mouseenter", "roads-line", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "roads-line", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    return () => {
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
    if (!map?.getLayer("roads-line")) return;
    map.setPaintProperty("roads-line", "line-opacity", showCondition ? 0.95 : 0.18);
    if (map.getLayer("poi-circles")) {
      map.setLayoutProperty("poi-circles", "visibility", showPois ? "visible" : "none");
    }
  }, [showCondition, showPois]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    roads.forEach((r) => {
      try {
        map.setFeatureState({ source: "roads", id: r.id }, { selected: r.id === selectedId });
      } catch {
        /* source may not be ready */
      }
    });
    if (selectedId) {
      const road = roads.find((r) => r.id === selectedId);
      if (road) {
        const [lng, lat] = midpoint(road);
        map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 11), duration: 600 });
      }
    }
  }, [selectedId, roads]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = map.getStyle()?.sprite;
    if (theme === "dark" && String(current || "").includes("voyager")) {
      map.setStyle(STYLES.dark);
    }
    if (theme === "light" && String(current || "").includes("dark")) {
      map.setStyle(STYLES.light);
    }
  }, [theme]);

  return <div ref={ref} className="map" />;
}
