export type RoadSample = {
  name: string;
  dist: number;
  obec: string;
  extra: string;
};

export type RoadLine = {
  linka: string;
  trasa: string;
  jr: string;
};

export type Road = {
  id: number;
  usek: string;
  sil: string;
  trida: string;
  kat: string;
  okres: string;
  delka: number;
  povrch: string;
  stav: string;
  /** Rok posledního měření stavu úseku (2017–2024). */
  rok: number;
  hist: Record<string, string>;
  worse: boolean;
  lastRepair: number | null;
  winter: string | null;
  /** Obce v okolí úseku (podle bodů zájmu do 450 m). */
  obce: string[];
  /** Obce v okolí, které jsou hospodářsky a sociálně ohrožené. */
  hsoo: string[];
  counts: Record<string, number>;
  samples: Record<string, RoadSample[]>;
  lines: RoadLine[];
  g: [number, number][];
  b: [number, number, number, number];
};

export type Poi = {
  id: string;
  name: string;
  kind: string;
  extra?: string;
  obec: string;
  x: number;
  y: number;
};

export type Stop = {
  id: string;
  name: string;
  obec: string;
  x: number;
  y: number;
};

export type BusLine = {
  id: number;
  linka: string;
  trasa: string;
  jr: string;
  g: [number, number][];
};

export type Connection = {
  stop: string;
  line: string;
  wait: string;
  toLine: string;
  toStop: string;
  type: string;
  time: string;
};

export type RepairStatus = "planned" | "active" | "done";

export type Repair = {
  id: string;
  roadId: number;
  usek: string;
  sil: string;
  title: string;
  status: RepairStatus;
  from: string;
  to: string;
  restriction: string;
  note: string;
  /** true = ukázková oprava, která v otevřených datech kraje není. */
  simulated?: boolean;
};

export type Report = {
  id: string;
  name: string;
  note: string;
  obec: string;
  created: string;
  x: number;
  y: number;
};

export type Weights = {
  stav: number;
  worse: number;
  trida: number;
  schools: number;
  hospitals: number;
  rescue: number;
  transit: number;
  industry: number;
  social: number;
  age: number;
  /** D6 (T20): vozidla za den, délka objížďky, studenti. Počítá jen server, lokální výpočet je ignoruje. */
  intensity: number;
  detour: number;
  students: number;
  /** Hlasy občanů (slabý faktor, jen server). */
  votes: number;
};

export type Dataset = {
  roads: Road[];
  stats: {
    roads: number;
    useky: number;
    km: number;
    byStav: Record<string, number>;
    pois: number;
    stops: number;
    schools: number;
    hospitals: number;
    lines: number;
    connections: number;
    updated: string;
  };
  pois: Poi[];
  doctors: Poi[];
  threatened: Record<string, string>;
  lines: BusLine[];
  stops: Stop[];
  connections: Connection[];
  pointRepairs: {
    name: string;
    sil: string;
    year: number;
    money: string;
    obec: string;
    okres: string;
    x: number;
    y: number;
  }[];
};

export const DEFAULT_WEIGHTS: Weights = {
  stav: 100,
  worse: 70,
  trida: 55,
  schools: 50,
  hospitals: 95,
  rescue: 90,
  transit: 75,
  industry: 45,
  social: 40,
  age: 50,
  intensity: 0,
  detour: 0,
  students: 0,
  votes: 0,
};

/** Váhy, které umí jen výpočet na serveru (D6). */
export const SERVER_ONLY_WEIGHTS: (keyof Weights)[] = ["intensity", "detour", "students", "votes"];

/**
 * Předvolby vah pro režim „Jednoduché“ (kap. 25.2). Jsou jen v prohlížeči, ne z kraje:
 * výchozí jsou vždy váhy kraje, předvolba je jen rychlý start pro úředníka.
 */
export const WEIGHT_PRESETS: { key: string; label: string; hint: string; weights: Partial<Weights> }[] = [
  {
    key: "stav",
    label: "Hlavně stav silnice",
    hint: "Nejhorší povrch a zhoršování první.",
    weights: { stav: 100, worse: 90, trida: 40, schools: 30, hospitals: 30, rescue: 30, transit: 30, industry: 20, social: 20, age: 80, intensity: 0, detour: 0, students: 0 },
  },
  {
    key: "zachranka",
    label: "Záchranka a nemocnice",
    hint: "Úseky ke zdravotnictví a IZS.",
    weights: { stav: 70, worse: 50, trida: 40, schools: 40, hospitals: 100, rescue: 100, transit: 40, industry: 20, social: 40, age: 40, intensity: 20, detour: 60, students: 0 },
  },
  {
    key: "lide",
    label: "Školy a autobusy",
    hint: "Kudy jezdí děti, studenti a linky.",
    weights: { stav: 70, worse: 50, trida: 40, schools: 100, hospitals: 50, rescue: 40, transit: 100, industry: 20, social: 60, age: 40, intensity: 30, detour: 30, students: 90 },
  },
  {
    key: "provoz",
    label: "Hustý provoz",
    hint: "Hodně aut a dlouhá objížďka.",
    weights: { stav: 70, worse: 50, trida: 90, schools: 30, hospitals: 40, rescue: 40, transit: 50, industry: 70, social: 20, age: 30, intensity: 100, detour: 90, students: 20 },
  },
];
