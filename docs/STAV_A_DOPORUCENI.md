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

**Tým:** pracují všichni. Matouš a Přemek dělají spolu na jednom počítači. Šimon a Matouš zatím nic nepushnuli, takže jejich práce na GitHubu ještě není vidět.

**Na GitHubu zatím chybí** (lokálně může být rozpracováno):
- Platforma (Šimon): DB, přihlášení, role, endpointy (na `main` je jen `/api/health`), notifikace, AI, export.
- Napojení frontendu na API.

**Chybí v `core/` (Tomáš):**
- T6 `closure_impact`: rozpracováno lokálně, zatím nepushnuto.
- T7 intenzita ŘSD: chybí, takže **„aut za den“ zatím nemá zdroj dat**.
- T8 uzavírky SRTI.
- T11 oprava započítání bodů do 450 m (`scripts/fetch-data.mjs:397`).
- T13–T16 nové sady z Data KHK.

---

## 2. Co nás drží zpátky

1. **Kritická cesta vede přes Šimona.** Matouš napojí simulátor ★1 na API, až pojede `/api/ranking` a endpoint objížďky. Do té doby pracuje nad mockem.
2. **Rozsah MVP neodpovídá 7,5 h.** Plán chce 4 role, registraci, místa, trasu, push, admina, audit, export, piny i stavy práce. `docs/ROZBOR.md` sám říká: jeden flow hotový na 100 %, ne pět na 60 %.
3. **★1 nemá data pro „aut za den“.** Hlavní unikátní tvrzení pitche dnes nic nepodkládá.
4. **Push je nejdelší řetěz:** přihlášení → místa → trasa → potvrzení → notifikace → push → tunel → telefon. Stačí, aby selhal jeden článek.

---

## 3. Co nás může stát vítězství

| Riziko | Proč | Co udělat |
|---|---|---|
| Kód napsaný před soutěží | Commity z 13. 10. jsou ve veřejném repu. Milan Šulc (open source) se tam podívá. Pravidla mluví o díle „vytvořeném“ na soutěži. Písemná odpověď organizátorů nikde není. | **Dnes ráno se osobně zeptat T. Slezáka.** V pitchi otevřeně říct, co bylo připravené předem. |
| Web Push na iPhonu | Safari ho povolí, jen když si uživatel web přidá na plochu (iOS 16.4+). Navíc jde přes tunel a Wi‑Fi pořadatele. | Základ ★2 je seznam upozornění na webu a náhled e‑mailu. Push jen jako bonus. **Ve 12:00:** když nejede na skutečném telefonu, škrtá se. |
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
- **Push** je bonus. Základ ★2: seznam upozornění na webu a náhled e‑mailu.
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
- Web Push v prohlížeči na skutečném telefonu ano/ne. Ne = škrt.
- Dál podle kap. 8 `PLAN_FINAL.md`.

### Pravidlo pro AI agenty
Před každým blokem práce: `git fetch`, přečíst změny v `PLAN_FINAL.md` a tomto souboru na `origin/main`. Do plánů jen přidávat, nic nemazat. Zastaralé věci označit **NEAKTIVNÍ**.

---

## 5. Průběžné poznámky

- **15. 10., ~9:45 (Tomáš):** T6 `closure_impact` je hotové a pushnuté na větev `tomas` (`990270c`), 10/10 testů. Šimon ho může volat z S5 hned, viz `docs/BACKEND.md`, „Stav 15. 10.“. Další podle kap. 4: T13 data → T14 toky studentů → T7 → T16.
- **15. 10., 9:45 (Tomáš):** Upřesnění: pracují všichni, jen jejich práce ještě není pushnutá. Matouš a Přemek dělají spolu na jednom počítači. Šimonova HTML stránka pro záznam práce zatím na `main` není. Do té doby se stav zapisuje sem.
- **15. 10., 10:00 (Matouš):** Frontend v0, v1, v2 ★1 a Zdroje dat jsou pushnuté na větev `matous` (`073b493`). Simulátor ★1 jede end-to-end nad snímkem objížděk z jádra a čeká jen na S4/S5 od Šimona. Detaily a požadavky na API jsou v `docs/FRONTEND.md`, „Stav 15. 10.“. `CESTY_API_TARGET` ve `vite.config.ts` je hotové (kap. 6, bod 2).

---

## 6. Sdílený server: jeden počítač jako server a databáze (návrh, 15. 10.)

**Cíl:** jeden z nás spustí FastAPI + SQLite na svém počítači. Ostatní se k němu bezpečně připojí a všichni pracují nad stejnými daty (účty, uzavírky, upozornění).

### Doporučení: Tailscale (soukromá síť přes WireGuard)
- Každý si nainstaluje Tailscale (Mac i Windows, zdarma) a přihlásí se do stejné sítě (tailnet). Na Tomášově PC už Tailscale je.
- Server dostane pevnou adresu `100.x.y.z` a jméno, např. `http://tomas-pc:8000`. Funguje i za NAT a na Wi‑Fi pořadatele, kde zařízení na stejné síti často nevidí jedno druhé (izolace klientů).
- Provoz je šifrovaný a dovnitř se dostane jen člen tailnetu. Na internet nic nevystavujeme.
- Když Wi‑Fi blokuje UDP, Tailscale jede přes relé na portu 443. Je to pomalejší, ale funguje. Záloha: hotspot z mobilu.

**Pro porotu a telefony** (Web Push potřebuje HTTPS): `tailscale funnel 5173` dá veřejnou HTTPS adresu. Alternativa je `cloudflared tunnel --url http://localhost:5173`. Funnel je veřejný, proto **admin a úředník jen po přihlášení**.

### Jak to zapojit
1. **Server** (jeden počítač, ideálně ten, ze kterého se bude dělat demo):
   - `cd backend && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000`, **bez `--reload`**.
   - Na Windows povolit port 8000 ve firewallu jen pro rozhraní Tailscale.
   - Vypnout uspávání a připojit nabíječku.
2. **Ostatní** pustí svůj frontend (`npm run dev`) a Vite proxy pošle `/api` na server. Dnes je cíl natvrdo `http://localhost:8000` (`vite.config.ts`). Návrh: cíl z proměnné `CESTY_API_TARGET`, výchozí localhost. Soubor patří k frontendu, změnu dělá Matouš.
3. **Backend se vyvíjí lokálně.** Šimon a Tomáš mají každý vlastní `cesty.db`. Na sdíleném serveru běží jen to, co je na `main`. Nasazení = `git pull` a restart serveru.

### Rizika a jak jim předejít
| Riziko | Co udělat |
|---|---|
| **SQLite ve složce OneDrive.** Repo je u Tomáše v OneDrive. Synchronizace souboru za běhu může databázi poškodit. | Cestu k DB brát z `CESTY_DB_URL` a dát ji mimo OneDrive (např. `C:/cesty/cesty.db`). Zapnout `PRAGMA journal_mode=WAL`. |
| Nikdy neotevírat `.db` přes sdílenou složku nebo síťový disk. | Do DB smí jen proces serveru. Ostatní jdou přes API. |
| **Jeden bod selhání.** Když server spí nebo ztratí Wi‑Fi, ostatní stojí. | Každý umí spustit lokální backend se seedem (S2/S3). Kopie `cesty.db` každou hodinu. |
| `--reload` na serveru a rozdělaná práce | Server běží jen z `main`, žádné úpravy kódu přímo na serveru. |
| Veřejný Funnel nebo tunel | Přihlášení, role na každém endpointu, CORS jen na naše adresy, tajné hodnoty jen v `.env`. |
| Demo závisí na síti | Demo běží přímo na serveru (localhost). Síť potřebují jen telefony poroty. Záložní video. |

**V pitchi:** „Běží u nás na notebooku jako server, nasazení u kraje je další krok“ (kap. 1, bod 12 plánu). SQLite a FastAPI se dají později přesunout na server kraje beze změny kódu.

**Kdo:** Šimon (vlastní `main.py`, `db/`, `.env`) rozhodne, na čí počítač server půjde, a připraví `CESTY_DB_URL` a seed. Tomáš pomůže s Tailscale.
- **15. 10., ~11:00 (Tomáš):** hotové T13 (nové sady Data KHK), T14 (toky studentů), T15 (odříznuté obce + povodeň Q5/Q20/Q100) a T7 (auta za den ze sčítání ŘSD 2025, 1 343 km měřeno, zbytek „odhad“). Riziko č. 3 („★1 nemá data pro aut za den“) je tím **vyřešené**. Metody a návrh endpointů pro Šimona: `docs/BACKEND.md`, kap. 7, „Stav 15. 10., ~10:45“. Další: T16 ukázkové uzavírky 2022.
- **15. 10., ~11:45 (Tomáš):** hotové T16. `engine.demo_closures()` vrací 20 skutečných úplných uzavírek z plánů 2022 (Data KHK) s objížďkou, studenty, auty za den a varováními. Tři doporučené na demo: II/303 Velké Poříčí – Hronov (589 studentů denně), II/302 Broumov (7 909 vozidel, objížďka +14,6 km), III/28526 Jizbice – Náchod (objížďka +33 min). Detail: `docs/BACKEND.md`, „Stav 15. 10., ~11:45“. `backtest_2022()` je NEAKTIVNÍ (přesunuto do `NAPADY.md`). Šimon: S13 `GET /api/demo-closures`.
