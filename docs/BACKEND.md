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
- **Objížďka se zatím najde jen u ~58 % úseků.** Bez silnic I. třídy se síť trhá. Proto je T12 (OSM) první další krok.
- `Engine` pracuje s kusy úseků (`road.id`), stejně jako frontend a opravy ve v1.

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
| S10 | AI: jedno rozhraní + fallback. Zdůvodnění, oznámení, váhy z textu, třídění hlášení. | `ai/` | V2 |
| S11 | Hlášení a hlasování | `/api/reports`, `/api/votes` | V2 |

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
| **v3: Občan a upozornění (★2)** | Přihlášení, místa, trasa, push | T5, T8 | S3, S6, S7 | Potvrzená uzavírka na trase pošle push na telefon |
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
