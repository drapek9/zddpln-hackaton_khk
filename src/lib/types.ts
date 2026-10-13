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
  hist: Record<string, string>;
  worse: boolean;
  lastRepair: number | null;
  winter: string | null;
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
  age: number;
};

export type Dataset = {
  roads: Road[];
  stats: {
    roads: number;
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
  schools: 80,
  hospitals: 95,
  rescue: 90,
  transit: 75,
  industry: 45,
  age: 50,
};
