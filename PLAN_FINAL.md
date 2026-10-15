# Finální plán: Cesty KHK

Hackathon Královéhradeckého kraje, **čt 15. 10. 2026**. Sestaveno 13. 10. z `PLAN_OD_BIDAKA.md` a ze tří zdrojů:
- poznámky Šimona (data o dopravě),
- review od Matouše (M1–M4),
- rešerše dopravních dat od Tomáše.

`PLAN_OD_BIDAKA.md` byl 15. 10. smazán, aby se neplietl (je v historii gitu: `git show 5ee1fa1:PLAN_OD_BIDAKA.md`). **Platí jen tento soubor.**

**Cesty KHK je webová aplikace** (běží v prohlížeči na počítači i na mobilu). Nativní mobilní aplikaci nestavíme.

> **15. 10., 13:15: nejvyšší priorita je kap. 19** (propojit frontend s backendem, chyby D1–D10). Až potom rozšiřování.
>
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
5. **Poskytovatel AI** a jestli klíč funguje už teď. Návrh: kap. 14.2.
6. Kdo po soutěži pohlídá odevzdání na `github.com/krhk`?
7. Role (Šimon).

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

**Doporučený poskytovatel:** Anthropic Claude přes oficiální SDK `anthropic` (Python).
- Model `claude-haiku-5-5` pro všechno (rychlý a levný, stačí na krátké texty a JSON). `claude-sonnet-5-5` jen když bude oznámení znít špatně.
- Záloha: Azure OpenAI, pokud partner Microsoft na místě dá kredit. Díky jednomu rozhraní se mění jen `.env`.
- `.env` (už je v `.env.example`): `AI_PROVIDER=anthropic|azure|none`, `AI_API_KEY`, `AI_MODEL=claude-haiku-5-5`, `AI_ENDPOINT` (jen Azure). Klíč nikdy do gitu ani do frontendu.
- `uv add anthropic` v `backend/` (Šimon).

**Struktura `backend/app/ai/` (vlastní Šimon, úkol S10):**
| Soubor | Co dělá |
|---|---|
| `provider.py` | Jedna funkce `complete_json(system, user, schema) -> dict \| None`. Volá model s nástrojem (tool use) s JSON schématem, timeout 8 s. Při chybě, timeoutu nebo `AI_PROVIDER=none` vrátí `None`. |
| `prompts.py` | 4 systémové prompty, česky, krátké. Každý říká: „Používej jen čísla ze vstupu. Nic nevymýšlej.“ |
| `fallback.py` | Šablony bez AI pro všechny 4 použití. Když `complete_json` vrátí `None`, použije se šablona. |
| `cache.py` | Výsledek podle `hash(vstup)` v SQLite. Při demu se nic nevolá dvakrát a funguje i bez Wi‑Fi, pokud se demo jednou proklikne předem. |

**4 použití, vstupy a výstupy:**
| # | Endpoint (Šimon) | Vstup z `Engine` (Tomáš, už existuje) | Výstup (JSON schéma) | Obrazovka (Matouš) | Kdy |
|---|---|---|---|---|---|
| 1 | `POST /api/ai/zduvodneni {road_id}` | `breakdown(road_id)`, `road(road_id)` | `{text, faktory_pouzite[]}` | Detail úseku, Top N | 12:30–15:00, první |
| 2 | `POST /api/ai/oznameni {road_id, od, do}` | `closure_impact(...)`, `detour(road_id)` | `{titulek, text, objizdka_popis}` | Simulátor uzavírky (★1), nahradí šablonu z `src/lib/announce.ts` | druhé |
| 3 | `POST /api/ai/vahy {text}` | aktuální `Weights` | `{vahy: {faktor: 0–100}, duvod}` | Váhy, tlačítko „Navrhnout z textu“ | třetí, škrtá se první |
| 4 | `POST /api/ai/hlaseni {text, lon, lat}` | nejbližší úsek (Tomáš: helper `nearest_road(lon, lat)`, zatím chybí) | `{typ: enum, zavaznost: 1–3, road_id}` | Fronta hlášení | jen když zbude čas |

**Pravidla, která drží porotu (kap. 1, body 10 a 11):**
- AI nikdy nemění skóre ani pořadí. Pořadí počítá jen `Engine`.
- Každý AI text má ve UI štítek **„návrh AI“** a tlačítko „Použít“ nebo „Upravit“. Bez potvrzení člověkem se nic neuloží ani neodešle.
- Text od občana (použití 4) jde do modelu jako data v `<hlaseni>…</hlaseni>`. Výstup je jen enum a čísla; nic se z něj nespouští.
- Audit: kdo potvrdil AI návrh a kdy (Šimonův audit log).

**Pořadí práce, ať AI nebrzdí MVP:**
1. Šimon: `fallback.py` + endpoint 1 a 2 **jen se šablonou** (15 min). Matouš může hned napojit UI.
2. Šimon: `provider.py` s Claude, zapnout přes `.env`. Ověřit 1 voláním z terminálu.
3. Tomáš: zkontrolovat, že `breakdown` a `closure_impact` vrací vše, co prompt potřebuje (čísla, názvy obcí, počty). Doplnit jen přidáním polí do `schemas.py`.
4. Demo: proklikat 2–3 ukázkové uzavírky předem, aby byly v `cache.py`.

Odpověď na otázku 5 v kap. 11: návrh je výše; rozhodne Šimon, podle toho, jaký klíč máme.

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

## 16. Sloučení do `main` ve 12:00 a co zbývá (15. 10., 10:55, Tomáš)

Kap. 0–15 platí. Tady je jen, co je potřeba udělat, aby ve 12:00 bylo všechno na `main` a šlo zkontrolovat, co máme.

### 16.1 Zkušební sloučení (ověřeno 10:55, lokálně, nic se nepushlo)
- `tomas` + `simon` + `matous` jdou sloučit **bez konfliktu**. `npm run build` projde.
- Backend: 32 z 36 testů zelených. 4 padají jen proto, že Šimonovy testy čekají „data ještě nejsou“ a data už jsou (viz 16.2).
- API po sloučení odpovídá: `/api/health` (4 726 úseků), `/api/demo-closures` (20 skutečných uzavírek 2022), `/api/obce` (448 obcí z Data KHK), `/api/flood` (po přihlášení).

### 16.2 Šimon (před sloučením, ~20 min)
1. **Chyba v intenzitě:** `services/access.py`, `intensity_of`. `road["intensity"]` není číslo, ale slovník `{"sv": vozidel za den, "src": "csd2025" | "odhad", "usek": …}`. Vracet `sv` a jako kvalitu `src`. Dnes API vrací celý slovník a kvalita je vždy „odhad“.
2. **Testy čekající prázdná data** (`tests/test_api.py`) přepsat na skutečné hodnoty:
   - `test_closure_notifies_citizen_on_route`: `vehicles_per_day`, `students_per_day`, `cut_off_obce` už mají hodnotu.
   - `test_flood_waits_for_engine`, `test_obce_are_names_until_dataset_arrives`, `test_demo_closures_from_current_network`: teď `ready: True`.
3. **Štítek ukázek:** `/api/demo-closures` dává `label: "demo data"`, ale jsou to skutečné plány kraje 2022. Navrhuji `"skutečný plán 2022 (Data KHK)"`. Pravidlo „označovat poctivě“ platí oběma směry.
4. **Sloučit do `main`:** nejdřív `tomas`, pak `simon`. `uv run pytest`, push. **Do 12:00.**
5. V `Engine` je nově: `students_on(id)`, `cut_off_obce(id)`, `people_impact(ids)`, `obce()`, `flood(level)`, `flood_geojson(level)`, `demo_closures()`, `graph.detour_set(ids)` (uzavírka přes víc úseků). Popis v `docs/BACKEND.md`, kap. 7.
6. Volitelné: v lifespanu zavolat `engine.people` a `engine.demo_closures()`. Jinak první požadavek trvá ~3 + 5 s.

### 16.3 Matouš a Přemek (po sloučení)
1. **★1 simulátor přes API:** `POST /api/closures` vrací objížďku s geometrií, varování, auta za den, studenty a odříznuté obce. Přepnout ze snímku `public/demo/detours.json` na API. Bez toho není hlavní demo.
2. **Seznam „Skutečné uzavírky 2022“** z `GET /api/demo-closures`. Tři mají `recommended: true` a `recommended_reason`. Klik otevře simulátor s touto uzavírkou (`road_ids`, `detour`, `people`, `alerts` jsou už spočítané).
3. Login podle kap. 15.
4. **Zdroje dat:** doplnit ŘSD Celostátní sčítání dopravy 2025 (CC BY‑SA 4.0), OpenStreetMap (ODbL) a z Data KHK Obce, Dojížďka do středních škol, Záplavová území a Plánované opravy 2022. itemId jsou v `docs/BACKEND.md`, kap. 7. U `intensity_src == "odhad"` ukázat štítek „odhad“.

### 16.4 Tomáš
- Do 12:00: T8 uzavírky ŘSD SRTI (`engine.srti_closures()`, Šimon na něj už má místo v `api/closures.py`), pak T11 oprava 450 m.
- **Doplněno 11:05:** T8 i T11 hotové na `tomas`. T11 změnilo počty bodů u úseků a tím skóre a pořadí. Po sloučení se žebříček ve webu bude lišit od dopoledne, je to oprava, ne chyba.
- Ve 12:00: pomoct se sloučením a s kontrolou.

### 16.5 Kontrola ve 12:00 (všichni, 15 min)
- ★1: proklikat 3 doporučené uzavírky 2022 od výběru po „Potvrdit“.
- ★2: občan s trasou dostane upozornění po potvrzení uzavírky.
- ★3: admin, export CSV/GeoJSON, dokumentace API.
- Rozhodnout škrty podle kap. 8 a **kdo dělá pitch a PDF** (zatím nikdo).

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

## 18. Stav před velkým sloučením (15. 10., 12:00, Tomáš)

**Zkušební sloučení** `origin/simon` + `origin/matous` + `origin/tomas-next` (lokálně, nic se nepushlo): **bez konfliktů**, `npm run build` projde, backend **47 z 48 testů**.

### Co je hotové na větvích (ještě ne na `main`)
- **Šimon (`simon`, 12 commitů):** kap. 16 splněná (intenzita, testy, štítek „skutečný plán 2022 (Data KHK)“, předehřátí v lifespanu). Navíc S16 `POST /api/closures/preview`, S17 `/api/budget` nad `Engine.budget_plan`, S19 `/api/export/metadata.jsonld`, S20 `GET /api/route`. AI umí Claude (`AI_PROVIDER=anthropic`).
- **Matouš (`matous`, 7 commitů):** jednotný design, světlý a tmavý režim, **F1 přihlášení** a **F7 patička**.
- **Tomáš (`tomas-next`):** T18 dojezd ZZS a HZS. T17 a T10 už jsou na `main`.

### Co je potřeba udělat před sloučením
| Kdo | Co | Proč |
|---|---|---|
| **Šimon** | Sloučit `simon` do `main` (je 0 commitů pozadu, jde fast-forward). | Matouš potřebuje API na `main`. |
| **Šimon** | V `tests/test_api.py::test_closure_notifies_citizen_on_route` nečekat u dojezdu IZS `None`. Po T18 je tam `{items, label: "estimate", note}`. | Jediný padající test po sloučení s `tomas-next`. |
| **Tomáš** | Po Šimonovi sloučit `tomas-next` do `main`, `uv run pytest`. | T18 na kartě uzavírky. |
| **Matouš** | Sloučit `matous` do `main` až po Šimonovi. | Konflikty nejsou, build projde. |

### Co nesedí mezi frontendem a API (F2, hned po sloučení)
**NEAKTIVNÍ (13:15):** nahrazeno kap. 19 a [docs/FRONTEND.md](docs/FRONTEND.md), sekce „NEJVYŠŠÍ PRIORITA“. Backend už váhy v query bere.

| Frontend (`src/lib/api.ts`) | API (Šimon) | Kdo upraví |
|---|---|---|
| `ranking` čeká pole `RankedRoad[]` a váhy v query (`?stav=30`) | vrací `{weights_source, count, items}`, váhy bere z účtu | Matouš čte `items`; váhy v query buď Šimon přidá, nebo frontend při změně posuvníků počítá lokálně (štítek) |
| simulátor volá `POST /api/closures` | náhled je `POST /api/closures/preview`; `/closures` ukládá do DB a chce `title` a úředníka | Matouš: náhled přes `/preview`, `/closures` až u „Potvrdit uzavírku“ |
| AI se z frontendu nevolá | `/api/ai/explain`, `/announcement`, `/weights` | Matouš, až po F2 |

### Zbývá z kap. 17
- Tomáš: **T19** ověření modelu, **T20** faktory ve skóre (pak frontend nutně čte žebříček z API).
- Šimon: S14 cache AI a `/api/ai/budget`, S15 rate limit na login, S18 kolize uzavírek.
- Matouš: F2–F6.
- Pitch a PDF: pořád **bez vlastníka** (kap. 16.5).

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
