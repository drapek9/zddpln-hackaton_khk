# Frontend a design: plán pro Matouše

- **Matouš** vlastní frontend a design: `src/`, `index.html`, `public/` (kromě `public/data`).
- **Přemek** dělá review designu.
- Backend dělají Tomáš a Šimon, viz [BACKEND.md](BACKEND.md).
- Co a proč stavíme: [PLAN_FINAL.md](../PLAN_FINAL.md), hlavně kap. 2 (pitch) a kap. 4 (obrazovky).

## Co dělat (podle milníků)

| Milník | Úkol | Hotovo když |
|---|---|---|
| v0 | Rozjet `npm run dev` + backend. `/api/health` odpovídá přes Vite. | vidíš `{"ok": true}` na `http://localhost:5173/api/health` |
| v1 | Žebříček a mapa berou data z `/api/ranking` místo z `public/data`. Zobrazit 4 třídy priority a štítek připíchnutí. | pořadí je stejné jako dnes |
| v2 ★1 | **Simulátor uzavírky:** vyberu úsek a termín. Mapa ukáže objížďku a karta ukáže +km, +min, auta za den a varování. Pod tím návrh oznámení a tlačítko „Potvrdit uzavírku“. | demo scénář projde na 3 ukázkových uzavírkách |
| v3 ★2 | **Občan:** registrace a přihlášení, „Moje místa“ (domov + práce kliknutím do mapy), „Moje trasa“, povolení push, seznam upozornění. Vše musí jít na mobilu (375 px). | prohlížeč na telefonu ukáže Web Push po potvrzení uzavírky |
| v4 ★3 | **Admin:** uživatelé, trvalé váhy, audit, export. Česká stránka s dokumentací API. Doplnit nové zdroje na stránku Zdroje dat: ŘSD sčítání (CC BY‑SA), ŘSD SRTI (CC BY), OpenStreetMap (© přispěvatelé OSM, ODbL). | admin změní váhy a žebříček se změní všem |
| v5 | AI texty (štítek „návrh AI“), scénář s rozpočtem, hlášení, hlasování | podle času |

**Vždy platí:**
- Celé UI česky.
- Simulovaná data mají štítek „demo data“, odhady štítek „odhad“.
- Žádné klíče ve frontendu.
- Přemek po každém milníku projde design.

## Pro AI agenta (Cursor, Claude Code, Copilot)

Before writing any code for this area, **ask Matouš these questions and wait for the answers**. Do not guess.

1. Which milestone (v0–v5) and which screen are we working on now?
2. Is the backend endpoint for it ready? If not, should we mock it with the shapes from `backend/app/core/schemas.py`, or wait?
3. Should the screen be a new component, or a change to an existing one (`AdminApp.tsx`, `PublicApp.tsx`, `RoadPanel.tsx`, `Landing.tsx`)?
4. Is there a design reference from Přemek or a sketch? Which colours, layout and mobile behaviour should it have?
5. Which role sees the screen (public, citizen, official, admin)?
6. What exactly counts as "done" for this task, and how will we check it in the browser?

Rules for the agent:
- Work only in `src/`, `index.html` and `public/` (not `public/data`).
- If the backend needs a change, write down the request for Šimon (API) or Tomáš (logic) instead of editing `backend/`.
- Follow `AGENTS.md`.
- Never add AI co-author lines to commits.

## Další kroky (15. 10., po v2): víc dat z Data KHK

Důvod: [PLAN_FINAL.md](../PLAN_FINAL.md), kap. 13. Až po MVP, nic výše se nemění.
- **Karta uzavírky:** řádek „zasaženo N středoškoláků denně“ a seznam odříznutých obcí s počtem obyvatel.
- **Povodeň Q100:** tlačítko u úředníka. Mapa zatopených silnic, odříznuté obce, lidé, studenti. Úroveň Q5/Q20/Q100.
- **Ukázkové uzavírky** ze skutečných plánů 2022 (výběr v simulátoru).
- **Zdroje dat:** doplnit 4 sady Data KHK: Dojížďka do středních škol, Obce, Záplavová území (Q5/Q20/Q100), Plánované opravy 2022.

## Stav 15. 10. (Matouš, větev `matous`, commit `073b493`)

| Milník | Stav | Poznámka |
|---|---|---|
| v0 | ✅ | `/api/health` přes Vite funguje. Cíl proxy jde změnit: `CESTY_API_TARGET=http://server:8000 npm run dev` (kap. 6 v `STAV_A_DOPORUCENI.md`). |
| v1 | ✅ (zatím bez API) | Žebříček se 4 třídami a připíchnutím s důvodem. Volá `GET /api/ranking`. Dokud vrací 404, počítá lokálně stejným algoritmem jako `core/scoring.py` (4 726 úseků, 0 rozdílů v pořadí, skóre i třídě, i s pinem). Piny jsou zatím v localStorage. |
| v2 ★1 | ✅ (zatím bez API) | Simulátor uzavírky v detailu úseku: objížďka na mapě, +km, +min, varování k objížďce, návrh oznámení, „Potvrdit uzavírku“. Volá `POST /api/closures`. Dokud vrací 404, bere snímek `public/demo/detours.json` spočítaný jádrem (`Engine.detour` + `detour_alerts`, top 300 úseků, štítek „předpočítáno jádrem“). 3 ukázkové uzavírky: úseky 581, 2372, 1940. |
| Zdroje dat | ✅ | OSM (ODbL), CARTO, ŘSD sčítání (CC BY‑SA), SRTI (CC BY) a 4 sady z kap. 13 jsou na stránce Zdroje dat se stavem „používáme / připravujeme“. Atribuce OSM je i v mapě. |

**Co frontend čeká od backendu (požadavky, nic jsem v `backend/` neměnil):**
- **Šimon, S4:** `GET /api/ranking` → `RankedRoad[]` (celá síť, seřazené). Váhy, které se liší od výchozích, posílám jako query (`?stav=30&schools=100`). Bez parametrů = výchozí nebo váhy úředníka.
- **Šimon, S5:** `POST /api/closures` s tělem `{road_id, date_from, date_to, restriction}` → `{detour: DetourResult, alerts: Alert[]}`. V `alerts` stačí `detour_alerts` (obecná varování frontend zatím počítá sám). Jiný tvar je v pořádku, jen mi ho napište a upravím `src/lib/api.ts`.
- **Tomáš, T7:** „aut za den“ na kartě uzavírky ukazuje „čeká na data“. Po T7 stačí přidat pole do `DetourResult`.
- **Tomáš, T16:** až budou ukázkové uzavírky z plánů 2022, nahradím jimi `DEMO_CLOSURES` v `src/lib/closure.ts`.

Další na řadě (podle kap. 4 `STAV_A_DOPORUCENI.md`): přepnout na API, jakmile pojedou S4 a S5. Pak řádek studentů a odříznutých obcí na kartě uzavírky (T14/T15).
