# Backend a logika: rozdělení Tomáš × Šimon

Navazuje na [PLAN_FINAL.md](../PLAN_FINAL.md).

Rozdělení týmu:
- **Tomáš a Šimon:** logika a backend.
- **Matouš:** frontend a design.
- **Přemek:** review designu.

Sdílená pravidla pro AI agenty (Cursor i Claude Code) jsou v [AGENTS.md](../AGENTS.md).

---

## 1. Princip rozdělení

Dělíme podle **vrstvy uvnitř backendu**, ne podle funkcí. Každý vlastní jiné soubory, takže nevznikají konflikty.

| | **Tomáš: `backend/app/core/`** | **Šimon: zbytek `backend/app/`** |
|---|---|---|
| Co | „Mozek“: čistá logika v Pythonu, bez webu a bez databáze | „Platforma“: FastAPI, databáze, uživatelé, notifikace, AI, export |
| Vstup | snímek dat (`public/data/*.json`), sčítání ŘSD, SRTI | HTTP požadavky, SQLite |
| Výstup | Python funkce vracející modely ze `schemas.py` | endpointy `/api/...` pro Matoušův frontend |
| Testy | `pytest` nad skutečnými daty (rychlé, bez serveru) | `pytest` + `TestClient` nad endpointy |

**Smlouva mezi námi** je `backend/app/core/schemas.py` a třída `Engine` v `backend/app/core/engine.py`.
- Šimon volá jen `Engine` a nic jiného z `core`.
- Tomáš nesahá na endpointy.
- Když potřebujeme nové pole, **jen přidáváme**, nic nepřejmenováváme.

```
Matouš (React)  ──/api──▶  Šimon: FastAPI routery ──▶ Engine (Tomáš) ──▶ data + graf
                                     │
                                     └─▶ SQLite: uživatelé, uzavírky, piny, hlasy, hlášení, audit
```

Stav, který se mění (piny, uzavírky, hlasy, váhy admina), drží **Šimon v DB**. Do `Engine` ho posílá jako parametry. `Engine` sám nic neukládá.

---

## 2. Co dělá Tomáš (logika, `core/`)

| # | Úkol | Funkce v `Engine` | Pro hvězdu |
|---|---|---|---|
| T1 | Načtení dat: úseky, body, linky, přípoje | `Engine.load()`, `road(id)`, `roads()` | vše |
| T2 | Skóre stejné jako ve frontendu (`src/lib/priority.ts`) + rozpad | `score(road, weights)`, `breakdown(...)` | ★1, ★3 |
| T3 | Žebříček: 4 třídy, piny, hlasy | `ranking(weights, pins, votes)` | ★1, ★3 |
| T4 | Graf silnic a **objížďka** (Dijkstra) | `detour(road_id)` | **★1** |
| T5 | **Trasa občana** domov → práce a které úseky na ní leží | `route(home, work)` | **★2** |
| T6 | Dopady uzavírky (port `impactAlerts`) + varování objížďky | `closure_impact(road_id, from, to, restriction)` | ★1 |
| T7 | Intenzita: sčítání ŘSD 2025 napárované na úseky, jinak odhad | pole `intensity` na úseku | ★1, ★3 |
| T8 | Uzavírky ŘSD SRTI (import snímku) | `srti_closures()` | ★2 |
| T9 | Scénář s rozpočtem | `budget(km, weights, …)` | V2 |
| T10 | Stabilita žebříčku | `stability(weights)` | V2 |
| T11 | Oprava započítání bodů do 450 m (nejbližší úseky) | v načtení dat | kvalita |
| T12 | Silnice I. třídy z OSM do grafu | v grafu | ★1, ★2 |

**Stav 13. 10. (Tomáš):**
- v0 a jádro T1–T5 jsou hotové: `Engine`, skóre, žebříček, graf, objížďka, trasa.
- Skóre se pro všech 4 726 kusů úseků shoduje s frontendem. Hlídá to test `tests/test_core.py`.
- Graf: 4 373 uzlů, 80 komponent, sestavení 0,1 s, jedna objížďka ~8 ms.
- Bez silnic I. třídy se objížďka našla jen u ~58 % úseků.
- **T12 hotovo:** silnice I. třídy a dálnice z OSM (`scripts/fetch_osm_roads.py`, ODbL). Objížďka se teď najde u **81,5 %** úseků (3 853 z 4 726).
  - Medián je +8,6 km a +10 min. Zbytek jsou hlavně slepé úseky končící v obci.
  - Graf má 11 842 uzlů. Největší souvislá část obsahuje 4 540 ze 4 726 úseků kraje (96 %). Zbylé části jsou jen silnice OSM mimo kraj.
  - Napojení na sebe navazujících úseků: p95 36 m. Uzly OSM se spojují jen ve sdílených bodech, ne v toleranci 25 m.
- `Engine` pracuje s kusy úseků (`road.id`), stejně jako frontend a opravy ve v1.

**Stav 15. 10. (Tomáš):**
- **T6 hotovo:** `Engine.closure_impact(road_id, date_from, date_to, restriction)` vrací `list[Alert]`.
  - Varování jsou přesný port `impactAlerts` z frontendu (texty, pořadí, úrovně). Hlídá to test nad 2 028 případy (`tests/fixtures/ts_alerts.json`).
  - Úplná uzavírka (`"uzavírka"` v `restriction`) přidá varování k objížďce: +km/+min, autobusy objížďkou, havarijní úseky na objížďce, silnice I. třídy (ŘSD), školy kolem objížďky, „Objížďka nenalezena“.
  - Bez termínu i omezení (`None`) = obecná varování k úseku, jako `repair = null` ve frontendu.
  - Pro Šimona (S5): `POST /api/closures` volá `Engine.detour(id)` a `Engine.closure_impact(id, od, do, omezeni)`. Data ve formátu `RRRR-MM-DD`.
  - Počet škol u objížďky je zatím nadsazený: bod se počítá ke všem úsekům do 450 m. Opraví T11.

## 3. Co dělá Šimon (platforma)

| # | Úkol | Endpointy / soubory | Pro hvězdu |
|---|---|---|---|
| S1 | FastAPI kostra, CORS, `/api/health`, napojení `Engine` při startu | `main.py` | vše |
| S2 | SQLite (SQLModel): users, closures, pins, votes, reports, places, notifications, audit | `db/` | vše |
| S3 | Přihlášení (JWT v cookie nebo hlavičce), role `citizen`/`official`/`admin`, seed testovacích účtů | `auth/`, `POST /api/auth/login` | ★2, ★3 |
| S4 | Úseky a žebříček: volá `Engine.ranking` s váhami (úředník: jeho, jinak admin) a piny z DB | `GET /api/useky`, `GET /api/ranking` | ★1 |
| S5 | **Uzavírky:** vytvoření, potvrzení a stav práce. Volá `Engine.detour` a `closure_impact`. | `POST /api/closures`, `POST /api/closures/{id}/confirm` | **★1** |
| S6 | **Občan:** moje místa, uložení trasy (`Engine.route`), seznam upozornění | `PUT /api/me/places`, `GET /api/me/route`, `GET /api/me/notifications` | **★2** |
| S7 | **Notifikace:** po potvrzení uzavírky najít občany, kterým leží na trase, a poslat Web Push (VAPID) nebo e‑mail (Mailpit). Max 1 upozornění na událost. | `notify/` | **★2** |
| S8 | **Admin:** uživatelé, trvalé váhy, váha a strop hlasování, audit | `/api/admin/*` | **★3** |
| S9 | **Otevřená data:** export CSV a GeoJSON s metadaty + česká stránka dokumentace API | `/api/export.*`, `/api/docs` | **★3** |
| S10 | **AI v aplikaci (vlastní Šimon):** jedno rozhraní + fallback. Zdůvodnění, oznámení, váhy z textu, třídění hlášení. Tomáš dodá vstupy (rozpad skóre, dopady, objížďka) přes `Engine`. | `ai/` | V2 |
| S11 | Hlášení a hlasování | `/api/reports`, `/api/votes` | V2 |
| S14 | **AI dokončit** (PLAN_FINAL kap. 17): Claude `claude-haiku-5-5` přes `.env`, cache v SQLite, štítek „návrh AI“, nově AI text k rozpočtu | `POST /api/ai/budget` | V2 |
| S15 | **Login pro frontend** (kap. 15): tvar `/api/auth/*` pro Matouše, rate limit na login | `/api/auth/*` | ★2, ★3 |
| S16 | Napojení frontendu: tvar `/api/ranking`, náhled uzavírky bez zápisu do DB | `POST /api/closures/preview` | ★1 |
| S17 | Rozpočtový asistent (volá T17), dvě částky pro porovnání | `GET /api/budget?amount=…&amount2=…` | V2 |
| S18 | Kolize uzavírek + dojezd IZS (T18) v odpovědi uzavírky | v `POST /api/closures` | ★1 |
| S19 | Export DCAT‑AP‑CZ (`metadata.jsonld`) + sloupec s názvem stavu pro lidi | `/api/export/*` | ★3 |
| S20 | Trasa bez přihlášení | `GET /api/route` | ★2 |

---

## 4. Jak poběží server (Mac i Windows stejně)

Nástroje (jednorázově):
- **uv** (Python a balíčky).
  - Mac: `brew install uv`
  - Windows: `winget install astral-sh.uv`
- **Node 20+.**

```bash
# backend (terminál 1)
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000

# frontend (terminál 2)
npm install
npm run dev
```

- Frontend běží na `http://localhost:5173`. Vite přesměruje `/api` na `http://localhost:8000` (`vite.config.ts`).
- Testy: `cd backend && uv run pytest`.
- `uv` si stáhne správný Python (`backend/.python-version`). Na obou systémech běží stejná verze.

**Line endings:** `.gitattributes` drží LF a `.editorconfig` nastaví editory, takže Mac a Windows si nepřepisují konce řádků.

**Na soutěži:**
- Backend poběží na jednom notebooku.
- Telefony porotců a push potřebují HTTPS, takže tunel: `cloudflared tunnel --url http://localhost:5173`. Vite proxy pošle `/api` dál.
- Záloha: všechno na jednom notebooku a nahrané video.

**Tajné hodnoty:** jen v `.env` (vzor v `.env.example`), nikdy v gitu.

VAPID klíče se vygenerují jednou. Příkaz a postup napíše Šimon do S7.

---

## 5. Milníky

Každý milník musí projít testy a jet na obou počítačích. Pak se merguje do `main`.

| Milník | Obsah | Tomáš | Šimon | Hotovo když |
|---|---|---|---|---|
| **v0: Kostra** | Projekt `uv`, `Engine`, smlouva `schemas.py`, `/api/health`, Vite proxy | T1 | S1 | `uv run pytest` zelené na Macu i Windows, frontend dostane `/api/health` |
| **v1: Data a skóre** | Skóre stejné jako frontend, žebříček, třídy | T2, T3 | S2, S4 | `GET /api/ranking` vrací stejné pořadí jako dnešní v1 |
| **v2: Uzavírka a objížďka (★1)** | Graf, objížďka, dopady, potvrzení uzavírky | T4, T6, T12 | S5 | Pro 3 ukázkové uzavírky vznikne objížďka a varování |
| **v3: Občan a upozornění (★2)** | Přihlášení, místa, trasa, push | T5, T8 | S3, S6, S7 | Potvrzená uzavírka na trase pošle Web Push do prohlížeče v telefonu |
| **v4: Admin a otevřená data (★3)** | Admin, audit, export, intenzita ŘSD | T7 | S8, S9 | Export obsahuje intenzitu a metadata, admin mění trvalé váhy |
| **v5: Nadstavba (V2)** | AI, rozpočet, stabilita, hlášení, hlasy | T9, T10, T11 | S10, S11 | Podle času, škrty podle `PLAN_FINAL.md` kap. 8 |

Funkce hvězd dema (v2–v4) se **dokončují a ladí na soutěži**. Před soutěží stavíme základ (v0–v1 a výpočetní jádro). V pitchi to řekneme otevřeně (rozhodnutí 13. 10.).

---

## 6. Plán pro Šimona

1. **Stáhni si `main`** a ověř, že ti jede `cd backend && uv sync && uv run pytest`. Pokud ne, napiš Tomášovi. Je to milník v0.
2. **Cursor:** `AGENTS.md` čte sám. Do promptu přidej „drž se AGENTS.md a docs/BACKEND.md, pracuj jen v souborech, které vlastním“.
3. **S1:** `backend/app/main.py` už má kostru s `/api/health` a načtením `Engine`. Od teď ji vlastníš ty. Přidej routery do `backend/app/api/`.
4. **S2 + S3:** SQLModel modely a seed (úředník, admin a 2 občané s domovem a prací v obcích, kde máme ukázkové uzavírky). Testovací hesla patří do seed souboru, ne do pitche.
5. **S4:** `GET /api/useky` a `GET /api/ranking`. Matouš na tom přepíná frontend z `public/data` na API.
6. **S5–S7** (hvězdy ★1 a ★2) až po v1. Na S7 si dopředu vyzkoušej Web Push na vlastním telefonu přes tunel. Je to největší riziko.
7. **S8–S9** (★3).
8. **S10–S11**, když zbude čas.

Kdykoli potřebuješ něco z logiky, napiš Tomášovi, jakou funkci a jaký výstup chceš. Do `core/` nesahej.

### Pro AI agenta (Cursor)

Before writing code in Šimon's area, **ask Šimon these questions and wait for the answers**. Do not guess.

1. Which task (S1–S11) and which milestone (v0–v5) are we on?
2. Which endpoint(s) exactly: method, path, which role may call it, and the request/response shape? Reuse the models from `backend/app/core/schemas.py`.
3. What must be stored in SQLite, and what is computed by `Engine` on every request?
4. Does the task need something new from `core/` (Tomáš)? If yes, write the request for Tomáš instead of editing `core/`.
5. How do we test it (`pytest` + `TestClient`, or a manual check in the browser or on the phone)?

Follow `AGENTS.md`. Never add AI co-author lines to commits.

---

## 7. Další kroky (15. 10., po MVP): víc dat z Data KHK

Důvod a sady: [PLAN_FINAL.md](../PLAN_FINAL.md), kap. 13. Sekce 1–6 platí beze změny, tohle přijde **až po MVP**.

### Tomáš (`core/`, `scripts/`, `public/data/`)
| # | Úkol | Funkce v `Engine` | Pro |
|---|---|---|---|
| T13 | Snímek nových sad: `Obce` (střed + obyvatelé), `Dojížďka_do_středních_škol`, záplavová území Q5/Q20/Q100, plánované opravy 2022. Do `public/data/obce.json`, `students.json`, `flood.json`, `planned2022.json`. | v načtení dat | vše níže |
| T14 | **Toky studentů:** dvojice (obec → škola) pustit po grafu, sečíst žáky na úsecích | `students_on(road_id)`, pole v `detour` | ★1 |
| T15 | **Odříznuté obce** při uzavírce + **povodňový scénář** | `flood(level)`, pole v `detour` | ★1 |
| T16 | Ukázkové uzavírky ze skutečných plánů 2022 + ověření modelu | `demo_closures()`, `backtest_2022()` | demo, V2 |
| T17 | **Rozpočtový asistent** (PLAN_FINAL kap. 17): souvislé stavby (stejná `sil`, okres), cena podle stavu (`estimate`), hladově podle skóre na Kč | `budget_plan(amount_kc, weights)` | V2 |
| T18 | **Dojezd ZZS + HZS** při uzavírce: obce s delším dojezdem, +min, limit 20 min | pole v `PeopleImpact` / `Alert` | ★1 |
| T19 | **Ověření modelu:** % opravených úseků 2018–2024 v horní třetině skóre | `backtest()` | pitch |

### Šimon (API)
| # | Úkol | Endpoint |
|---|---|---|
| S12 | Povodňový scénář | `GET /api/flood?level=q5\|q20\|q100` |
| S13 | Obce (hranice nebo střed, obyvatelé) a ukázkové uzavírky | `GET /api/obce`, `GET /api/demo-closures` |
| — | Odpověď S5 (uzavírka) dostane nová pole od T14/T15. Nic se nepřejmenuje. | `POST /api/closures` |

### Smlouva
Nová pole do `schemas.py` se **jen přidají** a domluvíme je spolu, až bude T14 hotové. Návrh:
- `DetourResult.students_per_day`, `DetourResult.cut_off_obce`.
- Nové modely `ObecImpact` (kód, název, obyvatelé, studenti) a `FloodResult`.

### Stav 15. 10., ~10:45 (Tomáš)
- **T13 hotovo:** `scripts/fetch_khk_extra.py` → `public/data/khk_extra.json` (4,4 MB).
  - Obsahuje: 448 obcí, 5 011 toků studentů (22 382 žáků denně, denní studium, bydliště v kraji), záplavy Q5/Q20/Q100, 23 plánovaných oprav 2022.
  - Záplavové polygony mají ~570 tis. bodů. Skript je proto protne se silnicemi sám a uloží jen metry zaplavení na úsek. Pro mapu uloží zjednodušený polygon.
  - Spuštění: `uv run --project backend --with shapely python scripts/fetch_khk_extra.py` (~5 min, ArcGIS je pomalý).
- **T14 hotovo:** toky studentů po grafu. Všech 22 382 žáků má trasu. Nejvytíženější úsek (Hradec Králové) má 3 721 studentů denně.
- **T15 hotovo:**
  - Odříznutá obec = ztratí silniční spojení se **všemi nemocnicemi** (Data KHK: Nemocnice).
  - Studenti odříznutí = obec bydliště a škola jsou v různých částech sítě.
  - Povodeň zavře úsek, když v zóně leží aspoň 100 m (kratší úseky jsou většinou mosty).
  - Q100: zavřeno 228 km silnic kraje, 67 obcí bez spojení s nemocnicí. Je to **horní odhad**: místní komunikace v grafu nejsou.
- **Smlouva (`schemas.py`, jen přidané):** `ObecImpact`, `PeopleImpact`, `FloodResult`. `DetourResult` beze změny.
- **Nové metody v `Engine` pro Šimona:**

| Metoda | Vrací | Endpoint (návrh) |
|---|---|---|
| `people_impact(road_ids)` | `PeopleImpact`: studenti denně, z jakých obcí, odříznuté obce a lidé | do odpovědi S5 `POST /api/closures` |
| `students_on(road_id)` | `int` | pole v `GET /api/useky` (volitelně) |
| `flood("q5"\|"q20"\|"q100")` | `FloodResult` | S12 `GET /api/flood?level=q100` |
| `flood_geojson(level)` | GeoJSON geometrie zóny | S12 `GET /api/flood/{level}.geojson` |

- První volání `people_*` nebo `flood` trvá ~3 s (směrování toků). Šimon může v lifespanu zavolat `engine.people`, aby to proběhlo při startu.
- **Pro Matouše (Zdroje dat):** itemId nových sad je v `khk_extra.json` → `sources`:
  - Obce `70564613fe434f149655e79a85e94efc`.
  - Dojížďka do středních škol `c62b3bf8a0dd40b4b1d70bc419d5d6e4`.
  - Záplavová území Q5 `0445ecebd0624b588488700038715bf5`, Q20 `8a81ac1b830d42249ed3b38708e95243`, Q100 `7d93751a3221478ca39a6e1ca6578047`.
  - Plánované opravy 2022 `1915aa2911d74672a6ab58d5b615055b`.
- **T7 hotovo (intenzita, ŘSD 2025):** `scripts/fetch_rsd_counts.py` → `public/data/intensity.json`.
  - Sčítací úseky ŘSD jsou spárované podle čísla silnice a polohy podél silnice: **1 343 z 3 192 km má měřenou hodnotu**.
  - Kontrola: obec úseku je v popisu sčítacího úseku u 63 % úseků. V obráceném směru jen u 36 %, takže směr podél silnice sedí.
  - Ostatní úseky mají **odhad** = dolní kvartil sčítaných úseků stejné třídy (II. tř. 1 493, III. tř. 1 356 voz/den).
  - `RoadSummary` má nová pole `intensity` (vozidel/den) a `intensity_src` (`csd2025` / `odhad`). Frontend musí u `odhad` ukázat štítek „odhad“.
  - `Engine.intensity(road_id)`. `closure_impact` při úplné uzavírce přidá varování „Objížďkou pojede ~N vozidel denně“ a kolik km denně navíc ujedou.
  - Licence ŘSD: **CC BY‑SA 4.0**. Export s intenzitou musí mít stejnou licenci (S9).

### Stav 15. 10., ~11:45 (Tomáš): T16 ukázkové uzavírky 2022
- **Hotovo:** `Engine.demo_closures(full_only=True) -> list[DemoClosure]`. Zdroj: Data KHK, Plánované opravy silniční infrastruktury na rok 2022 (liniové), 23 záznamů, z toho 20 úplných uzavírek.
- Každý plán se spáruje s našimi úseky podle čísla silnice a polohy čáry (vzorek po 20 m, do 40 m od úseku). Když číslo v plánu nesedí se Stavem povrchu (1 případ, III/2864 leží na 2861), páruje se jen podle polohy a v `note` to stojí.
- Spárováno 17 z 20 úplných uzavírek. Tři čáry neleží na úsecích z dat (II/3041 Libňatov, III/32426 Nechanice – Hrádek, III/30011 Zálesí; místní komunikace nebo úsek mimo data). Mají `road_ids = []`, vysvětlení v `note` a dopad se nepočítá.
- Pro každou úplnou uzavírku: objížďka přes všechny zavřené úseky najednou (`RoadGraph.detour_set`), středoškoláci a odříznuté obce (`PeopleImpact`), auta za den, varování (`alerts`, stejná jako `closure_impact`).
- **Doporučené na demo** (`recommended=True`, `recommended_reason`), tři různé příběhy:
  - Nejvíc středoškoláků: **II/303 Velké Poříčí – Hronov**, 589 studentů denně, 8 246 vozidel (ŘSD), objížďka +0,8 km.
  - Nejvíc vozidel: **II/302 Broumov – Velká Ves**, 7 909 vozidel denně, 447 studentů, objížďka +14,6 km / +16 min.
  - Nejdelší objížďka: **III/28526 Jizbice – Lipí – Náchod**, +31 km / +33 min.
- Poctivě: model posílá všechny jednou nejrychlejší objížďkou a nezná místní komunikace. U průtahů obcí (např. III/29913 Lochenice) proto ukáže „odříznutou“ obec, i když místní ulice objížďku umožní.
- **Smlouva (jen přidané):** `DemoClosure` (nový model), `DetourResult.closed_road_ids`.
- **Pro Šimona (S13):** `GET /api/demo-closures` = `engine.demo_closures()`. První volání ~5 s, pak z cache. Výsledek je kopie, lze ho upravit.
- **NEAKTIVNÍ:** `backtest_2022()` z tabulky T16 výše se dnes nedělá. Ověření modelu na plánech 2022 je podle `PLAN_FINAL.md`, kap. 13, přesunuté do `NAPADY.md`.

### Stav 15. 10., ~11:30 (Tomáš): T8 SRTI, metody pro API
- **T8 hotovo:** `scripts/fetch_srti.py` → `public/data/srti.json`. Zdroj: ŘSD / NDIC, SRTI jako linked open data (snímek `https://lod.tamtamresearch.com/srti/snapshot/`), **CC BY 4.0**.
  - Snímek 15. 10.: 2 324 záznamů v ČR, **45 situací v kraji**, 31 z nich leží do 100 m od úseku kraje, **22 úplných uzavírek na silnicích kraje**.
  - SRTI dává jen bod, termín a typ (údržba, stavební práce, uzavřená silnice, kyvadlový provoz…). Číslo silnice jen u I. tříd a dálnic, popis ani délku ne.
- `Engine.srti_closures(on=None, active_only=False) -> list[SrtiClosure]` (`road_id`, `road_label`, `active`, `full_closure`). Šimonovo `api/closures.py` (`_srti`) ho už volá.
- `Engine.obce()` (448 obcí: kód, název, obyvatelé, střed, bbox) a `Engine.cut_off_obce(road_id)`. Tvar sedí na Šimonovo `services/scenarios.py`.
- **Smlouva (jen přidané):** `SrtiClosure`.
- Zdroje dat (Matouš): SRTI, CC BY 4.0, odkaz na NKOD je v `srti.json` → `url`.
- **T11 hotovo (~11:45):** `scripts/fetch-data.mjs` počítá bod (škola, nemocnice, zastávka…) jen k nejbližším úsekům: nejvýš o 50 m dál než nejbližší úsek do 450 m. Dřív se bod počítal ke všem úsekům do 450 m.
  - Součet bodů u úseků klesl asi na polovinu (školy 5 889 → 2 525, nemocnice 38 → 22). Každý bod se dřív počítal v průměru ~2×.
  - Pole `obce` u úseku se nemění (pořád ze všech bodů do 450 m).
  - Skóre a pořadí se změnily stejně ve frontendu i v Pythonu (oba čtou `roads.json`). Testy shody s `priority.ts` přegenerované, 19/19 zelených.
  - `repairs.json` (simulované plánované opravy) se při přegenerování vybraly znovu podle nového skóre.
  - Poznámka výše „Počet škol u objížďky je zatím nadsazený … Opraví T11“ je tím **NEAKTIVNÍ**.
