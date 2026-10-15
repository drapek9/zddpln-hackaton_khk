# Stav projektu a doporučený postup (15. 10., 9:30)

Audit ke commitu `dfe88b3` na `origin/main`. Doplňuje [PLAN_FINAL.md](../PLAN_FINAL.md). Nic z plánu neruší, jen **mění pořadí a navrhuje škrty hned teď, ne až ve 12:00**.

---

## 1. Jak na tom jsme

**Hotové a ověřené:**
- Jádro logiky `backend/app/core/` (Tomáš):
  - skóre shodné s frontendem,
  - žebříček se 4 třídami a piny,
  - graf silnic + OSM,
  - objížďka (najde se u 81,5 % úseků, ~2 ms),
  - trasa občana.
- `uv run pytest` dá 7/7 zelených. `npm run build` projde.
- Frontend v1 funguje, ale bere statický JSON z `public/data` a ukládá do localStorage.

**Stav větví:** `simon`, `matous` a `premek` jsou totožné s `main`. Od 13. 10. nikdo kromě Tomáše nepushnul.

**Na 0 %:**
- Celá platforma (Šimon): DB, přihlášení, role, endpointy (existuje jen `/api/health`), notifikace, AI, export.
- Frontend nevolá API vůbec.

**Chybí v `core/` (Tomáš):**
- T6 `closure_impact`: rozpracováno lokálně, zatím nepushnuto.
- T7 intenzita ŘSD: chybí, takže **„aut za den“ zatím nemá zdroj dat**.
- T8 uzavírky SRTI.
- T11 oprava započítání bodů do 450 m (`scripts/fetch-data.mjs:397`).
- T13–T16 nové sady z Data KHK.

---

## 2. Co nás drží zpátky

1. **Kritická cesta vede přes Šimona.** Matouš nemá na co napojit simulátor ★1, dokud nepojede `/api/ranking` a endpoint objížďky.
2. **Rozsah MVP neodpovídá 7,5 h.** Plán chce 4 role, registraci, místa, trasu, push, admina, audit, export, piny i stavy práce. `docs/ROZBOR.md` sám říká: jeden flow hotový na 100 %, ne pět na 60 %.
3. **★1 nemá data pro „aut za den“.** Hlavní unikátní tvrzení pitche dnes nic nepodkládá.
4. **Push je nejdelší řetěz:** přihlášení → místa → trasa → potvrzení → notifikace → push → tunel → telefon. Stačí, aby selhal jeden článek.

---

## 3. Co nás může stát vítězství

| Riziko | Proč | Co udělat |
|---|---|---|
| Kód napsaný před soutěží | Commity z 13. 10. jsou ve veřejném repu. Milan Šulc (open source) se tam podívá. Pravidla mluví o díle „vytvořeném“ na soutěži. Písemná odpověď organizátorů nikde není. | **Dnes ráno se osobně zeptat T. Slezáka.** V pitchi otevřeně říct, co bylo připravené předem. |
| Push na iPhonu | Funguje jen u PWA přidané na plochu (iOS 16.4+), navíc přes tunel a Wi‑Fi pořadatele. | Základ ★2 je seznam upozornění v aplikaci a náhled e‑mailu. Push jen jako bonus. **Ve 12:00:** když nejede na skutečném telefonu, škrtá se. |
| Licence OSM | OSM (ODbL) chybí na stránce Zdroje dat (`src/lib/sources.ts`) i v mapě. Export z dat ŘSD musí mít CC BY‑SA. Uvádění zdrojů vyžaduje čl. 7.3. | Matouš: doplnit OSM, ŘSD a nové sady Data KHK do Zdrojů dat. |
| Kopie RoadMapperu (2022) | Když demo začne mapou stavu a žebříčkem, vypadá jako RoadMapper. | Demo otevírá **uzavírka → objížďka → zasažení lidé**. |
| Málo datových sad | Máme 18, KompaZ (2025) měl 62. | Přidat 4 sady z kap. 13 (T13). Je to levné a zvedne kritérium „otevřená data“. |
| Nikdo na pitchi a PDF | Sloupec „Kdo“ v kap. 10 je prázdný. Bez PDF/PPTX v 17:15 nesmíme prezentovat (čl. 5.4). | Přemek začne na pitchi, PDF a záložním videu **hned**. |
| Pomalý QR odkaz | Telefon přes tunel stahuje ~9 MB JSON (`roads.json` + `osm_roads.json`). | Mobil tahá data z API, nebo zmenšený snímek bez `osm_roads.json`. |

**Na dotaz poroty mít připravené:**
- Měření stavu povrchu jsou hlavně z let 2022–2024, 266 úseků je z roku 2018.
- Chyba s 450 m (jeden bod se započítá k mnoha úsekům) je zatím v kódu (T11).
- Čísla na úvodu sedí: havarijních je 1 375 km (havarijní 1 271 + SUPERhavarijní 104).

---

## 4. Doporučený postup (navíc k plánu)

### Škrty hned (místo rozhodnutí ve 12:00)
- **Registraci** nahradí seedované účty a přepínač role. Přihlášení zůstává.
- **Push** je bonus. Základ ★2: seznam upozornění v aplikaci a náhled e‑mailu.
- **Admin ★3** zúžit na export (CSV a GeoJSON s metadaty), dokumentaci API a Zdroje dat. Audit jen jako jednoduchý seznam.
- **T6 port varování** nebrzdí frontend: `impactAlerts` už ve frontendu existuje, Matouš ho může volat přímo.

### Do 12:00
| Kdo | Pořadí úkolů |
|---|---|
| **Tomáš** | T14 toky studentů (měřená data z Data KHK, porota je z Data KHK) → T7 intenzita ŘSD (zbytek štítek „odhad“) → T16 tři ukázkové uzavírky z plánů 2022. Matoušovi poslat požadavek na OSM ve Zdrojích. |
| **Šimon** | S4 `GET /api/ranking` + S5 uzavírka s objížďkou **do ~10:30** → minimální seed účtů (S2, S3) → S6 seznam upozornění. Push až nakonec. |
| **Matouš** | Obrazovka simulátoru ★1 nad mockem tvarů ze `backend/app/core/schemas.py`. Na API přepnout, jakmile pojede S4/S5. Pak Zdroje dat. |
| **Přemek** | Pitch, PDF/PPTX, scénář dema, záložní video. Design review jen u ★1. |

### Ve 12:00 (sync)
- Jede ★1 end-to-end (výběr úseku → objížďka na mapě → +km, +min, studenti/auta, varování)? Pokud ne, **všichni na ★1**.
- Push na skutečném telefonu ano/ne. Ne = škrt.
- Dál podle kap. 8 `PLAN_FINAL.md`.

### Pravidlo pro AI agenty
Před každým blokem práce: `git fetch`, přečíst změny v `PLAN_FINAL.md` a tomto souboru na `origin/main`. Do plánů jen přidávat, nic nemazat. Zastaralé věci označit **NEAKTIVNÍ**.

---

## 5. Průběžné poznámky

- **15. 10., ~9:45 (Tomáš):** T6 `closure_impact` je hotové a pushnuté na větev `tomas` (`990270c`), 10/10 testů. Šimon ho může volat z S5 hned, viz `docs/BACKEND.md`, „Stav 15. 10.“. Další podle kap. 4: T13 data → T14 toky studentů → T7 → T16.
