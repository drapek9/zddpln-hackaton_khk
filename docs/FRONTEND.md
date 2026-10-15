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
