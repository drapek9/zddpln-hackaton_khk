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

## Úprava rozhraní 15. 10. odpoledne (Matouš, větev `matous`, commit `4ce3552`)

Podle připomínek Matouše k designu. Přemek, prosím, projdi (review designu).

| Oblast | Co se změnilo |
|---|---|
| Mapa | Otáčení a náklon (3D) jde zapnout a vypnout (ve výchozím stavu vypnuto). Tlačítko „⌂ Celý kraj“ vrátí výchozí pohled. Legenda je nahoře vlevo. |
| Správa silnic | Váhy jsou v panelu „Parametry priority“ vpravo nahoře nad mapou, odděleně od ostatního. Vlevo zůstalo hledání a filtry, pod nimi rozbalovací sekce: Žebříček priority (15 úseků, pak „Dalších 50“ / „Rozbalit vše“), Ukázkové uzavírky, Vrstvy mapy. |
| Detail úseku (úředník) | Záložky **Přehled / Uzavírka / Priorita**. Simulace uzavírky je zvlášť od přehledu a od připíchnutí priority. Seznamy (linky, školy, IZS…) jsou rozbalovací. |
| Veřejnost | Menší vyhledávání nahoře. Seznam oprav, odběr upozornění a moje hlášení jsou rozbalovací. |
| Všude | Bez viditelných posuvníků v bočních panelech (scrollovat jde dál), větší písmo (základ 16 px). |

Ověřeno: `npm run build` a kontrola typů prošly, v prohlížeči správa i veřejnost, čára objížďky se na mapě vykreslí. Neověřeno: mobilní šířka 375 px.

## Úkoly po sloučení ve 12:00 (15. 10., rozhodl Tomáš)

Podrobně v [PLAN_FINAL.md](../PLAN_FINAL.md), kap. 17.4. Pořadí = priorita:
F1 login (kap. 15) → F2 ★1 přes API + karta uzavírky → F3 Moje cesty po silnicích + ranní souhrn → F4 povodeň → F5 rozpočtový asistent → F6 Moje obec → F7 patička a souhlas.

## Stav 15. 10. po poledni (Matouš, větev `matous`): design a přihlášení

**Design (podle zadání Přemka):** jeden design systém pro veřejnost i úřad, jedna akcentová barva (petrolejová), světlý a tmavý režim (tokeny v `src/styles.css`, volba v prohlížeči, jinak `prefers-color-scheme`), kompaktní hlavička, roztahovací a sbalitelné boční panely, na mobilu mapa a vysouvací panely zdola. Srozumitelné názvy stavů (`STAV_LABEL` v `src/lib/geo.ts`), data kraje beze změny.

**F1 Login (kap. 15) ✅ ve frontendu, ověřeno proti backendu z větve `simon`:**
- `src/lib/auth.ts`: `me`, `login`, `register`, `logout`, vše s `credentials: "same-origin"`. Token se neukládá, jen e-mail a role.
- Úvod: „Pokračovat bez přihlášení“ (veřejnost) a „Přihlásit se do správy“. Vpravo nahoře „Přihlásit se“.
- Po přihlášení podle role: `citizen` → veřejná mapa se štítkem Občan, `official` → správa, `admin` → správa + Správa systému. V hlavičce e-mail, role a „Odhlásit“.
- Přihlášení přežije obnovení stránky (`GET /api/auth/me`). Při 401 z API zpět na přihlášení.
- Když backend neběží, přihlášení nabídne „Jako úředník / admin (demo)“ a v aplikaci je přepínač rolí se štítkem „demo“.

**F7 Patička ✅:** zásady ochrany údajů (nová stránka), souhlas při registraci občana (bez něj účet nevznikne), odkaz na Zdroje dat.

**Další (kap. 17.4):** F2 simulátor přes API a uzavírky 2022, F4 povodeň, F5 rozpočet přes `/api/budget`, F6 Moje obec, F3 trasa po silnicích. Rozpočet a Moje cesty mají ve frontendu náhled, který se přepne na API.

## Rozhodnutí týmu k rozhraní (15. 10. odpoledne, Matouš)

Platí pro všechny další obrazovky. Hotové je v commitu `c3fc242` na větvi `matous`.

| # | Rozhodnutí | Stav |
|---|---|---|
| R1 | **Úvod = přihlášení.** Vlevo název Cesty KHK a krátký popis, vpravo přihlášení, registrace občana a „Pokračovat bez přihlášení“. Přihlášený vidí vpravo e‑mail, roli a pokračování podle role. Nahrazuje karty z kap. 15.1 bod 1. | ✅ |
| R2 | **Role:** veřejnost bez účtu, občan s účtem, úředník a admin s účtem od kraje. Co vidí úředník, veřejnost nevidí. Úředník mění váhy jen pro sebe, admin je ukládá trvale pro celý kraj. Role se přiřadí podle účtu (`/api/auth/me`), přepínač rolí je jen v demu bez serveru. | ✅ |
| R3 | **Detail úseku jako v mapových aplikacích:** dole nad mapou pruh s náhledem (silnice, stav, skóre). Kolečkem dolů, tahem prstem nahoru nebo klikem na úchyt se vysune celý detail, kolečkem nahoru na začátku obsahu se stáhne. Pravý boční panel u úředníka a veřejnosti není. | ✅ |
| R4 | **Boční panely:** výchozí šířka je nejmenší možná (260 px). Na okraji je šipka pro schování, schovaný panel vysune jazýček. Tažením jde panel roztáhnout (260–620 px), šířky se pamatují v prohlížeči. | ✅ |
| R5 | **Admin nemá na prvním místě mapu.** Začíná na „Správě systému“: přehled (počty úředníků, adminů, občanů, pinů), trvalé váhy kraje, uživatelé a role (změna role, blokace), záznam změn, export. Mapa a rozpočet jsou v dalších záložkách. Data z `/api/admin/users`, `/api/admin/weights`, `/api/admin/audit`; bez serveru demo data se štítkem. | ✅ (se serverem neověřeno) |
| R6 | **Jeden design pro všechny role** (zadání Přemka): petrolejový akcent, světlý a tmavý režim, barvy červená až zelená jen pro stav a varování, na mobilu mapa a vysouvací panely. | ✅ |

### Úkoly pro Matouše po sloučení (navazuje na kap. 17.4 a 18 v `PLAN_FINAL.md`)
| Úkol | Co | Stav |
|---|---|---|
| M-a | Ověřit stránku admina (R5) proti backendu na `main`: seznam uživatelů, změna role, uložení vah, audit. | ❌ |
| M-b | **F2:** žebříček číst z `items` v odpovědi `/api/ranking`. Náhled uzavírky přes `POST /api/closures/preview`, `POST /api/closures` až u „Potvrdit uzavírku“. Karta uzavírky: auta za den, studenti, odříznuté obce, dojezd IZS. | ❌ |
| M-c | Skutečné uzavírky 2022 z `/api/demo-closures` v levém panelu úředníka (3 doporučené nahoře). | ❌ |
| M-d | **F5:** plán podle rozpočtu přepnout z náhledu ve frontendu na `/api/budget` (stavby z `Engine.budget_plan`). | ❌ |
| M-e | **F3:** Moje cesty přes `GET /api/route` místo pásu 1,5 km, ranní souhrn nahoře. | ❌ |
| M-f | **F4** povodeň Q5/Q20/Q100, **F6** Moje obec. | ❌ |
| M-g | Sloučit `matous` do `main` až po Šimonovi (kap. 18). | ❌ |
