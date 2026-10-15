// Otevřená data, ze kterých aplikace vychází (pravidla soutěže 5.2 b, 7.3).
// Odkaz vede na stránku datové sady v katalogu Data KHK (ArcGIS Hub).

export type Source = {
  name: string;
  itemId: string;
  layer: number;
  use: string;
};

export const SOURCES: Source[] = [
  { name: "Stav povrchu silnic", itemId: "311df195461541069a5690e9491eb092", layer: 0, use: "Základ skóre, historie stavu, poslední měření úseku" },
  { name: "Opravy silniční infrastruktury od roku 2016 – liniové", itemId: "229c0cb29b2e4838ac7ff4190c075d7c", layer: 0, use: "Rok poslední opravy, dokončené opravy" },
  { name: "Opravy silniční infrastruktury od roku 2016 – bodové", itemId: "e60773d598b14909b749f5e0be403ef1", layer: 0, use: "Opravy mostů a bodových míst" },
  { name: "Plán zimní údržby silnic", itemId: "4973fa51384f4e7ca5db80e4d9496f03", layer: 0, use: "Kolize opravy se zimní údržbou" },
  { name: "Autobusové zastávky IREDO", itemId: "ab928607832141f8bebb36261593107a", layer: 0, use: "Zastávky podél úseku, zaručené přípoje" },
  { name: "Autobusové linky VDKHK", itemId: "ebc0da36c2bd4fdb9505ddab8b789007", layer: 7, use: "Linky na úseku, „Můj autobus“" },
  { name: "Seznam zaručených přípojů", itemId: "0575292a366649d19580a2389c55fced", layer: 0, use: "Přípoje, které uzavírka ohrozí" },
  { name: "Železniční stanice a zastávky VDKHK", itemId: "e64c92bd463e442593e695137e061a35", layer: 0, use: "Návaznost na vlak" },
  { name: "Nemocnice", itemId: "590ec69b85e4495a9016c827607fc21f", layer: 0, use: "Faktor zdravotnictví, dopady uzavírky" },
  { name: "Praktičtí lékaři pro dospělé", itemId: "5f3f1b9709db4a0b95f04fb0582f232a", layer: 0, use: "Faktor zdravotnictví" },
  { name: "Praktičtí lékaři pro děti a dorost", itemId: "a3e7a755cf8840eeb377cb650609c2ac", layer: 0, use: "Faktor zdravotnictví" },
  { name: "Výjezdové základny zdravotnické záchranné služby", itemId: "1c28da5d644445d3a5f4b578ce22ed40", layer: 0, use: "Faktor IZS" },
  { name: "Stanice a pracoviště hasičského záchranného sboru", itemId: "3ff2f49c7f454870baf51628403ace6e", layer: 0, use: "Faktor IZS" },
  { name: "Služebny Policie ČR", itemId: "042d4ed225654f6b9c1f2b5036887e1e", layer: 0, use: "Faktor IZS" },
  { name: "Seznam škol a školských zařízení", itemId: "fc365d95ea124c6fb18540f5e5a2eef1", layer: 0, use: "Faktor školy, termín ve školním roce" },
  { name: "Poskytovatelé sociálních služeb", itemId: "0a65793445574552b78e7f1f0761ba13", layer: 0, use: "Faktor zdravotnictví a sociální péče" },
  { name: "Průmyslové zóny", itemId: "10547be46d01470186fe5d8d1a8ca758", layer: 0, use: "Faktor nákladní dopravy" },
  { name: "Hospodářsky a sociálně ohrožené oblasti", itemId: "2b8f4c0b14934ab5ad6f9d88af314808", layer: 0, use: "Faktor ohrožených oblastí (HSOO)" },
  { name: "Hranice Královéhradeckého kraje", itemId: "f8a73250419c48f6a8118cfed2720566", layer: 0, use: "Obrys kraje na mapě, okolí kraje je šedé (CC0)" },
];

export function sourceUrl(s: Source) {
  return `https://www.datakhk.cz/datasets/${s.itemId}_${s.layer}`;
}

// Externí data mimo Data KHK (licence uvádíme podle čl. 7.3 pravidel).
export type ExternalSource = {
  name: string;
  publisher: string;
  url: string;
  license: string;
  use: string;
  status: "používáme" | "připravujeme";
};

export const EXTERNAL_SOURCES: ExternalSource[] = [
  {
    name: "Silnice I. třídy a dálnice",
    publisher: "© přispěvatelé OpenStreetMap",
    url: "https://www.openstreetmap.org/copyright",
    license: "ODbL 1.0",
    use: "Doplnění grafu silnic pro výpočet objížďek a tras",
    status: "používáme",
  },
  {
    name: "Podkladová mapa",
    publisher: "CARTO, data © přispěvatelé OpenStreetMap",
    url: "https://carto.com/attributions",
    license: "ODbL 1.0 (data), CARTO (styl)",
    use: "Mapový podklad",
    status: "používáme",
  },
  {
    name: "Celostátní sčítání dopravy 2025",
    publisher: "Ředitelství silnic a dálnic ČR",
    url: "https://www.rsd.cz/silnice-a-dalnice/scitani-dopravy",
    license: "CC BY-SA 4.0",
    use: "Aut za den na úseku a na objížďce (zbytek sítě odhad)",
    status: "připravujeme",
  },
  {
    name: "Silniční a dálniční informace (SRTI)",
    publisher: "Ředitelství silnic a dálnic ČR",
    url: "https://data.gov.cz/datová-sada?iri=https://data.gov.cz/zdroj/datové-sady/65993390/1087749998",
    license: "CC BY 4.0",
    use: "Skutečné uzavírky a stavby na mapě",
    status: "připravujeme",
  },
  {
    name: "Faktory ovlivňující náklady na údržbu a opravy silnic nižších tříd",
    publisher: "Centrum dopravního výzkumu (CDV)",
    url: "https://www.cdv.cz/file/vav-faktory-ovlivnujici-naklady-na-udrzbu-a-opravy/",
    license: "citace (výzkumná zpráva)",
    use: "Předpoklad ceny opravy za km v plánu podle rozpočtu",
    status: "používáme",
  },
  {
    name: "Zakázka III/28711 (1,1 km za 12,5 mil. Kč)",
    publisher: "Liberecký kraj (zpráva Liberecká Drbna)",
    url: "https://liberecka.drbna.cz/zpravy/doprava/42668-kraj-opravi-tri-silnice-za-88-milionu-docka-se-bily-kostel-i-rychnov.html",
    license: "citace",
    use: "Kontrola ceny havarijní opravy za km",
    status: "používáme",
  },
];

// Další sady Data KHK z plánu (PLAN_FINAL.md, kap. 13). Odkaz vede na vyhledávání v katalogu.
export const PLANNED_KHK_SOURCES: { name: string; query: string; use: string }[] = [
  { name: "Dojížďka do středních škol", query: "Dojížďka do středních škol", use: "Počet středoškoláků denně na úseku a na uzavírce" },
  { name: "Obce", query: "Obce", use: "Odříznuté obce a počet obyvatel při uzavírce" },
  { name: "Záplavová území Q5, Q20, Q100", query: "Záplavové území", use: "Povodňový scénář: zatopené silnice a odříznuté obce" },
  { name: "Plánované opravy silniční infrastruktury 2022 – liniové", query: "Plánované opravy silniční infrastruktury", use: "Skutečné uzavírky jako ukázky a ověření modelu" },
];

export function searchUrl(query: string) {
  return `https://www.datakhk.cz/search?q=${encodeURIComponent(query)}`;
}
