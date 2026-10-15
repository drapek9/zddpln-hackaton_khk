# Finální plán: Cesty KHK

Hackathon Královéhradeckého kraje, **čt 15. 10. 2026**. Sestaveno 13. 10. z `PLAN_OD_BIDAKA.md` a ze tří zdrojů:
- poznámky Šimona (data o dopravě),
- review od Matouše (M1–M4),
- rešerše dopravních dat od Tomáše.

`PLAN_OD_BIDAKA.md` byl 15. 10. smazán, aby se neplietl (je v historii gitu: `git show 5ee1fa1:PLAN_OD_BIDAKA.md`). **Platí jen tento soubor.**

**Cesty KHK je webová aplikace** (běží v prohlížeči na počítači i na mobilu). Nativní mobilní aplikaci nestavíme.

## TODO TEĎ: priorita před vším ostatním (15. 10., 15:00, Tomáš)

Platí od 15:00 do odevzdání. Co tu není, má nižší prioritu. Podrobnosti jsou v kap. 22 a 25.

| # | Kdo | Co | Do |
|---|---|---|---|
| 1 | **Tomáš** | Zkušební sloučení `tomas` + `simon` + `matous` do `main` v 15:00, pak 15:30 a 16:00. Po každém `uv run pytest`, `npm run build`, `scripts/smoke_api.sh`. | 15:00, 15:30, 16:00 |
| 2 | **Matouš** | Kap. 25, fáze 1: adresy `/`, `/sprava`, `/admin`. `/admin` bez mapy. **Přihlašovací formulář na `/sprava` i `/admin`, každý s jiným vzhledem** (25.8). Občan: rychlé přihlášení a „Pokračovat bez přihlášení“. | 16:00 |
| 3 | **Matouš + Přemek** | Produkční detaily z 25.9: vlastní stránka 404, 403 a „server nedostupný“, název záložky podle stránky, favicon, stavy načítání a chyb. | 16:00 |
| 4 | **Šimon** | Demo účty `obcan`, `spravce`, `admin` s jednoduchými hesly z `.env` a přihlášení krátkým jménem (25.8, S34). `home` podle role (B‑5). Pak kap. 22 (S27–S32). | 15:45 |
| 5 | **Přemek** | Pitch, PDF/PPTX, záložní video. Ukázka jde přes `/sprava` (★1), `/` (★2), `/admin` (★3). Zkouška ukázky nanečisto na `main` přes tunel v **15:30**. | 16:30 |
| 6 | **Šimon** | Po sloučení S21 spustit `./start-server.command` na Macu, poslat HTTPS adresu do týmového chatu (hesla ne). | 15:30 |
| 7 | **Všichni** | **16:00 feature freeze.** 16:00–17:00 jen opravy chyb, video, zkouška pitche. **17:15 odevzdání** kódu a PDF/PPTX. | 17:15 |

**Škrty, když nestíháme (odspodu):** 3 (kromě stránky 404), stavy načítání, přesměrování podle role. **Neškrtá se:** adresy `/sprava` a `/admin`, oba přihlašovací formuláře, ★1, Zdroje dat, `LICENSE`.

> Co se **hned nedělá** (schválené nápady, V3, Google login, povodeň, Moje obec), je v [NAPADY.md](NAPADY.md). Když se nápad začne dělat, přesune se sem.
>
> Ranní stav a rizika: [docs/STAV_A_DOPORUCENI.md](docs/STAV_A_DOPORUCENI.md) (NEAKTIVNÍ od 15:00, priority určuje tabulka výše).

Čtení: kapitoly 1–3 říkají, co a proč stavíme. Kapitoly 4–9 popisují, jak to postavíme. Kapitoly 10–12 obsahují termíny a otevřené věci. Přehled funkcí a výhod pro uživatele (hotovo / jádro / plán) je v [docs/funkce.html](docs/funkce.html). Když se stav změní, uprav tu stránku a kapitoly 4 a 7.

---

## 0. Rozhodnutí (13. 10., Tomáš)

| Téma | Rozhodnutí |
|---|---|
| Příběh | **Kombinace.** Pilíř 1: pořadí oprav + scénář s rozpočtem. Pilíř 2: dopady uzavírky + objížďky s počty aut. |
| Hvězdy dema (vzniknou na místě) | 1. **Uzavírka + objížďka.** 2. **Občan: můj dům a práce + upozornění.** 3. **Admin + otevřená data.** |
| Backend | **FastAPI + SQLite od rána**, běží na notebooku jednoho z nás. Pro telefony tunel s HTTPS. |
| Role v aplikaci | **Veřejnost** bez přihlášení. **Občan** s přihlášením. **Úředník**: skoro vše, váhy jen pro sebe. **Admin**: vše včetně uživatelů a trvalých vah. |
| AI | Zdůvodnění Top N, třídění hlášení, návrh oznámení o uzavírce, váhy z textu (úředník pro sebe, admin trvale). **AI navrhuje, člověk potvrdí.** |
| Model vs úředník | Pořadí doporučí model a AI. **Volba úředníka má větší váhu** a zapisuje se (kdo, kdy, proč). |
| Hlasování | **Slabý faktor ve skóre.** 1 hlas na občana a úsek. Váhu a strop nastavuje admin. |
| Co vidí občan | Hotové opravy, **potvrzené** plánované opravy, uzavírky. Navíc hlášení a hlasování. |
| Upozornění | **Web Push z prohlížeče** (i na mobilu), záložně e‑mail. **Jen když je to nutné:** nová uzavírka nebo oprava na trase domov ↔ práce/škola. |
| Nová otevřená data | Úseky + sčítání ŘSD, skóre a třídy s popisem metody. Navíc anonymní hlášení a nehody na úsecích, pokud je ověříme. |
| Licence | **EUPL‑1.2** |
| Název | Zatím nerozhodnuto, pracovně „Cesty KHK“. |

---

## 1. Verdikt poroty: co obstojí a co nás potopí

Posuzujeme jako porota: veřejná správa, Data KHK, NKÚ, MF a FIM.

### Silné stránky
- **Dopady uzavírky:** nemocnice, IZS, školy ve školním roce, zaručené přípoje, zimní údržba. Nikdo jiný to mít nebude. Sedí to na kritérium „využití pro kraj“.
- **Objížďka s počtem aut:** kraj ani RoadMapper (2022) nic takového nemají.
- **Poctivost:** simulace jsou označené, stránka Zdroje dat existuje, člověk má poslední slovo.
- Hodně datových sad a každá má jasný účel.

### Slabiny a co na ně připravit

| # | Výtka poroty | Naše odpověď |
|---|---|---|
| 1 | „Proč by kraj věřil vašemu skóre? Váhy jste si vymysleli.“ | Výchozí váhy jsou expertní odhad, admin je ladí. Model jen doporučuje, úředník rozhoduje a vše se zapisuje. Zpětná kontrola modelu je nápad na později ([NAPADY.md](NAPADY.md)). |
| 2 | „Kraj má peníze na 90 km ročně.“ To je nepravda. | Říkat: **„kraj v letech 2015–2024 opravoval zhruba 90 km ročně“** (906 km / 10 let). Je to tempo, ne rozpočet. (Matouš M1.2) |
| 3 | „~15 let“ je optimistické. | Říkat **„nejméně 15 let“**. Výpočet předpokládá, že všechny opravy jdou na havarijní úseky a že se nic dalšího nezhorší. (Matouš M1.3) |
| 4 | Jeden bod se započítá na mnoha úsecích. | **Ověřeno v kódu.** `scripts/fetch-data.mjs` (ř. ~397, `nearby(poiGrid, g, 450)`) přiřadí nemocnici či školu každému úseku do 450 m. Oprava: bod započítat jen k nejbližším úsekům, nebo váhu snižovat se vzdáleností. (Matouš M1.6) |
| 5 | Stavy Navrženo → Probíhá jsou vymyšlené. | Ve veřejném pohledu jen skutečné opravy a ty, které úředník v aplikaci potvrdí. Demo data mají štítek **„demo data“**. (Matouš M1.5) |
| 6 | Kód vznikl před soutěží. | Napsat organizátorům a mít odpověď **písemně**. V pitchi říct, co bylo připravené a co vzniklo na místě. Hvězdy dema vzniknou na místě. (Matouš M1.4) |
| 7 | „Auta v datech nemáte.“ | V Data KHK opravdu nejsou (Šimon). Doplňujeme je ze **sčítání ŘSD 2025**, které pokryje ~44 % km. Zbytek je odhad a v aplikaci je tak označený. Nikdy neříkat „živý provoz“. |
| 8 | Hlasování = populismus a manipulace. | Slabá váha, strop, 1 hlas na přihlášeného občana a úsek. Admin ho může vypnout. |
| 9 | Osobní údaje (domov, práce, fotky). | Domov a práci ukládat jen jako bod, ne jako adresu. Export bez osobních údajů. Foto je volitelné. V pitchi jedna věta o GDPR. (Matouš M1.9) |
| 10 | AI rozhoduje o veřejných penězích. | AI nepočítá pořadí, jen vysvětluje a navrhuje. U každého textu je štítek „návrh AI“ a vedle jsou skutečné faktory. (Matouš M2.7) |
| 11 | Prompt injection přes hlášení. | Text od občana jde do AI jen k roztřídění. Výstup je pevná struktura (typ, závažnost, úsek), nic se z něj nespouští. (Matouš M1.11) |
| 12 | „Server kraje“ je ve skutečnosti notebook. | Říkat „běží u nás na notebooku, nasazení u kraje je další krok“. (Matouš M3.8) |
| 13 | RoadMapper už vyhrál. | Ověřeno v `docs/ROZBOR.md`, vítěz 2022. Mapa stavu je jen základ. Novinka je pořadí, uzavírky, objížďky a občan. |

---

## 2. Příběh a pitch (5 min)

**Jedna věta:** *Kraj opravuje zhruba 90 km silnic ročně a havarijních je 1 375 km. Ukážeme, co opravit dřív, jak to uzavřít s nejmenší škodou a jak se o tom lidé dozví.*

| Čas | Co | Hvězda |
|---|---|---|
| 0:00–0:30 | **Příběh:** konkrétní obec. Uzavírka silnice III. třídy, autobus do školy jede jinudy, sanitka objíždí 9 km. Čísla: 1 375 km, ~90 km/rok, nejméně 15 let. | |
| 0:30–2:00 | **Úředník:** scénář „letos 90 km“ dá seznam úseků. Pak AI zdůvodnění a připíchnutí priority s důvodem. Hlavní část: **zavřu úsek** a uvidím objížďku na mapě, +km/min, aut za den, školy, přípoje, IZS a návrh oznámení. | ★ 1 |
| 2:00–3:15 | **Občan na webu v mobilu:** přihlásím se a zadám dům a práci. Úředník potvrdí uzavírku a **prohlížeč na telefonu ukáže upozornění (Web Push)**. Nahlásím výtluk a zahlasuji. | ★ 2 |
| 3:15–4:15 | **Admin + data:** trvalé váhy (i z textu přes AI), audit změn. **Veřejné API a export** jako nová otevřená data pro Data KHK, stránka Zdroje dat. | ★ 3 |
| 4:15–5:00 | Co bylo připravené a co vzniklo dnes. Rozvoj: skutečný plán investic kraje, nehody, nasazení. | |

Demo běží podle scénáře se záložním videem. Porota může otevřít web přes QR kód (Matouš M2.5).

---

## 3. Uživatelé a co od webové aplikace chtějí

| Role | Přihlášení | Co může |
|---|---|---|
| Veřejnost | ne | mapa oprav a uzavírek, moje obec či linka, Zdroje dat, API |
| Občan | ano (e‑mail + heslo, testovací účty ze seed souboru) | dům a práce/škola, moje trasa, upozornění, hlášení, hlasování |
| Úředník | ano | vše pro práci s úseky. **Váhy mění jen pro svůj pohled.** |
| Admin | ano | vše včetně uživatelů, **trvalých vah**, vah z AI, váhy hlasování, auditu a exportu |

---

## 4. Webová aplikace v ideálním případě (obrazovka po obrazovce)

**NEAKTIVNÍ sloupec „Stav“ (15:00):** stav je z rána 15. 10., od té doby je většina hotová. Aktuální stav je v [docs/funkce.html](docs/funkce.html), cílová podoba obrazovek je v kap. 25.

Stav k ránu **15. 10. 2026**. ✅ = uživatel to má v aplikaci, ◉ = výpočet je hotový a obrazovka chybí, ◐ = částečně, ❌ = chybí. Priorita: **MVP** / V2 / V3 (viz kap. 8). Stejný přehled po výhodách pro uživatele je v [docs/funkce.html](docs/funkce.html).

### A) Veřejnost
| Obrazovka | Obsah | Stav | Priorita |
|---|---|---|---|
| Úvod | Problém v číslech, vstup do mapy, „Moje obec“, přihlášení | ◐ (Landing) | MVP |
| Mapa | Stav úseků, hotové opravy, **potvrzené** plány, **uzavírky** (ŘSD SRTI a od úředníka), objížďky | ◐ | MVP |
| Moje linka | „Jede můj autobus?“ (Moje obec je v [NAPADY.md](NAPADY.md)) | ◐ | V2 |
| Zdroje dat | Všechny datové sady s odkazy a licencemi, včetně ŘSD a Policie | ✅ (doplnit nové) | MVP |
| API dokumentace | Česky: endpointy, licence, příklad | ❌ | MVP (★3) |

### B) Občan
| Obrazovka | Obsah | Stav | Priorita |
|---|---|---|---|
| Registrace a přihlášení | E‑mail + heslo | ❌ | MVP (★2) |
| Moje místa | Domov + práce nebo škola, kliknutím do mapy nebo hledáním adresy. Uloží se jen bod. | ❌ | MVP (★2) |
| Moje trasa | Nejkratší trasa domov ↔ práce po grafu silnic: stav úseků, uzavírky a opravy na trase | ◉ (`Engine.route`, obrazovka chybí) | MVP (★2) |
| Upozornění | Povolit push, záložní e‑mail, seznam upozornění na webu. Pravidlo v kap. 6. | ❌ | MVP (★2) |
| Hlášení závady | Bod na mapě, typ, popis, foto volitelně. AI navrhne typ a úsek. | ◐ (localStorage) | V2 |
| Hlasování | „Opravte tohle“, 1 hlas na úsek | ❌ | V2 |

### C) Úředník
| Obrazovka | Obsah | Stav | Priorita |
|---|---|---|---|
| Žebříček + mapa | Top N, filtry, 4 třídy priority, štítek stability (v Top N při jakýchkoli rozumných vahách) | ◐ (žebříček v aplikaci; 4 třídy jen v jádru; stabilita chybí) | MVP |
| Váhy | Posuvníky pro svůj pohled. **Váhy z textu přes AI**: AI navrhne, úředník potvrdí. | ◐ (posuvníky) | V2 (AI) |
| Rozpočtový asistent | Zadám rozpočet v Kč. Dostanu souvislé stavby, které se vejdou, a kolik havarijních km zůstane. Cena za km je **předpoklad**. Podrobně v [NAPADY.md](NAPADY.md), č. 1. | ❌ | V2 |
| Detail úseku | Rozpad skóre, třída, AI zdůvodnění, historie, opravy, intenzita (nebo „odhad“), hlášení, hlasy | ◐ | MVP |
| Připíchnutí | Priorita ručně + důvod (rychlé volby nebo text). Má přednost před modelem a zapisuje se. | ◉ (pořadí v jádru, obrazovka, důvod a zápis chybí) | MVP |
| Stav práce | Navrženo → Schváleno → Naplánováno (termín) → Probíhá → Hotovo. Od „Schváleno“ to vidí veřejnost. | ◐ (zveřejnění opravy v prohlížeči, workflow chybí) | MVP |
| **Simulátor uzavírky** | Vyberu úsek a termín. Uvidím objížďku na mapě, +km a +min, auta za den, kolik občanů má úsek na trase. Varování: škola ve školním roce, nemocnice a IZS, zaručené přípoje, zima, objížďka přes havarijní úsek. AI napíše návrh oznámení. Tlačítko „Potvrdit uzavírku“ pošle upozornění. | ◐ varování, šablona oznámení a zveřejnění opravy v aplikaci; ◉ objížďka v jádru, na mapě ne | **MVP (★1)** |
| Fronta hlášení | Hlášení od občanů, AI roztřídění, sloučení k úseku, vyřízení | ❌ | V2 |

### D) Admin
| Obrazovka | Obsah | Stav | Priorita |
|---|---|---|---|
| Uživatelé | Seznam, role, zablokování | ❌ | MVP (★3) |
| Trvalé váhy | Výchozí váhy pro všechny + **AI z textu**, váha a strop hlasování | ❌ | MVP (★3) |
| Audit | Kdo, kdy a co změnil (připíchnutí, váhy, stavy, uzavírky) | ❌ | MVP (★3) |
| Otevřená data | Export CSV a GeoJSON s metadaty (popis sloupců, licence, datum výpočtu) (Matouš M2.9) | ❌ | MVP (★3) |
| Nastavení AI | Poskytovatel, zapnuto či vypnuto, fallback | ❌ | V2 |

---

## 5. Data

### Máme (Data KHK, 18 sad, v1)
Stav povrchu, opravy (liniové i bodové), zimní údržba, autobusové linky, zastávky IREDO, zaručené přípoje, železniční zastávky, nemocnice, lékaři, ZZS, HZS, Policie, školy, sociální služby, průmyslové zóny, HSOO.

**Šimon ověřil 13. 10.:**
- 197 linek, 4 538 zastávek, 3 515 přípojů.
- Linka vede po 1 842 z 1 993 úseků.
- Frekvence spojů v datech není. **Auta ani nehody v datech nejsou.**

Snímek dat je v repu (`public/data/*.json`, ověřeno), demo tedy nezávisí na ArcGIS (Matouš M2.6).

### Doplníme
| Data | Licence | K čemu | Jistota |
|---|---|---|---|
| **ŘSD sčítání 2025** (XLSX, [rsd.cz](https://www.rsd.cz/silnice-a-dalnice/scitani-dopravy)) | CC BY‑SA 4.0 | auta za den na úseku, objížďka, export | párování podle čísla silnice a názvů míst, ~1 418 z 3 192 km. Zbytek odhadneme podle třídy silnice a linek, štítek „odhad“. |
| **ŘSD SRTI** ([NKOD](https://data.gov.cz/datová-sada?iri=https://data.gov.cz/zdroj/datové-sady/65993390/1087749998)) | CC BY 4.0 | skutečné uzavírky a stavby na mapě, varování pro občany | ~140 záznamů v KHK, hlavně silnice I. třídy |
| **Silnice I. třídy** (OSM, nebo ŘSD) | ODbL (OSM) | doplnění grafu pro objížďky a trasy | nutné, jinak graf nebude spojitý. OSM uvést ve Zdrojích (ODbL = uvést autora a sdílet za stejných podmínek). |

**Pravidla:**
- Každý zdroj na stránce Zdroje dat s odkazem.
- Export odvozený z dat ŘSD musí mít licenci CC BY‑SA.
- **Nepoužít:** NDIC/JSDI (nutná registrace), Waze, Google, TomTom, mýtná data.

---

## 6. Jak to funguje uvnitř

### Skóre a priorita
1. **Skóre 0–100.** Faktory z v1 (`src/lib/priority.ts`). Nové faktory:
   - **intenzita** (auta za den),
   - **délka objížďky**,
   - **hlasy** (slabá váha, strop).
   - Nehody jsou v [NAPADY.md](NAPADY.md).
2. Oprava započítání bodů (kap. 1, č. 4).
3. **4 třídy:** Kritická, Vysoká, Střední, Nízká, podle percentilů.
4. **Pořadí pravidel:** připíchnutí úředníkem > váhy úředníka (jeho pohled) > trvalé váhy admina > výchozí váhy.
5. **Štítek stability:** skóre přepočítat pro ~50 náhodných sad vah v rozumném rozsahu. Úseky, které zůstanou v Top N téměř vždy, označit „jisté“ (Matouš M2.2).

### Objížďka
- **Předem** (Python, `networkx`): graf z geometrií Stavu povrchu + silnice I. třídy.
  - Uzly = konce úseků spojené v toleranci ~20 m.
  - Hrana nese délku a odhad rychlosti podle třídy.
- **Při dotazu:** úsek z grafu odebrat a spustit Dijkstru mezi jeho konci.
  - Vrátí geometrii, +km a +min, auta za den.
  - Varuje, pokud objížďka vede přes havarijní úseky, kolem škol a po trasách linek.
- **Poctivě:** model posílá všechna auta jednou nejkratší objížďkou.
- **Riziko:** graf může mít díry. Proto ho postavit a otestovat **před** demo scénářem a mít 2–3 ověřené ukázkové uzavírky.

### Trasa občana a upozornění
- Trasa domov ↔ práce se počítá na stejném grafu a uloží se jako seznam úseků.
- **Push, jen když je to nutné:** úředník potvrdí uzavírku nebo opravu (stav Naplánováno či Probíhá) na úseku, který je na trase občana.
  - Max 1 upozornění na událost.
  - Žádné souhrny.
  - Nepřečtená upozornění zůstanou v seznamu na webu.
- Push: Web Push přes service worker, klíče VAPID jen v `.env`. Prohlížeč na telefonu potřebuje HTTPS, proto **tunel** (cloudflared nebo ngrok) na notebook s backendem.
- E‑mail jako záloha: testovací SMTP (Mailpit) a náhled na webu. Skutečné odeslání jen pokud bude čas.

### AI (pořadí podle potřeby)
1. **Zdůvodnění Top N:** text z faktorů. Fallback je šablona.
2. **Návrh oznámení o uzavírce:** rozšíří dnešní `src/lib/announce.ts`.
3. **Váhy z textu:** AI navrhne změny posuvníků a člověk je potvrdí. Úředník pro sebe, admin trvale.
4. **Třídění hlášení:** výstup jen v pevné struktuře.

Jedno rozhraní pro poskytovatele AI. **Když AI nejede, aplikace funguje dál.** Klíč jen v `.env`.

### Architektura
```
[React + Vite + MapLibre (v1)]  ──HTTPS (tunel)──▶  [FastAPI]  ──▶  [SQLite]
                                                     ├─ skóre, třídy, stabilita
                                                     ├─ graf silnic (networkx, předpočítaný)
                                                     ├─ AI (jedno rozhraní + fallback)
                                                     ├─ Web Push + e‑mail
                                                     └─ veřejné API + export
```
- **Veřejné API:**
  - `GET /api/useky` (GeoJSON se skóre, třídou, stavem a intenzitou)
  - `GET /api/uzavirky`
  - `GET /api/statistiky`
  - `GET /api/export.csv|.geojson` (s metadaty)
- Repo je veřejné: žádné klíče do gitu, do repa jen `.env.example`.

---

## 7. Stav k ránu 15. 10.

**NEAKTIVNÍ (15:00):** ranní stav. Aktuální je [docs/funkce.html](docs/funkce.html) a kap. 21–25.

Přehled po funkcích a výhodách pro uživatele je v [docs/funkce.html](docs/funkce.html). Tahle tabulka je totéž po oblastech. Když se něco dodělá, uprav obojí.

| Oblast | V aplikaci | V jádru, uživatel to nevidí | Chybí |
|---|---|---|---|
| Data | 18 sad Data KHK, celá síť | silnice I. třídy a dálnice z OSM v grafu (objížďka u 81,5 % úseků) | ŘSD 2025, SRTI, nehody, oprava započítání bodů do 450 m, sady z kap. 13 |
| Skóre | 10 vah, rozpad, žebříček, posuvníky v sezení | stejné skóre v Pythonu, 4 třídy, pořadí s připíchnutím | stabilita, intenzita, hlasy v aplikaci, váhy uložené podle role |
| Úředník | žebříček, mapa, detail, varování, šablona oznámení, zveřejnění opravy v prohlížeči | objížďka (+km, +min, asi 2 ms) | objížďka na mapě, auta za den, potvrzení uzavírky, připíchnutí na obrazovce, stavy práce, scénář, fronta hlášení |
| Veřejnost a občan | mapa, hledání, „Můj autobus“, hlášení v prohlížeči, Zdroje dat | trasa mezi dvěma body | účet, místa, trasa na obrazovce, push, hlasování, skutečné uzavírky |
| Admin | — | — | uživatelé, trvalé váhy, audit, export, dokumentace API |
| Backend | — | FastAPI kostra, `Engine`, `/api/health` | SQLite, přihlášení, ostatní endpointy |
| AI | šablona oznámení | — | zdůvodnění, váhy z textu, třídění hlášení, fallback |
| Pravidla | Zdroje dat, štítek simulace, `LICENSE` EUPL‑1.2 | — | nové zdroje na stránce Zdroje |

---

## 8. Vlny a co škrtáme

**MVP (musí jet v 16:00):**
1. Backend s přihlášením a 4 rolemi, data z `public/data` načtená do SQLite.
2. ★1 Simulátor uzavírky s objížďkou, auty za den a varováními. Potvrzení uzavírky.
3. ★2 Občan: účet, domov a práce, moje trasa, push při potvrzené uzavírce na trase. E‑mail a seznam upozornění na webu jako záloha.
4. ★3 Admin: uživatelé, trvalé váhy, audit, veřejné API a export s metadaty.
5. Žebříček se 4 třídami, připíchnutí s důvodem, stavy práce.
6. Stránka Zdroje dat (nové zdroje) a štítky „demo data“ a „odhad“. `LICENSE` EUPL‑1.2 už je.

**V2:**
- AI: zdůvodnění, oznámení, váhy z textu.
- Rozpočtový asistent ([NAPADY.md](NAPADY.md), č. 1).
- Hlášení s AI tříděním.
- Hlasování.

**V3 a další nápady:** v [NAPADY.md](NAPADY.md). Nedělají se, dokud nejede MVP a V2.

**Pořadí škrtů, když nestíháme** (rozhodnout v 12:00, ne v panice):
1. Všechno z NAPADY.md.
2. Hlasování.
3. Rozpočtový asistent.
4. AI váhy z textu (posuvníky zůstanou).
5. Push nahradí seznam upozornění na webu + náhled e‑mailu.

**Nikdy neškrtat:** ★1, Zdroje dat, `LICENSE`.

---

## 9. Příprava před čtvrtkem

**NEAKTIVNÍ (15. 10.):** přípravná fáze skončila, `LICENSE` je hotový. Otevřené body (odpověď organizátorů, AI klíč, Web Push na telefonu, ukázkové uzavírky, pitch) jsou v kap. 11 a v [docs/STAV_A_DOPORUCENI.md](docs/STAV_A_DOPORUCENI.md). Sčítání ŘSD je úkol T7, nehody jsou v [NAPADY.md](NAPADY.md).

---

## 10. Harmonogram 15. 10.

| Čas | Co | Kdo |
|---|---|---|
| 8:00–9:00 | registrace, prostředí, Wi‑Fi, tunel, AI klíč | |
| 9:00–9:30 | **dohoda o rozhraní:** API endpointy, tvar dat, kdo vlastní který soubor | všichni |
| 9:30–12:00 | backend + přihlášení, graf + objížďka, obrazovka simulátoru, účet občana | |
| 12:00–12:30 | oběd + sync: co jede, co škrtáme (kap. 8) | všichni |
| 12:30–15:00 | trasa občana + push, admin + export, třídy + připíchnutí, AI | |
| 15:00–16:00 | V2 podle času, Zdroje dat, štítky; jeden člověk dělá jen pitch | |
| **16:00** | **feature freeze** | |
| 16:00–17:00 | stabilizace, záložní video, zkouška pitche | |
| 17:00–17:15 | odevzdání kódu + PDF/PPTX | |

---

## 11. Otevřené otázky

1. **Název aplikace.**
2. ~~**Nehody**~~ přesunuto do [NAPADY.md](NAPADY.md).
3. ~~**Cena za km opravy**~~ vyřešeno 15. 10.: předpoklad podle stavu se zdroji, viz [NAPADY.md](NAPADY.md), č. 1.
4. **Odpověď organizátorů** ke kódu připravenému předem.
5. ~~**Poskytovatel AI**~~ vyřešeno: Šimon, `AI_PROVIDER` v `.env`, šablona jako záloha (kap. 14.2).
6. Kdo po soutěži pohlídá odevzdání na `github.com/krhk`?
7. ~~Role~~ vyřešeno: kap. 15 a 25.

---

## 12. Odkud co je

- Šimonovy poznatky o datech: `PLAN_OD_BIDAKA.md` (smazaný, v historii gitu), kap. 6 a otázka 4a.
- Matoušovo review M1–M4: `PLAN_OD_BIDAKA.md` (smazaný, v historii gitu), kap. 13.
- Rešerše dopravních dat: `PLAN_OD_BIDAKA.md` (smazaný, v historii gitu), kap. 6, „Zdroje dopravních dat a pravidla“.
- Pravidla, porota a minulí vítězové: `docs/ROZBOR.md`.

---

## 13. Doplněk 15. 10.: víc dat z Data KHK (další kroky)

**Nové pravidlo:** smíme použít jakákoli otevřená data, ale aspoň jedna sada musí být z kraje. To už splňujeme: bereme 18 sad z Data KHK. Kapitoly 0–12 platí beze změny. Tohle jsou **další kroky po MVP**.

**Proč:** Data KHK má 244 služeb a my používáme 18. Porota je z velké části z Data KHK. Čím víc stavíme na datech kraje, tím líp. Externí data (ŘSD, SRTI, OSM) zůstávají jako doplněk.

### Nepoužité sady Data KHK, které se vyplatí (ověřeno dotazem 15. 10.)
| Sada | Záznamů | Co obsahuje | K čemu |
|---|---|---|---|
| `Dojížďka_do_středních_škol` | 12 013 | obec bydliště studenta → škola (souřadnice), počet žáků | Toky pustíme po grafu silnic. Ke každému úseku dostaneme **počet středoškoláků, kteří po něm denně jedou**. Měřená data, ne odhad. |
| `Obce` | 448 | kód obce, počet obyvatel, věkové skupiny | Které obce uzavírka **odřízne** a kolik v nich žije lidí. Napojení toků studentů na obce. „Moje obec“. |
| `Plánované_opravy_silniční_infrastruktury_na_rok_2022_liniové` | 23 | typ uzavírky (úplná/částečná), termín omezení, číslo silnice | **Skutečné uzavírky** jako ukázky pro demo. |

Vynecháváme `Omezení_v_autobusové_dopravě` (4 záznamy) a `Výluky_v_železniční_dopravě` (1 záznam). Jsou staré (2022–23) a je jich málo.

### Co to přidá
- **★1 karta uzavírky:** navíc „zasaženo N středoškoláků denně“ a „odříznuté obce: X obyvatel“.
- Povodeň Q100 a ověření modelu na plánech 2022 jsou v [NAPADY.md](NAPADY.md).
- **Demo:** 2–3 ukázkové uzavírky vybrat ze skutečných úplných uzavírek 2022.
- **Pitch:** „22 sad z Data KHK a 3 externí. Z dat kraje víme, kolik středoškoláků denně jede přes každý úsek.“

### Poctivě (říct na dotaz)
- Toky jsou jen středoškoláci, ne všichni lidé.
- Start je střed obce bydliště, cesta je nejkratší po grafu, ne skutečná trasa autobusu.

### Priorita
Pořadí: toky studentů → odříznuté obce → ukázky 2022 (rozhodnuto 15. 10.: Tomáš dělá hned, je to datový základ ★1). Když nestíháme, škrtá se **před** V2. Úkoly: Tomáš T13–T16, Šimon S12–S13 v `docs/BACKEND.md`, kap. 7.

---

## 14. Zkratky pro Tomáše a Šimona: přesné odkazy a AI (15. 10.)

Hotové podklady, ať se nic nemusí dohledávat. Kapitoly 0–13 platí.

### 14.1 Data: přesné odkazy

**Data KHK (ArcGIS REST).** Základ pro všechny sady:
`https://services6.arcgis.com/ogJAiK65nXL1mXAW/arcgis/rest/services/<Název_sady>/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`
Stránka sady pro „Zdroje dat“: `https://www.datakhk.cz/datasets/<itemId>_0`. Stránkování: `resultOffset` + `resultRecordCount=2000` (už umí `scripts/fetch_khk_extra.py`).

| Sada | itemId (stránka na Data KHK) | Kdo, kde |
|---|---|---|
| `Stav_povrchu_silnic` | [311df195461541069a5690e9491eb092](https://www.datakhk.cz/datasets/311df195461541069a5690e9491eb092_0) | Tomáš, `scripts/fetch-data.mjs` (hotovo) |
| `Dojížďka_do_středních_škol` | [c62b3bf8a0dd40b4b1d70bc419d5d6e4](https://www.datakhk.cz/datasets/c62b3bf8a0dd40b4b1d70bc419d5d6e4_0) | Tomáš T13–T14, `scripts/fetch_khk_extra.py` |
| `Obce` | [70564613fe434f149655e79a85e94efc](https://www.datakhk.cz/datasets/70564613fe434f149655e79a85e94efc_0) | Tomáš T13, T15; Šimon S13 |
| `Plánované_opravy_silniční_infrastruktury_na_rok_2022_liniové` | [1915aa2911d74672a6ab58d5b615055b](https://www.datakhk.cz/datasets/1915aa2911d74672a6ab58d5b615055b_0) | Tomáš T16; Šimon S13 |
| `Záplavové_území_stoleté_vody` (+ pětileté, dvacetileté) | [7d93751a3221478ca39a6e1ca6578047](https://www.datakhk.cz/datasets/7d93751a3221478ca39a6e1ca6578047_0) | jen [NAPADY.md](NAPADY.md) č. 7 |
| `Výjezdové_základny_zdravotnické_záchranné_služby` | [1c28da5d644445d3a5f4b578ce22ed40](https://www.datakhk.cz/datasets/1c28da5d644445d3a5f4b578ce22ed40_0) | varování IZS, NAPADY č. 2 |
| `Stanice_a_pracoviště_hasičského_záchranného_systému` | [3ff2f49c7f454870baf51628403ace6e](https://www.datakhk.cz/datasets/3ff2f49c7f454870baf51628403ace6e_0) | varování IZS, NAPADY č. 2 |

Ostatní sady v1 (názvy služeb) jsou v `LAYERS` v `scripts/fetch-data.mjs`. Katalog kraje pro DCAT: `https://open.datakhk.cz/katalog.jsonld`.

**Externí:**
| Zdroj | Odkaz | Licence | Kde v kódu |
|---|---|---|---|
| ŘSD sčítání 2025 (XLSX) | `https://www.rsd.cz/documents/38144/3734982/V2_CSD_2025_20260826.xlsx/`, stránka `https://www.rsd.cz/silnice-a-dalnice/scitani-dopravy` | CC BY-SA | `scripts/fetch_rsd_counts.py` → `public/data/intensity.json` (T7, běží) |
| ŘSD SRTI uzavírky | [NKOD](https://data.gov.cz/datová-sada?iri=https://data.gov.cz/zdroj/datové-sady/65993390/1087749998) | CC BY 4.0 | zatím nic; když bude čas, Šimon jako `GET /api/uzavirky?zdroj=srti` |
| OSM silnice I. třídy | `https://overpass-api.de/api/interpreter` | ODbL (uvést „© přispěvatelé OpenStreetMap“) | `scripts/fetch_osm_roads.py` → `public/data/osm_roads.json` |

Každý řádek obou tabulek musí být na stránce „Zdroje dat“ (Matouš) s licencí a odkazem.

### 14.2 AI: co, kde, kdo

**NEAKTIVNÍ (15. 10., 10:45):** Šimon má AI hotovou po svém na větvi `simon` (`backend/app/ai/service.py`, `/api/ai/explain|announcement|weights`, šablona jako záloha, `nearest_road_id`). Návrh níže je jen pro srovnání, neimplementovat.

Původní návrh (provider, prompty, cache) smazán při revizi plánu 15:00, je v historii gitu (`git show 279f467:PLAN_FINAL.md`, kap. 14.2). Pravidla AI platí dál: AI nemění skóre ani pořadí, každý text má štítek „návrh AI“ a potvrzuje ho člověk.

---

## 15. Přihlášení: landing, login, role a token (15. 10., Tomáš)

**Proč:** v kap. 3 a 4 jsou role i „Registrace a přihlášení“, ale chybí, jak to uživatel projde krok za krokem. Backend už to umí (Šimon, větev `simon`). Chybí frontend (Matouš) a dohoda, jak se to propojí.

### 15.1 Co uživatel uvidí
1. **Landing page** (`Landing.tsx`). Dvě hlavní volby:
   - **„Pokračovat bez přihlášení“** → veřejná mapa (role Veřejnost). Nic se neukládá na server.
   - **„Přihlásit se“** → login formulář.
   - Dnešní dvě karty „Správa silnic“ a „Veřejný přehled“ zůstanou, jen „Správa silnic“ nejdřív vyžádá přihlášení.
   - **NEAKTIVNÍ (15. 10. odpoledne):** karty nahradil úvod rozdělený napůl, vlevo název a popis, vpravo přihlášení. Podrobně v [docs/FRONTEND.md](docs/FRONTEND.md), „Rozhodnutí týmu k rozhraní“ (R1–R6).
2. **Login formulář:** e‑mail, heslo, tlačítko „Přihlásit“. Pod ním odkaz „Nemám účet → registrace“ (jen pro občany). Chybová hláška z backendu se ukáže pod formulářem („Špatný e‑mail nebo heslo.“, „Účet je zablokovaný.“).
3. **Po přihlášení** frontend podle role otevře správnou obrazovku:
   | Role v DB | Česky | Kam ho pošleme | Co může |
   |---|---|---|---|
   | `citizen` | Občan | veřejná mapa + „Moje místa“, „Moje trasa“, upozornění | hlášení, hlas, odběr push |
   | `official` | Úředník | Správa silnic | žebříček, piny, simulátor uzavírky, váhy jen pro sebe |
   | `admin` | Admin | Správa silnic + záložka Admin | vše, uživatelé, trvalé váhy, audit, AI |
4. V hlavičce je pak e‑mail a role uživatele a tlačítko „Odhlásit“.

### 15.2 Odkud se berou role
- **Dnes role přidělujeme ručně v databázi.** Nikdo si roli nevybírá sám.
- Při prvním startu backend založí testovací účty (`backend/app/db/seed.py`, funkce `seed_if_empty`): 1 admin, 1 úředník, 2 občané s doménou `@cesty-khk.test`. Hesla jsou jen pro demo; na pitchi je neukazujeme.
- **Registrace** (`POST /api/auth/register`) vždy vytvoří roli `citizen`. Úředníka nebo admina z ní udělat nejde.
- Změna role: admin přes `PATCH /api/admin/users/{id}` (obrazovka Uživatelé, kap. 4 D). Do té doby ručně v SQLite: `UPDATE user SET role='official' WHERE email='…';`.

### 15.3 Jak funguje token (krok za krokem)
1. Frontend pošle `POST /api/auth/login` s `{email, password}`.
2. Backend najde uživatele a ověří heslo. Hesla jsou v DB jen jako hash (PBKDF2‑SHA256, 120 000 kol, sůl). Heslo samo se nikde neukládá.
3. Backend vytvoří **JWT token** (HS256, podepsaný `CESTY_SECRET_KEY` z `.env`). Uvnitř je: id uživatele (`sub`), role (`role`), verze tokenu (`ver`) a platnost 7 dní (`exp`).
4. Backend token uloží do **httpOnly cookie** `cesty_session` (`SameSite=Lax`, na HTTPS i `Secure`) a zároveň vrátí `{token, user: {id, email, role}}`.
5. Frontend si z odpovědi vezme jen `user` (role, e‑mail) a přepne obrazovku. **Token neukládá do localStorage.** Prohlížeč posílá cookie sám ke každému `/api/...` volání (stejný původ přes Vite proxy nebo tunel).
6. Při načtení stránky frontend zavolá `GET /api/auth/me`. Když vrátí uživatele, je přihlášený (přežije to obnovení stránky). Když vrátí 401, ukáže landing.
7. Backend u každého chráněného endpointu token ověří (`auth/deps.py`: `require_user`, `require_official`, `require_admin`, `require_citizen`). Špatná role = 403, bez tokenu = 401.
8. **Odhlášení** `POST /api/auth/logout` smaže cookie a zvýší `token_version`. Tím přestanou platit i staré kopie tokenu.

### 15.4 Kdo co udělá
**NEAKTIVNÍ (15:00):** hotovo (login, registrace, cookie, role). Podoba přihlášení podle adresy je v kap. 25.8.

| Kdo | Co | Stav |
|---|---|---|
| Šimon | `api/auth.py`, `auth/security.py`, `auth/deps.py`, `db/seed.py` | ✅ hotovo na větvi `simon`, čeká na sloučení do `main` |
| Šimon | Sloučit `simon` do `main` a poslat Matoušovi tvar odpovědí (`/auth/login`, `/auth/me`) | ❌ |
| Matouš | Landing se dvěma volbami, login a registrace, `src/lib/auth.ts` (`login`, `logout`, `me`), přepnutí obrazovky podle role, „Odhlásit“ v hlavičce | ❌ |
| Matouš | Volání `/api/...` s `credentials: "same-origin"`, při 401 zpět na login | ❌ |
| Tomáš | Nic v jádru; role ani token se `Engine` netýkají | — |

### 15.5 Na co pozor
- **Úředník bez přihlášení:** dokud login ve frontendu není, `POST /api/closures` vrací 401. Simulátor proto dál používá snímek `public/demo/detours.json`. Po loginu přepnout na API.
- **Demo:** pro pitch mít 2 záložky: úředník přihlášený v počítači, občan v telefonu (Web Push). Přihlásit předem, ne před porotou.
- **Bezpečnost (repo je veřejné):** `CESTY_SECRET_KEY` jen v `.env`, na sdíleném serveru jiný než `change-me-dev-only`. Demo hesla v `seed.py` jsou jen pro doménu `.test`; před ostrým nasazením změnit.
- Ostrá varianta po hackathonu (zatím jen nápad): přihlášení přes NIA / identitu občana, role z adresáře kraje.

---

## 16. Sloučení do `main` ve 12:00

**Splněno a smazáno při revizi plánu 15:00.** Text je v historii gitu (`git show 279f467:PLAN_FINAL.md`, kap. 16). Nové metody `Engine` jsou v `docs/BACKEND.md`, kap. 7.

---

## 17. Rozbor nápadů a rozdělení práce po 12:00 (15. 10., ~11:05, Tomáš)

Tomáš prošel všech 19 nápadů z [NAPADY.md](NAPADY.md) a rozhodl. Kap. 16 (sloučení do 12:00) má přednost. Tohle je práce **po sloučení**. Pořadí v každém seznamu = priorita. Škrtá se odspodu.

### 17.1 Rozhodnutí
| Nápad | Rozhodnutí | Proč |
|---|---|---|
| 1 Rozpočtový asistent + 15 porovnání dvou částek | **do plánu** | Silné pro porotu z ekonomické gesce. PDF (16) zůstává v NAPADY. |
| 2 Dojezd ZZS + HZS | **do plánu jako varování** na kartě uzavírky | Porota z krizového řízení. Graf už máme. |
| 3 Kolize uzavírek | **do plánu jako varování** | Malé. Časová osa (14) zůstává v NAPADY. |
| 4 DCAT‑AP‑CZ + 19 názvy stavů v exportu | **do plánu** | Porota je z Data KHK. |
| 5 Bezpečnost a GDPR | **do plánu** (patička, souhlas, rate limit) | Porota se zeptá. |
| 6 QR na poslední slajd | **do plánu** pro pitch | Jen když mobil v 16:00 funguje. |
| 7 Povodeň Q5/Q20/Q100 | **do plánu** | Jádro i API jsou hotové, chybí jen tlačítko a mapa. |
| 8 Ověření modelu | **zkusit** | Ukázat jen když vyjde dobře. |
| 11 Moje obec | **do plánu** | Widget (12) zůstává v NAPADY. |
| 17 Ranní souhrn „Moje cesty“ | **do plánu** | Malé, posílí ★2. |
| 18 Trasa po silnicích | **do plánu** | `Engine.route` a `/api/me/route` existují. |
| 9 A vs B, 12 widget, 13 e‑maily, 14 časová osa, 16 PDF | zůstává v NAPADY | Není kapacita. |
| 10 Nehody Policie ČR | **zamítnuto pro dnešek** | Data neověřená, mění skóre na poslední chvíli. |

### 17.2 Tomáš (jádro `backend/app/core/`, data)
| Úkol | Co | Výstup pro Šimona |
|---|---|---|
| T11 | Oprava bodů do 450 m (nadsazené školy u objížďky). Z kap. 16. | beze změny API |
| **T17** | **Rozpočtový asistent:** z částky vybrat souvislé stavby. Stavba = navazující úseky na stejné silnici (`sil`) v jednom okrese, malé dobré mezery se pohltí. Cena podle stavu (2,5 / 12 / 17 mil. Kč/km, štítek `estimate`, zdroje v NAPADY č. 1). Výběr hladově podle skóre na Kč. | `Engine.budget_plan(amount_kc, weights) -> BudgetPlan` (stavby, km, Kč, kolik havarijních km zůstane) |
| **T18** | **Dojezd ZZS + HZS:** pro uzavírku spočítat, u kterých obcí se prodlouží dojezd z nejbližší základny, o kolik minut a jestli přesáhne 20 min. | pole v `PeopleImpact` nebo `Alert` „Dojezd záchranky do X se prodlouží o N min“ |
| **T19** | **Ověření modelu:** kolik % opravených úseků 2018–2024 mělo skóre v horní třetině. Ukázat jen když vyjde. | `Engine.backtest()` → jedno číslo + počet úseků |
| **T20** | **Nové faktory ve skóre** (slíbené v kap. 6, zatím chybí): intenzita (auta za den, T7), délka objížďky (T4) a středoškoláci denně (T14). 3 nové váhy, výchozí hodnoty střední, rozpad skóre je ukáže. Doplněno 15. 10. po kontrole `PLAN_OD_BIDAKA.md`. | `Weights` + 3 pole (jen přidaná, Šimon souhlasí), `breakdown` ukáže nové řádky. **Frontend musí brát žebříček z API (F2)**, lokální výpočet v `src/lib/priority.ts` nové faktory nezná. |

### 17.3 Šimon (`backend/app/api|db|auth|notify|ai`)
| Úkol | Co | Endpoint |
|---|---|---|
| **S14** | **AI dokončit:** poskytovatel Claude (`AI_PROVIDER=anthropic`, `AI_MODEL=claude-haiku-5-5`, klíč jen v `.env`), šablona jako záloha (už je), cache odpovědí v SQLite pro demo bez Wi‑Fi, štítek „návrh AI“ v každé odpovědi. Nově AI text k rozpočtovému plánu (3–5 vět, jen čísla z výpočtu). | `/api/ai/explain`, `/api/ai/announcement`, `/api/ai/weights` (hotové), nově `POST /api/ai/budget` |
| **S15** | **Login pro frontend (kap. 15):** po sloučení poslat Matoušovi tvar `/api/auth/login`, `/api/auth/me`, `/api/auth/register`. Rate limit na login (5 pokusů / min na IP). | `/api/auth/*` (hotové) |
| **S16** | **Napojení frontendu:** dohodnout s Matoušem tvar `/api/ranking` (`{items}` vs pole, váhy v query) a náhled uzavírky bez uložení do DB. | `POST /api/closures/preview` (úředník, bez zápisu) |
| **S17** | **Rozpočet:** volá T17, umí dvě částky najednou pro porovnání. | `GET /api/budget?amount=…&amount2=…` |
| **S18** | **Kolize uzavírek:** při náhledu uzavírky varovat, když objížďka vede přes jinou aktivní uzavírku (z DB nebo SRTI, T8) s překrývajícím se termínem. + výstup T18 do odpovědi uzavírky. | v odpovědi `POST /api/closures` |
| **S19** | **Export:** `metadata.jsonld` podle DCAT‑AP‑CZ (vzor: `https://open.datakhk.cz/katalog.jsonld`) a sloupec s názvem stavu pro lidi vedle původní hodnoty. | `/api/export.*`, `/api/export/metadata.jsonld` |
| **S20** | **Trasa bez přihlášení:** pro „Moje cesty“ na veřejném webu. | `GET /api/route?home=lon,lat&work=lon,lat` |

### 17.4 Matouš a Přemek (frontend `src/`)
| Úkol | Co | Závisí na |
|---|---|---|
| **F1** | **Login (kap. 15):** landing „Pokračovat bez přihlášení“ / „Přihlásit se“, formulář, registrace občana, obrazovka podle role, „Odhlásit“. | S15 |
| **F2** | **★1 přes API:** simulátor, ukázkové uzavírky 2022 (kap. 16.3). Karta uzavírky: auta za den, studenti, odříznuté obce, dojezd IZS, kolize. | S16, S18 |
| **F3** | **Moje cesty po silnicích** místo pásu 1,5 km + **ranní souhrn** nahoře („Dnes na vaší cestě: …“). | S20, `/api/me/notifications` |
| **F4** | **Povodeň:** tlačítko Q5 / Q20 / Q100 u úředníka, zatopené silnice a odříznuté obce na mapě. | `/api/flood` (hotové) |
| **F5** | **Rozpočtový asistent:** zadat částku (nebo dvě), stavby na mapě, tabulka, AI text se štítkem „návrh AI“. | S17, S14 |
| **F6** | **Moje obec:** výběr obce, stav jejích silnic, uzavírky, pořadí v kraji. | `/api/obce` (hotové) |
| **F7** | **Patička:** zásady ochrany údajů, souhlas při registraci, odkaz na Zdroje dat. | — |

### 17.5 Pitch (kdo dělá pitch, kap. 16.5)
- Poslední slajd: QR na web, **jen když mobil v 16:00 funguje** (NAPADY č. 6).
- Když T19 vyjde: „X % úseků, které kraj opravil, mělo u nás skóre v horní třetině.“
- **Přesně o číslech** (z `PLAN_OD_BIDAKA.md`, Matouš M1.2, M1.3): říkat „kraj **opravuje** zhruba 90 km ročně“ (historické tempo 2015–2024, 906 km / 10 let), ne „má peníze na 90 km“. A „jen havarijní úseky **aspoň** 15 let“, protože část oprav jde jinam a síť se mezitím zhoršuje.
- **Poctivě o objížďce:** model pošle všechna auta jednou nejkratší objížďkou. Ve skutečnosti se rozdělí.
- **Záložní web (Přemek, po 15:00):** build frontendu na GitHub Pages. Frontend umí počítat lokálně a má snímek objížděk, takže porota otevře odkaz i když tunel spadne. Na odkazu štítek „offline ukázka bez serveru“.

### 17.7 Kontrola `PLAN_OD_BIDAKA.md` před smazáním (15. 10.)
Prošel jsem celý starý plán (je v historii gitu, `git show 5ee1fa1:PLAN_OD_BIDAKA.md`). Skoro vše už je v kap. 0–17 nebo v NAPADY. Nově z něj: T20 (faktory ve skóre, které plán slíbil a chyběly), přesné formulace čísel a objížďky v pitchi, záložní web. Nehody zůstávají zamítnuté pro dnešek, i když podle rešerše data mají GPS a příčinu „stav vozovky“: soubor je `.rar` za celou ČR, to je riziko na poslední chvíli. V pitchi jako rozvoj.

### 17.6 Aktualizace
Při každém rozhodnutí v chatu se tato kapitola, [NAPADY.md](NAPADY.md) a `docs/BACKEND.md` upraví a pushnou na `main`. Hotové úkoly se tu označí ✅.

---

## 18. Stav před velkým sloučením (12:00)

**Splněno a smazáno při revizi plánu 15:00.** Text je v historii gitu (`git show 279f467:PLAN_FINAL.md`, kap. 18). Zbylé úkoly jsou v kap. 19–25.

## 19. Priorita po 13:00: propojit frontend s backendem (15. 10., ~13:15, Tomáš)

Kontrola z 13:00 ([NAPADY.md](NAPADY.md), část D) ukázala, že frontend bere z backendu jen přihlášení a stránku admina. Žebříček, simulátor uzavírky, rozpočet, povodeň ani trasy z API nečte. Backend je hotový a rychlý, ale v ukázce pro porotu není vidět.

### 19.1 Pravidlo
- **Nejdřív opravy propojení (D1–D10), až pak rozšiřování.** Nové obrazovky a funkce (F3–F6, nápady) se dělají až po nich.
- Výjimka: rozpracovanou práci nikdo nezahazuje. Dokončit commit, pak přepnout na D.
- Tabulka „Co nesedí mezi frontendem a API“ v kap. 18 je nahrazená touto kapitolou.

### 19.2 Matouš (frontend)
Celý seznam s pořadím je v [docs/FRONTEND.md](docs/FRONTEND.md), sekce „NEJVYŠŠÍ PRIORITA“. Ve zkratce:
1. **D1 + D3 + D4 najednou:** žebříček z `items`, piny přes `/api/pins`, váhy posílat vždy celé.
2. **D2:** simulátor přes `POST /api/closures/preview`, karta uzavírky s daty z backendu.
3. **D7** (debounce, `AbortController`), **D5**, **D8**, **D6** (posuvníky T20 až po T21 a S24).

### 19.3 Šimon (`backend/app/api|db|auth|main.py`)
| Úkol | Co | Proč (z NAPADY, část D) | Čas |
|---|---|---|---|
| **S21** | **Hesla demo účtů z `.env`** (`CESTY_SEED_ADMIN_PASSWORD`, `CESTY_SEED_OFFICIAL_PASSWORD`, …). Když chybí, vygenerovat náhodná a vypsat jen do konzole serveru. Doplnit `.env.example`. | D9: hesla v `seed.py` jsou ve veřejném repu a server je přes tunel veřejný. **Před ukázkou porotě.** | 20 min |
| **S22** | **`GZipMiddleware`** v `main.py` (`minimum_size=1000`). | D7: `/api/ranking` má 1,7 MB, po kompresi asi desetinu. | 5 min |
| **S23** | **Malý žebříček:** `GET /api/ranking?compact=1` vrací jen `id`, `score`, `priority`, `model_class`, `rank`, `pinned`, `votes`. | D7: posuvníky přes tunel a na mobilu. Frontend má zbytek v `roads.json`. | 20 min |
| **S24** | **Zavolat `Engine.warmup()` v lifespanu** místo `people` a `demo_closures()`, až T21 přistane na `main`. | D6: první posuvník T20 teď čeká 5 s. | 5 min |
| **S25** | **`GET /api/stability?top=100`** nad `Engine.stability(weights)` (T10, hotové). Váhy jako u `/api/ranking` (query, jinak účet). | Nápad F‑g: odznak „jisté / citlivé na váhy“. | 15 min |
| **S26** | **Typy pro frontend z OpenAPI:** `npx openapi-typescript http://localhost:8000/openapi.json -o src/lib/api-types.ts`, s Matoušem. Odpovědi mít jako Pydantic modely (`response_model`), aby OpenAPI znalo tvar. | Chyby D1 a D2 by našel překladač TypeScriptu. | 45 min |

Pořadí: **S21 → S22 → S23 → S24** (jakmile je T21) → S25 → S26. Pak S14, S15, S18 z kap. 17.3.

### 19.4 Tomáš (`backend/app/core/`, `scripts/`, `public/data/`)
| Úkol | Co | Proč | Čas |
|---|---|---|---|
| **T21** | **`Engine.warmup()`:** předpočítat `people`, `demo_closures()`, faktory T20, `stavby()` a `rescue`. Jedno volání pro lifespan (S24). | D6, nápad B3. Start serveru se prodlouží asi o 10 s, první požadavky nečekají. | 20 min |
| **T22** | **Duplicitní obce:** 22 úseků má stejnou obec dvakrát s jinou velikostí písmen („Hradec Králové“ a „Hradec králové“). Sjednotit podle číselníku 448 obcí (Data KHK) ve `scripts/`, přegenerovat `public/data/roads.json`. | D10. | 20 min |
| **T23** | **`scripts/smoke_api.sh`:** přihlásí demo úředníka (heslo z `.env`, ne z kódu) a zavolá všechny GET a náhledové endpointy přes Vite proxy. Vypíše kód, čas a velikost. | Nápad B6: kontrola před ukázkou a po každém sloučení. | 30 min |
| **T24** | **Výchozí váhy T20 na 50**, až frontend čte žebříček z API (D1) a má posuvníky (D6). Do té doby zůstávají 0. | Dokončení T20. | 10 min |

Pořadí: **T21 → T22 → T23**, T24 až po D1 a D6.

### 19.5 Kdy je hotovo
- Úředník v prohlížeči vidí žebříček z API (štítek „živá data“), piny přežijí obnovení stránky.
- Simulátor ukáže objížďku, auta za den, studenty, odříznuté obce a dojezd ZZS z `POST /api/closures/preview`.
- Posuvník přes tunel reaguje do 1 s.
- Demo hesla nejsou v repu.
- `scripts/smoke_api.sh` projde bez chyby.

---

## 20. Doplněk ke kap. 19: co uvidí porota, pitch a škrty do 16:00 (15. 10., 13:00, Tomáš)

Kap. 19 platí a má přednost: úkoly D1–D10, S21–S26 a T21–T24 se tu neopakují. Tahle kapitola přidává jen to, co z kap. 19 nevyplývá: nedostatky E1–E8 z pohledu poroty ([NAPADY.md](NAPADY.md), část E), vlastníka pitche, ukázku a škrty.

**Hodnocení:** backend a jádro jsou hotové a silné (49/49 testů). Porota ale vidí frontend, který počítá skoro všechno lokálně. Do 16:00 **žádné nové funkce**. Jen udělat backend vidět a připravit pitch. Podrobně v [NAPADY.md](NAPADY.md), část D (chyby D1–D10) a část E (nedostatky E1–E8).

### Pořadí práce
| # | Kdo | Co | Do |
|---|---|---|---|
| 1 | **Tým** | Určit vlastníka pitche, PDF/PPTX a záložního videa (E2). Návrh: Přemek. | 13:15 |
| 2 | Šimon | S21 a S22 (kap. 19). Navíc ověřit, že platí AI klíč (E5). | 13:45 |
| 3 | Matouš | D1 + D3 + D4, pak D2 (kap. 19.2). | 14:30 |
| 4 | Matouš | Karta uzavírky z náhledu: auta, studenti, odříznuté obce, dojezd IZS (F‑b). Ukázkové uzavírky = 3 doporučené plány 2022 z `/api/demo-closures` (E4). | 15:15 |
| 5 | Matouš + Šimon | ★2: seznam upozornění v Moje cesty z `/api/me/notifications`. Web Push jen když zbude čas (E1). | 15:30 |
| 6 | Matouš | Rozpočet z `/api/budget` (E3), tlačítko „Zdůvodnit“ z `/api/ai/explain` (E5). | 15:45 |
| 7 | Tomáš | T21 → T22 → T23, T24 po D1 a D6 (kap. 19.4). | 15:00 |
| 8 | Přemek | Pitch podle kap. 2 a 17.5, PDF/PPTX, záložní video, GitHub Pages (E8), test mobilu 375 px. | 16:30 |

### Škrty, když nestíháme (odspodu)
Povodeň (E7), Moje obec (F6), hlasování a hlášení (F‑f), stabilita (B2, F‑g), malý žebříček (B4), typy z OpenAPI (B5).

### Ukázka pro porotu (3 příběhy, kap. 2)
- **★1 úředník:** žebříček → detail → simulace skutečné uzavírky 2022 (II/303 Velké Poříčí – Hronov) → objížďka, auta, studenti, IZS → „Potvrdit“.
- **★2 občan:** Moje cesty → upozornění na potvrzenou uzavírku.
- **★3 admin a data:** váhy, audit, export s metadaty, Zdroje dat.

### 20.1 Pitch: vlastník Přemek (15. 10., ~13:30)
- **Rozhodnuto:** pitch, PDF/PPTX a záložní video dělá **Přemek** (řádek 1 tabulky výše je vyřešený). Společně ho doladíme kolem 15:00.
- Do té doby se pitch jen rozepisuje v [docs/PITCH.md](docs/PITCH.md): osnova 5 min, demo klik po kliku, čísla se zdroji, věty pro porotu, odpovědi na výtky, slajdy, záloha a kontrola v 16:00. Kdo něco rozhodne, připíše to tam.

## 21. Kontrola frontendu a rozhraní (15. 10., ~14:30, Tomáš)

Zkontrolováno na větvi `matous` (commity od AI nástroje 04527a8 a f4f32e0). Opravy jsou už **na `origin/matous`** (a `produkce`), Matouš: `git pull` před další prací. Backend se nezměnil.

### 21.1 Nálezy a opravy
| # | Kde | Chyba | Stav / oprava |
|---|---|---|---|
| F0 | `AdminApp.tsx`, `ranking.ts` | Build padal: chybějící import `api`, nepoužitý import. | **Opraveno.** `npm run build` projde. |
| F1 | `api.confirmClosure` | Zakládal jen návrh (`POST /closures`), `/confirm` nevolal, špatný typ odpovědi. Nikdo nebyl upozorněn. | **Opraveno:** create + `/closures/{id}/confirm`, toast „upozorněno N občanů“, chyba je vidět. |
| F2 | `AdminApp.tsx` | `pins` chyběly v závislostech žebříčku, bez přihlášení pin tiše padal na 401. | **Opraveno:** pin na server jen úředník/admin, jinak lokálně s poctivou hláškou. |
| F3 | `LoginCard.tsx` f4f32e0 | Vstup „Demo bez hesla“ vždy, vypadá jako obejití přihlášení, zápisy pak dávají 401. | **Vráceno (revert).** Jen když server neběží. |
| F5 | Občan ★2 | Místa jen v `localStorage`, `PUT /me/places` se nevolal, takže nikdo nemohl být upozorněn. | **Opraveno:** přihlášený občan s oběma místy je uloží na server. |
| F6 | Ukázkové uzavírky | Lokální seznam místo `GET /api/demo-closures`. | **Opraveno:** z API (doporučené první, štítek „skutečný plán 2022“), bez serveru lokální seznam. |
| F9 | Zdroje dat | Text tvrdil, že kraj plán oprav nezveřejňuje (plán 2022 používáme). | **Opraveno.** |
| F10 | Legenda | Chyběla SRTI. | **Opraveno** (admin i veřejná mapa). |
| F13 | `ClosureCard` | **Pád celé stránky** po výběru ukázky: API vrací dojezd IZS jako `{items,label,note}` s českými poli (`sluzba`, `pred_min`, `po_min`, `nad_20_min`), frontend čekal `obce` z `schemas.py`. | **Opraveno** normalizací v `closure.ts`. **Šimon:** buď sjednoť `services/collisions.py` se `schemas.RescueImpact`, nebo to uveď v kontraktu. |
| F7 | AI ve frontendu | Endpointy `/ai/*` nikdo nevolá. | **Zbývá** (Matouš): tlačítka „návrh AI“ (vysvětlení, oznámení, váhy, rozpočet), vždy popsaná, nikdy nemění pořadí, plynulá hláška při vypnuté AI. |
| F8 | Rozpočet | Jen lokální odhad, ne `/api/budget`. | **Zbývá** (Matouš): volat API, lokální záloha, štítek zdroje. |
| F11 | Bezpečnost | Výchozí `CESTY_SECRET_KEY` má 18 bajtů a přes tunel jde padělat token. Hesla demo účtů jsou stále v `seed.py` (S21). | **Šimon:** S21. **Tomáš:** nastavit klíč ≥ 32 bajtů v `.env`. |
| F12 | Web Push | Kód je (`sw.js`, `notifications.ts`), chybí VAPID klíče, nikdy neproklikáno. | **Tomáš:** `cd backend && uv run python -m app.notify.vapid`, klíče do `.env`, zkusit v jednom prohlížeči. |

Ověřeno v prohlížeči (backend :8010, frontend :5180, dočasná DB): přihlášení úředníka, ranking z API, ukázky z API, legenda SRTI, výběr ukázky už nepadá. Neověřeno v UI: potvrzení uzavírky tlačítkem a notifikace občanovi z uložených míst (API cesta ověřena ručně, `notified: 1`).

### 21.2 Deset otázek k frontendu a backendu
1. **Kdo potvrzuje uzavírku a co UI ukáže?** Úředník tlačítkem „Potvrdit“: create, pak confirm, toast „upozorněno N občanů“ (F1).
2. **Jak se místa občana dostanou na server?** `PUT /me/places` (`{home:{lon,lat}, work:{lon,lat}}`) po nastavení obou, `GET /me/route` vrací trasu a zásahy. `localStorage` jen pro nepřihlášené (F5).
3. **Co ukazují ukázkové uzavírky?** `GET /api/demo-closures`, doporučené první, skutečný plán 2022 (F6). Plné předpočtené dopady z API zatím nezobrazujeme, simulace se spouští přes `/closures/preview` nad hlavním úsekem.
4. **Kdy je povolen offline demo vstup?** Jen když server neběží, s označením offline režimu (F3).
5. **Jediný zdroj pravdy pro piny?** Server pro úředníka/admina, lokálně jinak. Po změně se žebříček načte znovu, `pins` jsou v závislostech (F2).
6. **Kde je AI vidět a jak je označená?** Čtyři místa (RoadPanel, ClosureCard, AdminSystem, BudgetPlanner), vždy „návrh AI“, nikdy nemění skóre, potvrzuje člověk (F7, zbývá).
7. **Rozpočet?** `GET /api/budget?amount=&amount2=` s lokální zálohou a štítkem zdroje (F8, zbývá).
8. **Web Push?** Hotové na větvi, potřebuje VAPID v `.env`. Záloha: seznam upozornění v „Moje cesty“ (F12).
9. **Bezpečnost kontraktu?** Typy odpovědí se rozcházely dvakrát (F1, F13). Jedna smoke zkouška na endpoint (`scripts/smoke_api.sh`, T23) po každém sloučení, později typy z OpenAPI (S26).
10. **Spolehlivost před porotou?** gzip, malý žebříček a předpočet (S22–S24, T21), silný `SECRET_KEY`, smoke po každém sloučení, žádná session přihlášená ve špatné roli, záložní build s offline štítkem.

### 21.3 Co zbývá
- Matouš: F7, F8, proklik potvrzení uzavírky a upozornění v UI, mobil 375 px.
- Šimon: S21, sjednotit tvar `rescue` (F13).
- Tomáš: `SECRET_KEY`, VAPID, smoke po sloučení.

## 22. Server a backend: díry před hostingem a první ostrý test (15. 10., ~15:00, Tomáš)

Zkušební sloučení `main` + `tomas` + `simon` (kontrola z 15:00): kód se sloučí čistě, 61 testů projde, `scripts/smoke_api.sh` 0 chyb. Backend pokrývá celé MVP (★1, ★2, ★3). Zbývají **provozní díry** níže. Vlastník: **Šimon** (`backend/app/config.py`, `main.py`, `db/`, `start-server.command`, `.env.example`). Tomáš jen u S31.

### 22.1 Úkoly pro Šimona (v tomto pořadí)
| # | Díra | Proč vadí | Oprava | Hotovo, když |
|---|---|---|---|---|
| S27 | `.env` se v backendu nenačítá (`config.py` čte jen proměnné prostředí). Funguje jen přes `start-server.command`. | `uv run uvicorn …` z README a AGENTS tiše ignoruje klíč, hesla, AI i VAPID. Na hostingu se spustí bez klíčů a nikdo to nepozná. | Přidat `python-dotenv` a v `get_settings()` načíst `.env` z kořene repa (neprepisovat už nastavené proměnné). | Smazané proměnné v shellu, `uv run uvicorn` přesto vidí hodnoty z `.env` (zkouška: `AI_PROVIDER`). |
| S28 | Hesla demo účtů se bez `.env` generují při **každém startu** (`demo_users()` běží při importu), ale účty se zakládají jen do prázdné DB. | Po restartu vypsaná hesla nefungují, nikdo se nepřihlásí. | Generovat a vypsat hesla **jen když se opravdu zakládají účty** (uvnitř `seed_if_empty`). Do `.env.example` a README napsat: před prvním startem vyplň `CESTY_SEED_*_PASSWORD`. | Restart serveru s existující DB nevypíše žádná hesla a přihlášení z prvního startu dál platí. |
| S29 | Slabý klíč k tokenům: výchozí `dev-only-change-me`, délka se nehlídá. `start-server.command` ho vygeneruje jen při přesném starém zástupném textu. | Přes veřejný tunel jde padělat přihlášení (role admin). | Při startu: když klíč chybí, je kratší než 32 znaků nebo je výchozí, **server nenastartuje** (srozumitelná chyba). Výjimka jen s `CESTY_ALLOW_DEV_KEY=1` pro testy (pytest ho nastaví). Skript generování klíče rozšířit i na prázdnou hodnotu a na `dev-only-change-me`. | Start bez klíče skončí chybou, testy dál prochází. |
| S30 | Zastaralé texty: banner v `start-server.command`, README a `docs/DEMO.md` na `produkce` píšou „hesla v `seed.py`“. | Matouš a Přemek hledají hesla tam, kde nejsou. | Banner: „hesla jsou v `.env` (`CESTY_SEED_*`) nebo v `.server-logs/api.log` při prvním startu“. Opravit i README, `docs/DEMO.md`. | `grep -rn "seed.py" README.md docs start-server.command` nevrátí zavádějící větu. |
| S31 | Web Push: bez VAPID klíčů `push/vapid-public-key` vrací `configured: false`, nikdy neproklikáno. | Upozornění na telefonu (★2) nepůjde. | **Tomáš** vygeneruje klíče (`cd backend && uv run python -m app.notify.vapid`), vloží do `.env` na Macu. Šimon doplní do `start-server.command` kontrolu a varování „Push vypnut: chybí VAPID“. | Při startu je v logu řádek, jestli push je zapnutý. |
| S32 | `CESTY_COOKIE_SECURE` je vypnuté a `CESTY_CORS_ORIGINS` jen `localhost:5173`. | Přes HTTPS tunel má být cookie `Secure`. CORS neřeší nic (stejný původ přes Vite), ale musí být zdokumentováno. | Do `.env.example` dopsat `CESTY_COOKIE_SECURE=1` pro tunel a vysvětlit CORS. Do `start-server.command` nastavit `CESTY_COOKIE_SECURE=1`, když běží tunel. | Přihlášení přes `https://…trycloudflare.com` nastaví cookie `Secure; HttpOnly`. |

### 22.2 První ostrý test na Šimonově počítači (po sloučení S27–S32)
Cíl: **jedna databáze, jedno místo**, Tomáš se přihlásí z telefonu nebo svého počítače a účet i přihlášení se uloží.
1. Šimon sloučí `main` do `simon` (konflikty jen v `PLAN_FINAL.md` a `docs/funkce.html`, vzít obě strany), pak `tomas` a `matous`. `cd backend && uv run pytest` a `scripts/smoke_api.sh` musí dát 0 chyb.
2. Šimon do `.env` vyplní `CESTY_SECRET_KEY` (≥ 32 znaků), `CESTY_SEED_*_PASSWORD`, VAPID klíče (od Tomáše). Hesla pošle Tomášovi mimo git (ne do chatu s veřejným logem, ne do repa).
3. `./start-server.command`, předá Tomášovi veřejnou HTTPS adresu.
4. Tomáš: otevře adresu, **zaregistruje nový účet** (`/api/auth/register`), přihlásí se, odhlásí, přihlásí se znovu a obnoví stránku (přihlášení musí přežít). Pak úředník potvrdí uzavírku a Tomáš vidí upozornění.
5. Šimon ověří, že účet je v `backend/cesty.db` (`SELECT email, role FROM user;`) a že restart serveru účet nesmaže.
6. Zápis výsledku do `docs/funkce.html` (log). Nic z hesel ani klíčů do repa.

### 22.3 Co zůstává mimo tento test
Matouš: AI tlačítka a rozpočet z API (kap. 21, F7, F8). Hledání adresy (místa se zadávají kliknutím do mapy). Sloučení všech větví do `main` ve 15:00 a pak po 30 minutách (kap. 16).

## 23. Přihlášení: kde jsou demo účty, e-mail a Google login přes QR (15. 10., ~15:20, Tomáš)

Ověřeno v kódu (`backend/app/api/auth.py`, `db/seed.py`, `db/models.py`, větev `simon`). Navazuje na kap. 15 a 22. **Úkoly S33 a M‑g jsou po S27–S32 a po prvním ostrém testu (kap. 22.2); nejsou MVP a škrtají se před ★1–★3.**

### 23.1 Kde zjistit demo účty
- **E‑maily jsou pevné a nejsou tajné:** `admin@cesty-khk.test`, `urednik@cesty-khk.test`, `obcan1@cesty-khk.test`, `obcan2@cesty-khk.test` (`seed.py`).
- **Hesla jsou jen v prostředí serveru:** `CESTY_SEED_ADMIN_PASSWORD`, `CESTY_SEED_OFFICIAL_PASSWORD`, `CESTY_SEED_CITIZEN_PASSWORD` v `.env` na Šimonově Macu. Hesla se nikdy nepíšou do repa, plánu ani veřejného chatu. Předat je jde jen mimo git (osobně, soukromá zpráva).
- **Když v `.env` chybí:** server je při prvním založení databáze vygeneruje a vypíše do konzole, ve skriptu `start-server.command` do `.server-logs/api.log`. Po opravě S28 jen při prvním založení účtů. Do té doby po restartu **vypsaná hesla nefungují**.
- **Pravidlo pro dnešek:** Šimon vyplní tři `CESTY_SEED_*` do `.env` **před prvním startem** a pošle je Tomášovi a Přemkovi soukromě.

### 23.2 Přihlášení e‑mailem
- Dnes **jen e‑mail + heslo**: `POST /api/auth/register` (heslo ≥ 8 znaků, role vždy občan) a `POST /api/auth/login`. Cookie `cesty_session`, platí 7 dní, po obnovení stránky zůstane.
- **Chybí:** ověření e‑mailu, odkaz „zapomenuté heslo“, přihlášení odkazem z e‑mailu. Registrovat jde libovolná adresa se znakem `@`. SMTP v kódu slouží jen k upozorněním. Pro demo to stačí: porota si zaregistruje občana s vlastním e‑mailem a heslem, úředník a admin jsou jen demo účty.
- **Pozor:** odhlášení zvýší `token_version`, takže se účet **odhlásí na všech zařízeních** najednou. U dvou lidí na jednom demo účtu (např. `obcan1` na telefonu i na notebooku) se navzájem vyhodí. Pro porotu proto registrace vlastního účtu, ne sdílený.

### 23.3 Google login (S33 Šimon, M‑g Matouš)
**Přesunuto do [NAPADY.md](NAPADY.md), část G (revize 15:00).** Do freeze nestihneme: potřebuje stabilní HTTPS adresu, projekt v Google Cloud a obrazovku souhlasu. Dnes jen e‑mail + heslo a demo účty (kap. 25.8).

### 23.4 QR kód a telefony
- **QR vede na stabilní HTTPS adresu** (stejná jako u Google původu). Adresa se mezi zkouškou a pitchem **nesmí změnit**, jinak je QR na slajdu k ničemu. Vygenerovat PNG jednou (Přemek na slajd, Tomáš do `docs/`), např. `uv run --with qrcode[pil] python -c "import qrcode; qrcode.make('https://…').save('docs/qr.png')"`.
- **Web Push na iPhonu funguje jen u aplikace přidané na plochu** (iOS 16.4+) a vyžaduje `manifest.webmanifest`, který v repu **není** (je jen `public/sw.js`). Android Chrome push zvládne rovnou. Úkol **M‑h (Matouš): přidat `public/manifest.webmanifest` + ikony + odkaz v `index.html`**, jinak na iPhonu upozornění v prohlížeči nepřijdou. Záloha: seznam upozornění v „Moje cesty“ (funguje všude).
- Push potřebuje HTTPS a VAPID klíče (S31), tedy opět stabilní adresa.

### 23.5 Úkoly
| # | Kdo | Co | Hotovo, když |
|---|---|---|---|
| ~~S33~~ | Šimon | **v nápadech (15:00).** `POST /api/auth/google`, `GET /api/auth/config`, `GOOGLE_CLIENT_ID` do `.env.example`, test s falešným tokenem (ověření podpisu zamockovat) | bez `GOOGLE_CLIENT_ID` endpoint vrací 404 a testy dál prochází; role z Googlu jen `citizen` |
| ~~M‑g~~ | Matouš | **v nápadech (15:00).** tlačítko Google v `LoginCard`, jen když `auth/config` vrací klientské ID | po přihlášení se zobrazí „Občan“ a session přežije obnovení |
| M‑h | Matouš | `manifest.webmanifest`, ikony | iPhone nabídne „Přidat na plochu“ |
| T25 | Tomáš | stabilní HTTPS adresa (doména / pojmenovaný tunel) a QR, **jen když zbude čas**; Google Cloud projekt je v nápadech | adresa se po restartu serveru nemění, QR ji otevře |
| P1 | Přemek | QR na slajd a „otevřít v Chrome / Safari“ | slajd obsahuje QR a stabilní adresu |

## 25. NEJVYŠŠÍ PRIORITA: tři aplikace podle role a produkční frontend (15. 10., ~14:55, Tomáš)

> Na větvi `tomas` jsou ještě rozhodnutí o nápadech a provoz/hosting. Na `main` přijdou se sloučením v 15:00 jako kap. 26 a 27.

**Proč:** backend a jádro jsou hotové a silné, ale frontend vypadá nepěkně a míchá všechny role do jedné obrazovky. Porota i kraj posuzují hlavně to, co vidí. Proto je tohle **nejvyšší priorita**: před D6, F‑c, F‑d a dalšími nápady. Kap. 19–22 platí dál, tahle kapitola mění jen pořadí práce na frontendu.

**Dnešní stav:** `src/App.tsx` přepíná pohledy jen stavem (`view = home | login | public | office | …`). Adresa v prohlížeči se nemění. Úředník i admin sdílí `AdminApp.tsx` s mapou. Neexistuje odkaz, který by úředník kraje dostal jako „svoji aplikaci“.

### 25.1 Tři aplikace, tři adresy
Jeden kód, jeden build, jeden backend. Liší se adresa, přihlášení, rozvržení a hustota informací.

| Adresa | Pro koho | Hlavní úkol | Vzhled |
|---|---|---|---|
| `/` | **Veřejnost a občan** | Kde se opravuje a kde je zavřeno, Moje cesty, upozornění. | Mapa přes celou obrazovku, velké prvky, minimum čísel, mobil první. Přihlášení jen kvůli Moje cesty a upozorněním (registrace jedním formulářem). |
| `/sprava` | **Úředník kraje nebo města. Hlavní cílová skupina.** | Pořadí oprav, proč je úsek nahoře, simulace uzavírky, potvrzení a upozornění občanů, rozpočet. | Pracovní aplikace: vlevo seznam (žebříček s filtry), uprostřed mapa, vpravo detail. Hustší, ale čitelná. |
| `/admin` | **Správce systému** | Uživatelé a role, výchozí váhy a strop hlasů, audit, zdroje dat a jejich stáří, AI, push, export. | **Bez mapy.** Tabulky a karty jako v administraci. |

Pravidla:
- **Každá adresa má vlastní přihlášení.** `/sprava` a `/admin` mají formulář s nadpisem „Cesty KHK – správa“ a „Cesty KHK – administrace“, bez registrace a bez demo vstupu, s textem „přístup jen pro pracovníky úřadu“. `/` má přihlášení občana a registraci.
- **Role hlídá server, ne adresa.** Občan na `/sprava` uvidí „Nemáte oprávnění“ a odkaz na `/`. Úředník na `/admin` totéž. Admin smí i na `/sprava`.
- **Po přihlášení** pošle frontend uživatele na adresu podle role (`citizen` → `/`, `official` → `/sprava`, `admin` → `/admin`).
- **Odkazy jdou sdílet:** `/sprava/usek/581`, `/sprava/uzavirka/12`, `/?usek=581`. Obnovení stránky nesmí ztratit, kde uživatel je.
- Landing (`/` bez přihlášení) má dole nenápadný odkaz „Pro úřad“ na `/sprava`.

### 25.2 `/sprava`: jednoduchá, ale podrobná, když úředník chce
Princip: **výchozí pohled je jednoduchý, všechno ostatní je o jeden klik dál.** Nic se neschovává natrvalo, úředník smí změnit všechno.

1. **Žebříček (levý panel):** prvních 20 úseků, u každého číslo silnice, úsek, skóre, třída a jedna věta proč (největší faktor). Nahoře hledání (číslo silnice, obec) a filtry: třída, ORP/okres, stav, „jen havarijní“, „jen na trase k nemocnici“. Řazení: skóre, intenzita, studenti, objížďka, délka.
2. **Váhy:** přepínač **„Jednoduché / Podrobné“**.
   - Jednoduché: 4 předvolby jako tlačítka („Vyvážené“ = výchozí kraje, „Bezpečnost a IZS“, „Doprava a hospodářství“, „Lidé a školy“) a jeden posuvník „stav vozovky vs. dopad na lidi“.
   - Podrobné: všechny váhy jako posuvníky (včetně T20: objížďka, odříznutí, studenti), u každé „co znamená“ a číslo. Tlačítko „Zpět na výchozí kraje“.
   - Po každé změně se ukáže **co se pohnulo**: „5 úseků nově v top 20, II/303 z 3. na 7. místo“.
   - Uložit jako „můj pohled“ (`PUT /me/weights`). Výchozí váhy kraje mění jen admin.
3. **Detail úseku (pravý panel):** skóre a rozpad po faktorech z API (`breakdown`, F‑c), stav, intenzita se zdrojem, obce, školy, nemocnice, tlačítka „Simulovat uzavírku“, „Zdůvodnit (návrh AI)“, „Připnout“.
4. **Uzavírka:** karta s objížďkou, auty, studenty, odříznutými obcemi, dojezdem IZS a kolizemi. „Potvrdit uzavírku“, pak text oznámení (návrh AI, úředník upraví) a „upozorněno N občanů“. Seznam uzavírek (návrhy, potvrzené, aktuální SRTI) s filtrem podle data.
5. **Rozpočet:** částka (posuvník a pole), výsledek z `/api/budget`: kolik km, které stavby, mapa, porovnání dvou částek, export CSV.
6. **Nahoře vždy:** štítek „živá data / offline snímek“, kdo je přihlášený, odhlášení. U mapy legenda.

### 25.3 `/` veřejnost a `/admin`
- **`/`**: mapa uzavírek a plánovaných oprav, vyhledání obce, **Moje cesty** (dvě nebo více pojmenovaných míst, trasa, „na vaší trase je uzavírka“), upozornění (seznam a push), „Proč se opravuje tady?“ (jednoduché vysvětlení skóre), Zdroje dat, Soukromí. Žádné váhy, žádné tabulky.
- **`/admin`**: Přehled (počet uživatelů, uzavírek, upozornění, stáří dat, stav AI a push), Uživatelé (seznam, změna role), Výchozí váhy a strop hlasů, Audit (filtr podle uživatele a akce), Data (zdroje, licence, datum snímku, export s metadaty), Nastavení AI. **Žádná mapa.**

### 25.4 Produkční vzhled (pravidla pro všechny tři)
- Jeden design systém (petrolejový akcent, světlý a tmavý režim zůstávají). Velikosti písma 14/16/20/28, mřížka 8 px, nejvýš 2 úrovně stínu.
- **Každá obrazovka má 4 stavy:** načítání (skeleton, ne prázdno), prázdno („Zatím žádné uzavírky“ + co udělat), chyba (česky, co se stalo, tlačítko „Zkusit znovu“), data.
- Čísla vždy s jednotkou a zdrojem (`csd2025` = „sčítání 2025“, `odhad` = „odhad“). Žádná anglická slova ani technické klíče v UI.
- Mobil 375 px: `/` plně, `/sprava` čitelně (seznam a detail jako vysouvací panely), `/admin` stačí tablet.
- Přístupnost: kontrast AA, ovládání klávesnicí v seznamech a formulářích, `aria-label` u ikon.
- Před porotou: žádné chyby v konzoli, žádné „undefined“, „NaN“ ani prázdné karty.

### 25.5 Co k tomu musí umět backend (frontend jen volá, nic nepočítá sám)
Dnes `GET /api/ranking` umí jen `limit`, `offset`, `compact` a váhy v query. Řazení, filtry, hledání a porovnání by si frontend musel počítat sám nad 4 726 úseky. To přesuneme na server.

| # | Co | Endpoint (návrh) | Vlastník |
|---|---|---|---|
| B‑1 | **Filtry a řazení žebříčku** | `GET /api/ranking?sort=score\|intensity\|students\|detour\|km&order=desc&trida=II,III&orp=…&stav=…&min_score=&havarijni=1&q=`, v odpovědi navíc `total` kvůli stránkování | jádro `Engine.query_roads(filters, sort)`: Tomáš. Endpoint: Šimon |
| B‑2 | **Hledání** silnice, úseku a obce v jednom poli | `GET /api/search?q=II/303` nebo `?q=Hronov` → `[{type: road\|obec, id, label, bbox}]` | `Engine.search(q)`: Tomáš. Endpoint: Šimon |
| B‑3 | **Předvolby vah** | `GET /api/weights/presets` → `[{id, nazev, popis, weights}]` | předvolby v jádře: Tomáš. Endpoint: Šimon |
| B‑4 | **Co se změnilo po změně vah** | `GET /api/ranking/diff?<váhy>&top=20` → nově v top, vypadlé, posuny | `Engine.rank_diff(a, b, top)`: Tomáš. Endpoint: Šimon |
| B‑5 | **Hlavní adresa podle role** | `POST /api/auth/login` a `GET /api/me` vrací navíc `home: "/" \| "/sprava" \| "/admin"` | Šimon |
| B‑6 | **Adresy `/sprava`, `/admin`, `/sprava/usek/…` při obnovení stránky** | Vite to umí sám. V produkci (FastAPI `StaticFiles`, Cloudflare nebo GitHub Pages) přidat fallback na `index.html` (`_redirects`, `404.html`) | Šimon (server), Přemek (Pages) |
| B‑7 | **Přehled pro admina** | `GET /api/admin/overview` → počty uživatelů podle role, uzavírek podle stavu, upozornění, poslední audit, stáří snímku dat, AI a push zapnuto | Šimon (čísla o datech z `Engine`: Tomáš) |
| B‑8 | **Filtry uzavírek** | `GET /api/closures?status=&od=&do=&road_id=&sort=` | Šimon |
| B‑9 | **Filtry auditu** | `GET /api/audit?user=&action=&od=&do=&limit=&offset=` | Šimon |
| B‑10 | **Souhrn obce pro veřejnost** | `GET /api/obce/{kod}` → úseky v obci, plánované opravy, uzavírky, nejbližší nemocnice a dojezd | `Engine.obec_summary(kod)`: Tomáš. Endpoint: Šimon |
| B‑11 | **Rozpočet jako CSV** | `GET /api/budget.csv?amount=` (PDF až později) | Šimon |
| B‑12 | **Jednotné chyby** | všechny chyby jako `{detail, code}` s českou zprávou, frontend jen zobrazí `detail` | Šimon |

Pravidla: nová pole jen přidávat (`schemas.py` aditivně), test na každý nový endpoint, doplnit `scripts/smoke_api.sh`.

### 25.6 Kdo co dělá
**Freeze je v 16:00.** Do té doby jen fáze 1. Fáze 2 je produkční verze (po hackathonu, nebo hned, když zbude čas).

| Kdo | Fáze 1 (do 16:00, malé a bezpečné) | Fáze 2 (produkční verze) |
|---|---|---|
| **Matouš** | 1. Adresy `/`, `/sprava`, `/admin` v `App.tsx` (čtení `location.pathname`, `history.pushState`, bez nové knihovny). 2. `/admin` bez mapy: `AdminSystem` a seznamy. 3. Přihlášení na `/sprava` a `/admin` bez registrace a demo vstupu, nadpis podle adresy. 4. Po přihlášení přesměrovat podle role. 5. Stavy načítání, prázdno a chyba aspoň v žebříčku a kartě uzavírky. | Rozvržení `/sprava` podle 25.2 (seznam, mapa, detail), přepínač Jednoduché/Podrobné, předvolby, „co se změnilo“, odkazy na úsek a uzavírku, napojení B‑1 až B‑12, mobil. |
| **Přemek** | Rychlý návrh tří obrazovek (drátěný model, klidně ručně nebo ve Figmě) podle 25.1–25.4 a seznam 10 nejhorších vizuálních chyb dnešní verze pro Matouše. Pitch dál podle kap. 20.1: ukázka jde přes `/sprava` (★1), `/` (★2), `/admin` (★3). | Design systém (barvy, písmo, komponenty), review každé obrazovky, test mobilu, fallback adres na Pages (B‑6). |
| **Šimon** | B‑5 (`home` podle role) a kontrola, že role hlídá server na všech admin endpointech. Dál kap. 22 (S27–S32). | B‑1 až B‑4 endpointy nad jádrem, B‑6 až B‑9, B‑11, B‑12, testy. |
| **Tomáš** | Sloučení v 15:00 a smoke. Jádro pro B‑1 (`Engine.query_roads`) a B‑3 (předvolby), pokud je Šimon stihne vystavit. | B‑1 až B‑4 a B‑10 v jádře (`query_roads`, `search`, `presets`, `rank_diff`, `obec_summary`), testy, data pro B‑7. |

**Škrty ve fázi 1, když nestíháme (odspodu):** stavy načítání a chyby (5), přesměrování (4), vlastní přihlášení (3). **Adresy `/sprava` a `/admin` bez mapy se neškrtají.** To porota uvidí jako „aplikace pro úřad“.

### 25.7 Další návrhy (po fázi 2, zatím jen nápady)
- Pojmenované scénáře vah a porovnání A vs B vedle sebe (navazuje na nápad č. 9).
- Tisková sestava „Plán oprav na rok“ pro zastupitelstvo (nápad č. 16) přímo ze `/sprava`.
- Role „obec“: starosta vidí jen úseky ve své obci a posílá podněty kraji.
- Průvodce úředníka při prvním přihlášení: tři kroky (žebříček, simulace, potvrzení).

### 25.8 Přihlášení podle adresy a demo účty (upřesnění 15:00, Tomáš)
**Tři různé přihlašovací obrazovky, jeden backend (`POST /api/auth/login`):**

| Adresa | Formulář | Vzhled | Co tam není |
|---|---|---|---|
| `/` občan | Rychlé přihlášení (e‑mail nebo jméno, heslo) a velké tlačítko **„Pokračovat bez přihlášení“**. Pod tím „Nemám účet → registrace“. | Světlý, přátelský, přes mapu nebo vedle ní, na mobilu na celou šířku. | Nic o správě. |
| `/sprava` úředník | Jen přihlášení. Nadpis „Cesty KHK – správa silnic“, podnadpis „Pro pracovníky Královéhradeckého kraje a obcí“. | Pracovní: tmavší petrolejový pruh, logo/znak kraje (jen jako text, ne cizí logo bez svolení), bez mapy na pozadí. | Registrace, demo vstup, „Pokračovat bez přihlášení“. |
| `/admin` admin | Jen přihlášení. Nadpis „Cesty KHK – administrace“. | Neutrální šedá, malý formulář uprostřed, štítek „zabezpečená část“. | Registrace, demo vstup, odkaz na veřejnou mapu. |

Pravidla:
- **Admin a úředník se nikdy neregistrují.** Účet jim založí admin (nebo seed). Registrace na `/` vždy vytvoří občana.
- Když se na `/admin` přihlásí úředník nebo občan, uvidí „Nemáte oprávnění pro administraci“ a odkaz na svou adresu (B‑5 `home`). Totéž občan na `/sprava`.
- Chyby pod formulářem česky: „Špatné jméno nebo heslo“, „Účet je zablokovaný“, „Server je nedostupný, zkuste to za chvíli“. Heslo s ikonou „ukázat“. Tlačítko během odesílání zamčené.

**Demo účty pro tým a porotu (S34, Šimon):**
| Přihlašovací jméno | Role | Kam po přihlášení |
|---|---|---|
| `obcan` | občan | `/` |
| `spravce` | úředník | `/sprava` |
| `admin` | admin | `/admin` |

- Backend přijme **krátké jméno** i e‑mail: `spravce` = `spravce@cesty-khk.test` (doplní doménu, když chybí `@`). Seed založí tyhle tři účty (staré `urednik@`, `obcan1@` můžou zůstat).
- **Hesla jsou jednoduchá na zapamatování, ale jen v `.env`** (`CESTY_SEED_ADMIN_PASSWORD`, `CESTY_SEED_OFFICIAL_PASSWORD`, `CESTY_SEED_CITIZEN_PASSWORD`). **Repo je veřejné, do gitu ani do plánu se nepíšou.** Tým je dostane soukromě, porota na papíře nebo na slajdu.
- **Riziko:** server je přes tunel veřejný. S jednoduchým heslem admina se tam může přihlásit kdokoli, kdo ho uvidí. Proto: po pitchi hesla změnit (`.env` + `RESET_DB=1 ./start-server.command`) a před nasazením po hackathonu jednoduchá hesla zrušit.
- Hotovo, když: na `/sprava` se přihlásím `spravce` + heslo z `.env` a skončím v žebříčku; `admin` na `/admin`; `obcan` na `/`; špatná role dostane stránku „Nemáte oprávnění“.

### 25.9 Produkční detaily, které „rychle splácnuté“ aplikace nemají (Matouš + Přemek)
Pořadí = priorita. Do freeze aspoň body 1–5.

1. **Vlastní stránka 404** („Tahle stránka neexistuje“, odkaz na `/`, `/sprava`, vyhledání), ve stejném designu. Plus **403** („Nemáte oprávnění“) a **„Server je nedostupný“** (offline režim se štítkem).
2. **Zachycení chyb** (React error boundary): místo bílé obrazovky karta „Něco se pokazilo“ a tlačítko „Načíst znovu“. Žádná chyba nesmí shodit celou aplikaci (viz F13).
3. **Název záložky podle stránky** („Žebříček – Cesty KHK správa“), `<html lang="cs">`, favicon, `meta description` a náhled odkazu (Open Graph obrázek) pro sdílení.
4. **Stavy každé obrazovky:** načítání (skeleton), prázdno s radou, chyba s „Zkusit znovu“ (25.4).
5. **Vypršelé přihlášení:** hláška a návrat na správný formulář podle adresy, rozpracovaná data se neztratí.
6. **Formuláře:** kontrola polí hned u pole, zamčené tlačítko během odesílání, potvrzení u nevratných akcí („Potvrdit uzavírku a upozornit 37 občanů?“).
7. **Česká čísla a data** všude (`Intl.NumberFormat('cs-CZ')`, „15. 10. 2026“), jednotky (km, min, vozidel/den).
8. **Klávesnice a přístupnost:** viditelný focus, `Esc` zavře panel, `aria-label` u ikon, kontrast AA.
9. **Patička:** verze a datum dat („data k 15. 10. 2026, verze abc123“), odkaz na Zdroje dat, Soukromí, licenci EUPL a GitHub.
10. **`manifest.webmanifest` a ikony** (M‑h z kap. 23.4): přidat na plochu, push na iPhonu.
11. **`robots.txt`** (`/sprava` a `/admin` neindexovat), `noindex` na přihlašovacích stránkách.
12. **Tisk** detailu úseku a rozpočtu (čistý tiskový styl bez mapových ovládacích prvků).
13. **Žádné ladicí výpisy** v konzoli, žádné „undefined“, „NaN“, „null“ v UI, žádné anglické hlášky.

Backend k tomu: jednotné chyby `{detail, code}` (B‑12), `GET /api/health` vrací verzi a datum dat (pro patičku), `home` podle role (B‑5), přihlášení krátkým jménem (S34).
