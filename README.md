# Cesty KHK

Webová aplikace nad otevřenými daty Královéhradeckého kraje. Kraj opravuje zhruba 90 km silnic ročně, havarijních je 1 375 km. Cesty KHK ukazují, co opravit dřív, jak uzavřít silnici s nejmenší škodou a jak se o tom dozvědí lidé.

Hackathon KHK 2026.

## Co aplikace umí

- **Úředník:** žebříček úseků II. a III. třídy podle priority, váhy skóre, připíchnutí s důvodem, simulace uzavírky (objížďka, auta za den, studenti, odříznuté obce, dojezd ZZS a HZS), návrh oznámení a rozpočtový scénář.
- **Občan:** moje trasa domov–práce/škola, upozornění na uzavírku na trase, hlášení výtluků, hlasování o úseku.
- **Admin:** trvalé váhy skóre, uživatelé a role, audit změn, export.
- **Veřejnost:** mapa oprav a uzavírek, Zdroje dat, otevřené API a export CSV, GeoJSON a metadata DCAT‑AP‑CZ.

Skóre je deterministické. AI jen vysvětluje a navrhuje, rozhoduje člověk. Odhady jsou v aplikaci označené štítkem `estimate` a simulace štítkem „simulace“.

## Spuštění

Potřebujete Node.js a [uv](https://docs.astral.sh/uv/).

Backend (FastAPI, SQLite):

```bash
cp .env.example .env
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Frontend (v druhém terminálu, Vite přesměruje `/api` na backend):

```bash
npm install
npm run dev
```

Před prvním startem vyplň v `.env` v kořeni repa hesla `CESTY_SEED_ADMIN_PASSWORD`, `CESTY_SEED_OFFICIAL_PASSWORD` a `CESTY_SEED_CITIZEN_PASSWORD`. Když chybí, server je vypíše jen při založení prázdné databáze.

Otevřete [http://localhost:5173](http://localhost:5173). API dokumentace běží na `http://localhost:8000/docs`.

Testy a build:

```bash
cd backend
uv run pytest
cd ..
npm run build
```

Při prvním startu backend založí demo účty (úředník, admin, dva občané). Jejich hesla nejsou v repu: jsou v `.env` (`CESTY_SEED_*_PASSWORD`), `start-server.command` je při prvním spuštění vygeneruje.

## Konfigurace

Všechna tajemství patří jen do `.env`, ten je v `.gitignore`. Šablona `.env.example` obsahuje jen prázdné nebo zástupné hodnoty. Klíče pro AI a Web Push (VAPID) jsou volitelné; bez nich aplikace běží, jen bez těchto funkcí.

## Zdroje dat

| Zdroj | Licence | Použití |
|---|---|---|
| Data KHK (datakhk.cz): stav povrchu, opravy 2016+, plán oprav 2022, zastávky, linky, nemocnice, školy, IZS, záplavy, obce, hranice kraje | dle datové sady na Data KHK | stav a priorita úseků, dopady, dojezd, povodně |
| Sčítání dopravy ŘSD 2025 | CC BY‑SA | počet vozidel na úseku (měřeno jen na části sítě, zbytek `odhad`) |
| SRTI, ŘSD / NDIC | CC BY 4.0 | aktuální uzavírky v kraji |
| OpenStreetMap | ODbL | silniční graf pro objížďky |

Úplný seznam s odkazy na datové sady je v aplikaci na stránce **Zdroje dat**, zdroj kódu: [src/lib/sources.ts](src/lib/sources.ts).

## Struktura

- `src/` — frontend (React, Vite, MapLibre).
- `backend/app/core/` — doménová logika: načítání dat, skóre, třídy, graf silnic, objížďka, dopady, rozpočet.
- `backend/app/api/`, `db/`, `auth/`, `notify/`, `ai/` — FastAPI, SQLite, role, audit, upozornění, AI.
- `scripts/` — datová pipeline, která připraví snímek v `public/data/`.
- `docs/` — plány a rozdělení práce (česky).

## Poctivost

- Objížďka se počítá jednou nejrychlejší trasou po silnicích I. třídy, dálnicích a silnicích II. a III. třídy z grafu. Model neumí místní ulice a ukazuje jen jednu variantu.
- Dojezd ZZS a HZS je odhad z vzdálenosti, ne z reálného provozu.
- Plán oprav 2022 je skutečný plán kraje; aktuální stav oprav v datech kraje není.

Licence kódu: [EUPL‑1.2](LICENSE).
