import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "data");
const BASE = "https://services6.arcgis.com/ogJAiK65nXL1mXAW/arcgis/rest/services";

const LAYERS = {
  roads: ["Stav_povrchu_silnic", 0],
  repairsLine: ["Opravy_silniční_infrastruktury_od_roku_2016_liniové", 0],
  repairsPoint: ["Opravy_silniční_infrastruktury_od_roku_2016_bodové", 0],
  winter: ["Plán_zimní_údržby_silnic", 0],
  busStops: ["Autobusové_zastávky_IREDO", 0],
  busLines: ["Autobusové_linky_VDKHK", 7],
  connections: ["Seznam_zaručených_přípojů", 0],
  hospitals: ["Nemocnice", 0],
  schools: ["Seznam_škol_a_školských_zařízení", 0],
  zzs: ["Výjezdové_základny_zdravotnické_záchranné_služby", 0],
  hzs: ["Stanice_a_pracoviště_hasičského_záchranného_systému", 0],
  police: ["Služebny_Policie_ČR", 0],
  doctors: ["Praktičtí_lékaři_pro_dospělé", 0],
  pediatric: ["Praktičtí_lékaři_pro_děti_a_dorost", 0],
  social: ["Poskytovatelé_sociálních_služeb", 0],
  industry: ["Průmyslové_zóny", 0],
  threatened: ["Hospodářsky_a_sociálně_ohrožené_oblasti", 0],
  railStops: ["Železniční_stanice_a_zastávky_VDKHK", 0],
};

function encodePath(name) {
  return name
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function queryLayer(service, layerId, params) {
  const url = `${BASE}/${encodePath(service)}/FeatureServer/${layerId}/query`;
  const search = new URLSearchParams({
    f: "json",
    outSR: "4326",
    resultRecordCount: "2000",
  });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  }
  const res = await fetch(`${url}?${search}`);
  if (!res.ok) throw new Error(`${service} HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`${service}: ${JSON.stringify(json.error)}`);
  return json;
}

async function fetchAll(service, layerId, extras = {}) {
  const features = [];
  let offset = 0;
  let orderBy = extras.orderByFields ?? "OBJECTID";
  for (;;) {
    let json;
    try {
      json = await queryLayer(service, layerId, {
        where: extras.where ?? "1=1",
        outFields: extras.outFields ?? "*",
        returnGeometry: extras.returnGeometry ?? "true",
        geometryPrecision: extras.geometryPrecision ?? "5",
        maxAllowableOffset: extras.maxAllowableOffset,
        resultOffset: String(offset),
        orderByFields: orderBy,
      });
    } catch (err) {
      if (orderBy) {
        orderBy = "";
        continue;
      }
      throw err;
    }
    const batch = json.features ?? [];
    features.push(...batch);
    process.stdout.write(`  ${service}: ${features.length}\r`);
    if (!json.exceededTransferLimit && batch.length < 2000) break;
    offset += batch.length;
    if (batch.length === 0) break;
  }
  console.log(`  ${service}: ${features.length} záznamů`);
  return features;
}

function lineCoords(geom) {
  if (!geom) return [];
  if (geom.paths) return geom.paths.flat();
  if (geom.rings) {
    const ring = geom.rings[0] ?? [];
    if (!ring.length) return [];
    let x = 0;
    let y = 0;
    for (const p of ring) {
      x += p[0];
      y += p[1];
    }
    return [[x / ring.length, y / ring.length]];
  }
  if (geom.x != null) return [[geom.x, geom.y]];
  return [];
}

function simplify(coords, minStep = 0.00018) {
  if (coords.length <= 3) return coords.map(([x, y]) => [round(x), round(y)]);
  const out = [];
  let last = null;
  for (const [x, y] of coords) {
    if (!last || Math.hypot(x - last[0], y - last[1]) >= minStep) {
      out.push([round(x), round(y)]);
      last = [x, y];
    }
  }
  const end = coords[coords.length - 1];
  const lastOut = out[out.length - 1];
  if (!lastOut || lastOut[0] !== round(end[0]) || lastOut[1] !== round(end[1])) {
    out.push([round(end[0]), round(end[1])]);
  }
  return out.length >= 2 ? out : coords.slice(0, 2).map(([x, y]) => [round(x), round(y)]);
}

function round(n) {
  return Math.round(n * 1e5) / 1e5;
}

function pickName(a, keys) {
  for (const k of keys) {
    if (a[k] && String(a[k]).trim()) return String(a[k]).trim();
  }
  return "Bez názvu";
}

function cellKey(x, y, size = 0.012) {
  return `${Math.floor(x / size)}_${Math.floor(y / size)}`;
}

function buildGrid(points) {
  const grid = new Map();
  for (const p of points) {
    const key = cellKey(p.x, p.y);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(p);
  }
  return grid;
}

function nearby(grid, coords, maxM, kinds = null) {
  const maxDeg = maxM / 111000;
  const found = [];
  const seen = new Set();
  for (const [x, y] of coords) {
    const cx = Math.floor(x / 0.012);
    const cy = Math.floor(y / 0.012);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${cx + dx}_${cy + dy}`);
        if (!bucket) continue;
        for (const p of bucket) {
          if (seen.has(p.id)) continue;
          if (kinds && !kinds.includes(p.kind)) continue;
          const d = haversine(y, x, p.y, p.x);
          if (d <= maxM) {
            seen.add(p.id);
            found.push({ ...p, dist: Math.round(d) });
          }
        }
      }
    }
  }
  found.sort((a, b) => a.dist - b.dist);
  return found;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bbox(coords) {
  let minX = 180;
  let minY = 90;
  let maxX = -180;
  let maxY = -90;
  for (const [x, y] of coords) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log("Stahuji datasety Data KHK…");

  const [
    roadsAllRaw,
    repairsLineRaw,
    repairsPointRaw,
    winterRaw,
    busStopsRaw,
    busLinesRaw,
    connectionsRaw,
    hospitalsRaw,
    schoolsRaw,
    zzsRaw,
    hzsRaw,
    policeRaw,
    doctorsRaw,
    pediatricRaw,
    socialRaw,
    industryRaw,
    threatenedRaw,
    railStopsRaw,
  ] = await Promise.all([
    // Všechny roky měření (2018–2024). Každý úsek se měří v jiném roce,
    // proto se níže bere poslední měření pro každý úsek, ne jen rok 2024.
    fetchAll(...LAYERS.roads, {
      outFields: "OBJECTID,stav_sil,rok,ozn_sil,ozn_usek,ozn_sil_usek,ozn_trida,ozn_kat,delka,nazev_okresu,typ_povrchu",
      maxAllowableOffset: "0.0002",
    }),
    fetchAll(...LAYERS.repairsLine, {
      returnGeometry: "false",
      outFields: "ozn_sil_usek,ozn_sil,rok_real,delka,nazev_okresu",
    }),
    fetchAll(...LAYERS.repairsPoint, {
      outFields: "nazev,oznaceni_silnice,rok_real,zdroj_financi,nazev_obce,nazev_okresu,x,y",
      maxAllowableOffset: "0.0001",
    }),
    fetchAll(...LAYERS.winter, {
      returnGeometry: "false",
      outFields: "ozn_sil,typ_tech,ozn_trida",
    }),
    fetchAll(...LAYERS.busStops, {
      outFields: "nazev,oznaceni,nazev_obce,nazev_okresu,x,y",
    }),
    fetchAll(...LAYERS.busLines, {
      outFields: "OBJECTID,trasa,linka,jizd_rad",
      maxAllowableOffset: "0.00035",
      orderByFields: "OBJECTID",
    }),
    fetchAll(...LAYERS.connections, {
      returnGeometry: "false",
      outFields: "linka,spoj,zastávka,vycka_min,typ,linka_d,z_do_zast,nav_cas,FID",
      orderByFields: "FID",
    }),
    fetchAll(...LAYERS.hospitals, { outFields: "nazev,nazev_obce,nazev_okresu,www,x,y" }),
    fetchAll(...LAYERS.schools, { outFields: "nazev,zarizeni_druh,nazev_obce,nazev_okresu,x,y" }),
    fetchAll(...LAYERS.zzs, { outFields: "vyjezdova_zakladna,oblast,nazev_obce,x,y" }),
    fetchAll(...LAYERS.hzs, { outFields: "druh_pracoviste,typ_stanice,nazev_obce,x,y" }),
    fetchAll(...LAYERS.police, { outFields: "nazev_obvodu,nazev_obce,x,y" }),
    fetchAll(...LAYERS.doctors, { outFields: "provozovatel,nazev_obce,x,y" }),
    fetchAll(...LAYERS.pediatric, { outFields: "provozovatel,nazev_obce,x,y" }),
    fetchAll(...LAYERS.social, { outFields: "nazev_zarizeni,typ_soc_sluzby,nazev_obce,x,y" }),
    fetchAll(...LAYERS.industry, { outFields: "nazev,nazev_obce,x,y" }),
    fetchAll(...LAYERS.threatened, {
      returnGeometry: "false",
      outFields: "nazev_obce,urov_ohr,hsoo",
    }),
    fetchAll(...LAYERS.railStops, { outFields: "nazev,nazev_obce,x,y" }),
  ]);

  // Historie stavu po úsecích. Úsek má v jednom roce víc částí s různým stavem,
  // proto se za rok bere stav s největší délkou (dřív se hodnoty přepisovaly).
  const lengthByYear = {};
  const latestYear = {};
  for (const f of roadsAllRaw) {
    const a = f.attributes;
    const key = a.ozn_sil_usek;
    const year = Number(a.rok);
    if (!key || !year || !a.stav_sil) continue;
    latestYear[key] = Math.max(latestYear[key] ?? 0, year);
    const byYear = (lengthByYear[key] ??= {});
    const byStav = (byYear[year] ??= {});
    byStav[a.stav_sil] = (byStav[a.stav_sil] || 0) + (Number(a.delka) || 0);
  }
  const history = {};
  for (const [key, byYear] of Object.entries(lengthByYear)) {
    history[key] = {};
    for (const [year, byStav] of Object.entries(byYear)) {
      history[key][year] = Object.entries(byStav).sort((x, y) => y[1] - x[1])[0][0];
    }
  }
  const roadsRaw = roadsAllRaw.filter((f) => {
    const a = f.attributes;
    return a.ozn_sil_usek && Number(a.rok) === latestYear[a.ozn_sil_usek];
  });
  const measuredYears = Object.values(latestYear);
  const yearFrom = Math.min(...measuredYears);
  const yearTo = Math.max(...measuredYears);

  const lastRepair = {};
  for (const f of repairsLineRaw) {
    const a = f.attributes;
    const key = a.ozn_sil_usek;
    const year = Number(a.rok_real);
    if (!key || !year) continue;
    lastRepair[key] = Math.max(lastRepair[key] ?? 0, year);
  }

  const winter = {};
  for (const f of winterRaw) {
    const a = f.attributes;
    const key = String(a.ozn_sil ?? "").replace(/^0+/, "");
    if (!key) continue;
    winter[key] = a.typ_tech;
  }

  const threatened = {};
  for (const f of threatenedRaw) {
    const a = f.attributes;
    // Jen obce, které dataset skutečně označuje jako ohrožené (hsoo = "ano").
    if (a.nazev_obce && String(a.hsoo).trim() === "ano") {
      threatened[a.nazev_obce] = String(a.urov_ohr || "").trim() || "ohrožená oblast";
    }
  }

  const pois = [];
  const addPoi = (raw, kind, nameKeys, extraKeys = []) => {
    for (const f of raw) {
      const a = f.attributes;
      const coords = lineCoords(f.geometry);
      const pt = coords[0];
      const x = a.x ?? pt?.[0];
      const y = a.y ?? pt?.[1];
      if (x == null || y == null) continue;
      const extra = extraKeys.map((k) => a[k]).filter(Boolean).join(" · ");
      pois.push({
        id: `${kind}-${a.OBJECTID ?? a.dp_id ?? pois.length}`,
        name: pickName(a, nameKeys),
        kind,
        extra,
        obec: a.nazev_obce || a.oblast || "",
        x: round(Number(x)),
        y: round(Number(y)),
      });
    }
  };

  addPoi(hospitalsRaw, "hospital", ["nazev"]);
  addPoi(schoolsRaw, "school", ["nazev"], ["zarizeni_druh"]);
  addPoi(zzsRaw, "zzs", ["vyjezdova_zakladna", "oblast"]);
  addPoi(hzsRaw, "hzs", ["druh_pracoviste"]);
  addPoi(policeRaw, "police", ["nazev_obvodu"]);
  addPoi(doctorsRaw, "doctor", ["provozovatel"]);
  addPoi(pediatricRaw, "pediatric", ["provozovatel"]);
  addPoi(socialRaw, "social", ["nazev_zarizeni"], ["typ_soc_sluzby"]);
  addPoi(industryRaw, "industry", ["nazev"]);
  addPoi(railStopsRaw, "rail", ["nazev"]);
  addPoi(busStopsRaw, "stop", ["nazev"]);

  const poiGrid = buildGrid(pois);

  const lines = busLinesRaw.map((f) => {
    const a = f.attributes;
    const g = simplify(lineCoords(f.geometry), 0.0004);
    return {
      id: a.OBJECTID,
      linka: a.linka,
      trasa: a.trasa,
      jr: a.jizd_rad,
      g,
    };
  }).filter((l) => l.g.length >= 2);

  const linePoints = [];
  for (const line of lines) {
    for (const [x, y] of line.g) {
      linePoints.push({ id: line.id, x, y, kind: "line", name: line.linka, extra: line.trasa });
    }
  }
  const lineGrid = buildGrid(linePoints);

  // T11 (15. 10.): bod se počítá jen k nejbližším úsekům. Dřív se škola nebo nemocnice
  // započítala ke každému úseku do 450 m (na křižovatce i k pěti úsekům naráz).
  // Teď jen k úsekům, které jsou od bodu nejvýš o NEAR_SLACK_M dál než ten nejbližší.
  const NEAR_SLACK_M = 50;
  const prepared = [];
  const minDist = new Map();
  for (const f of roadsRaw) {
    const g = simplify(lineCoords(f.geometry));
    if (g.length < 2) continue;
    const near = nearby(poiGrid, g, 450);
    for (const p of near) {
      if (!minDist.has(p.id) || p.dist < minDist.get(p.id)) minDist.set(p.id, p.dist);
    }
    prepared.push({ f, g, near });
  }

  const roads = [];
  for (const { f, g, near: nearAll } of prepared) {
    const a = f.attributes;
    const hist = history[a.ozn_sil_usek] || {};
    const years = Object.keys(hist).sort();
    let worse = false;
    if (years.length >= 2) {
      const order = ["výborný", "dobrý", "vyhovující", "nevyhovující", "havarijní", "SUPERhavarijní"];
      const prev = hist[years[years.length - 2]];
      const curr = hist[years[years.length - 1]];
      worse = order.indexOf(curr) > order.indexOf(prev);
    }
    const obce = [...new Set(nearAll.map((p) => p.obec).filter(Boolean))];
    const near = nearAll.filter((p) => p.dist <= minDist.get(p.id) + NEAR_SLACK_M);
    const hsoo = obce.filter((o) => threatened[o]);
    const counts = {};
    const samples = {};
    for (const p of near) {
      counts[p.kind] = (counts[p.kind] || 0) + 1;
      if (!samples[p.kind]) samples[p.kind] = [];
      if (samples[p.kind].length < 6) samples[p.kind].push({ name: p.name, dist: p.dist, obec: p.obec, extra: p.extra });
    }
    const nearLines = nearby(lineGrid, g, 120, ["line"]);
    const uniqueLines = [];
    const seenL = new Set();
    for (const p of nearLines) {
      if (seenL.has(p.id)) continue;
      seenL.add(p.id);
      const line = lines.find((l) => l.id === p.id);
      if (line) uniqueLines.push({ linka: line.linka, trasa: line.trasa, jr: line.jr });
    }

    const silKey = String(a.ozn_sil ?? "").replace(/^0+/, "");
    roads.push({
      id: a.OBJECTID,
      usek: a.ozn_sil_usek,
      sil: a.ozn_sil,
      trida: a.ozn_trida,
      kat: a.ozn_kat,
      okres: a.nazev_okresu,
      delka: a.delka,
      povrch: a.typ_povrchu,
      stav: a.stav_sil,
      rok: Number(a.rok),
      hist,
      worse,
      lastRepair: lastRepair[a.ozn_sil_usek] || null,
      winter: winter[silKey] || null,
      obce: obce.slice(0, 6),
      hsoo,
      counts,
      samples,
      lines: uniqueLines.slice(0, 8),
      g,
      b: bbox(g),
    });
  }

  const connections = connectionsRaw.map((f) => {
    const a = f.attributes;
    return {
      stop: a["zastávka"],
      line: a.linka,
      wait: a.vycka_min,
      toLine: a.linka_d,
      toStop: a.z_do_zast,
      type: a.typ,
      time: a.nav_cas,
    };
  }).filter((c) => c.stop && c.line);

  const pointRepairs = repairsPointRaw.map((f) => {
    const a = f.attributes;
    const coords = lineCoords(f.geometry);
    const pt = coords[0];
    return {
      name: a.nazev,
      sil: a.oznaceni_silnice,
      year: Number(a.rok_real),
      money: a.zdroj_financi,
      obec: a.nazev_obce,
      okres: a.nazev_okresu,
      x: round(a.x ?? pt?.[0]),
      y: round(a.y ?? pt?.[1]),
    };
  }).filter((p) => p.x && p.y);

  // Jedna ukázková oprava na silnici, ať se v seznamu neopakuje stejná silnice.
  const onePerRoad = (list) => {
    const seen = new Set();
    return list.filter((r) => (seen.has(r.sil) ? false : seen.add(r.sil)));
  };
  const rankedPreview = onePerRoad([...roads].sort((a, b) => score(b) - score(a)));
  const repairs = [];
  // Plánované a probíhající opravy v otevřených datech kraje nejsou.
  // Tyto záznamy jsou SIMULACE pro ukázku a v aplikaci se tak i zobrazují.
  const now = new Date();
  const lastRepairYear = Math.max(0, ...Object.values(lastRepair));
  rankedPreview.slice(0, 6).forEach((r, i) => {
    repairs.push({
      id: `plan-${r.id}`,
      roadId: r.id,
      usek: r.usek,
      sil: r.sil,
      title: `Oprava ${formatSil(r.sil)}`,
      status: "planned",
      from: iso(addDays(now, 20 + i * 14)),
      to: iso(addDays(now, 34 + i * 14)),
      restriction: i % 2 === 0 ? "úplná uzavírka" : "kyvadlový provoz",
      note: "Simulace: návrh podle skóre priority. Plánované opravy kraj jako otevřená data nezveřejňuje.",
      simulated: true,
    });
  });
  rankedPreview.slice(6, 10).forEach((r, i) => {
    repairs.push({
      id: `now-${r.id}`,
      roadId: r.id,
      usek: r.usek,
      sil: r.sil,
      title: `Oprava ${formatSil(r.sil)}`,
      status: "active",
      from: iso(addDays(now, -10 + i)),
      to: iso(addDays(now, 12 + i * 3)),
      restriction: "částečné omezení",
      note: "Simulace: ukázka probíhající opravy, ne skutečná stavba.",
      simulated: true,
    });
  });
  rankedPreview.filter((r) => r.lastRepair === lastRepairYear).slice(0, 8).forEach((r) => {
    repairs.push({
      id: `done-${r.id}`,
      roadId: r.id,
      usek: r.usek,
      sil: r.sil,
      title: `Dokončená oprava ${formatSil(r.sil)}`,
      status: "done",
      from: `${lastRepairYear}-01-01`,
      to: `${lastRepairYear}-12-31`,
      restriction: "bez omezení",
      note: `Skutečná oprava z otevřených dat kraje (rok realizace ${lastRepairYear}, přesné datum v datech není).`,
      simulated: false,
    });
  });

  const stats = {
    roads: roads.length,
    km: Math.round(roads.reduce((s, r) => s + (r.delka || 0), 0) / 1000),
    byStav: {},
    pois: pois.length,
    stops: pois.filter((p) => p.kind === "stop").length,
    schools: pois.filter((p) => p.kind === "school").length,
    hospitals: pois.filter((p) => p.kind === "hospital").length,
    lines: lines.length,
    connections: connections.length,
    updated: `${yearFrom}–${yearTo}`,
    useky: Object.keys(latestYear).length,
  };
  for (const r of roads) stats.byStav[r.stav] = (stats.byStav[r.stav] || 0) + 1;

  const slimPois = pois.filter((p) => p.kind !== "stop" && p.kind !== "doctor");
  const stops = pois.filter((p) => p.kind === "stop").map((p) => ({
    id: p.id,
    name: p.name,
    obec: p.obec,
    x: p.x,
    y: p.y,
  }));
  const doctors = pois.filter((p) => p.kind === "doctor" || p.kind === "pediatric").map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    obec: p.obec,
    x: p.x,
    y: p.y,
  }));

  await writeFile(join(OUT, "roads.json"), JSON.stringify({ stats, roads }));
  await writeFile(join(OUT, "pois.json"), JSON.stringify({ pois: slimPois, doctors, threatened }));
  await writeFile(join(OUT, "transit.json"), JSON.stringify({ lines, stops, connections, pointRepairs }));
  await writeFile(join(OUT, "repairs.json"), JSON.stringify({ repairs }));

  const sizes = {};
  for (const name of ["roads.json", "pois.json", "transit.json", "repairs.json"]) {
    const { size } = await import("node:fs").then((fs) => fs.promises.stat(join(OUT, name)));
    sizes[name] = `${Math.round(size / 1024)} kB`;
  }
  console.log("Hotovo", sizes, "silnic", roads.length, "POI", pois.length);
}

function score(r) {
  const stav = { SUPERhavarijní: 100, havarijní: 82, nevyhovující: 58, vyhovující: 28, dobrý: 12, výborný: 4 }[r.stav] || 20;
  const c = r.counts || {};
  return (
    stav +
    (r.worse ? 12 : 0) +
    (r.trida?.includes("2") ? 8 : 0) +
    (c.school || 0) * 3 +
    (c.hospital || 0) * 8 +
    (c.zzs || 0) * 6 +
    (c.stop || 0) +
    (c.industry || 0) * 4
  );
}

function formatSil(sil) {
  const s = String(sil || "").replace(/^0+/, "");
  return s.length <= 3 ? `II/${s}` : `III/${s}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function iso(d) {
  return d.toISOString().slice(0, 10);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
