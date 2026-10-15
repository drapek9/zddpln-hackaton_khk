# Finální plán: Cesty KHK

Hackathon Královéhradeckého kraje, **čt 15. 10. 2026**. Sestaveno 13. 10. z `PLAN_OD_BIDAKA.md` a ze tří zdrojů:
- poznámky Šimona (data o dopravě),
- review od Matouše (M1–M4),
- rešerše dopravních dat od Tomáše.

`PLAN_OD_BIDAKA.md` zůstává jako historie. **Platí tento soubor.**

**Cesty KHK je webová aplikace** (běží v prohlížeči na počítači i na mobilu). Nativní mobilní aplikaci nestavíme.

> **15. 10., 9:30:** stav projektu, rizika a doporučený postup na dnešek (škrty hned, pořadí úkolů do 12:00) jsou v [docs/STAV_A_DOPORUCENI.md](docs/STAV_A_DOPORUCENI.md). Přečíst před prací.

> **15. 10., 10:20:** co se **hned nedělá** (schválené nápady, V3, nehody, povodeň, Moje obec), je v [NAPADY.md](NAPADY.md). Tento soubor obsahuje jen to, co se dnes dělá. Když se nápad začne dělat, přesune se sem.

Role tu nejsou, řeší je Šimon (kap. 10 má prázdná jména).

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
5. **Poskytovatel AI** a jestli klíč funguje už teď.
6. Kdo po soutěži pohlídá odevzdání na `github.com/krhk`?
7. Role (Šimon).

---

## 12. Odkud co je

- Šimonovy poznatky o datech: `PLAN_OD_BIDAKA.md`, kap. 6 a otázka 4a.
- Matoušovo review M1–M4: `PLAN_OD_BIDAKA.md`, kap. 13.
- Rešerše dopravních dat: `PLAN_OD_BIDAKA.md`, kap. 6, „Zdroje dopravních dat a pravidla“.
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
