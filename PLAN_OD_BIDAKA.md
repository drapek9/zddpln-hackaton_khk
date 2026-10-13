# Plán od Bidáka

První pitch koncept a společný plán týmu na Hackathon Královéhradeckého kraje, **čt 15. 10. 2026**.
Živý dokument: každý si ho pullne, dopíše svou část a pushne. Nic tu není vytesané do kamene.

Podklady: [docs/ROZBOR.md](docs/ROZBOR.md) (pravidla, porota, minulí vítězové), [docs/PLAN_SILNICE.md](docs/PLAN_SILNICE.md) (review nápadu se silnicemi), [docs/podklady/](docs/podklady/) (pravidla 2026, prezentace Data KHK).

---

## 0. Jak s dokumentem pracovat

1. `git pull` před úpravou.
2. Piš hlavně do svých sekcí (kap. 13) nebo do „Otevřených otázek“ (kap. 12).
3. Když měníš společnou část, připiš na konec řádku `— jméno, datum`.
4. Malé commity, hned `git push`. Konflikt v tomhle souboru vyřeš ručně, nic nemaž bez domluvy.
5. Rozhodnutí přesuň z „Otevřených otázek“ do příslušné kapitoly a označ ✅.

**Větve (od 13. 10.):** každý má svou větev z `main`: `tomas`, `simon`, `premek`, `matous`. Pracuj ve své (`git switch <jméno>`), hotové věci slučuj do `main` přes pull request. Před prací `git pull origin main` do své větve, ať máte stejný základ.

---

## 1. Pitch v jedné větě

**Kraj má na opravy silnic peníze zhruba na 90 km ročně a havarijních je 1 375 km. Ukážeme, které opravit dřív a proč, otevřeně pro úředníky i pro lidi.**

Problém v číslech (ověřeno přímo z API Data KHK, poslední měření každého úseku):

| |
|---|---|
| Síť silnic II. a III. třídy v datasetu | 3 192 km (1 993 úseků) |
| Havarijní + SUPERhavarijní | 1 375 km (43 %) |
| + nevyhovující | 1 865 km (58 %) |
| Opravy 2015–2024 | 906 km, tj. ~90 km/rok |
| Jen havarijní úseky při tomto tempu | **~15 let** |

Proto rozhoduje **pořadí**. Mapa stavu silnic už vyhrála v roce 2022 (RoadMapper). Naše novinka je **transparentní prioritizace + dopady uzavírky + zapojení veřejnosti + otevřené API**.

---

## 2. Co už máme: Cesty KHK v1 (Šimon, commit `fbd0a25`)

React 19 + Vite + TypeScript + MapLibre, data z 18 vrstev Data KHK přes `npm run fetch-data` do `public/data/*.json`, stav v localStorage.

**Co je dobré a zůstává:**
- **Správa silnic:** 9 posuvníků vah, živý žebříček Top 18, filtry (okres, stav, hledání), mapa, detail úseku s rozpadem skóre.
- **Dopady uzavírky** (`src/lib/priority.ts` → `impactAlerts`): nemocnice, IZS, školy ve školním roce, autobusové linky, ohrožené zaručené přípoje, kolize se zimní údržbou. **Tohle je náš nejsilnější rozdíl proti RoadMapperu.**
- **Oznámení pro obce** (`src/lib/announce.ts`): vygenerovaný text o uzavírce.
- **Veřejnost:** opravy podle stavu, „Jede můj autobus?“, hlášení výtluku.
- **Předzpracování** (`scripts/fetch-data.mjs`): prostorové spojení úseků s body zájmu (450 m) a linkami (120 m).

---

## 3. Co je ve v1 špatně (ověřeno) a jak to opravit

| # | Problém | Proč vadí | Oprava |
|---|---|---|---|
| 1 | Silnice se stahují s `where: "rok='2024'"` (`scripts/fetch-data.mjs`, ř. ~227) | Zůstane 1 135 z 1 993 úseků, cca **54 % sítě**. Porotce z Data KHK si všimne děr v mapě. | Stáhnout všechny roky a pro každý `ozn_sil_usek` vzít poslední měření. ✅ opraveno (`c6de97f`) |
| 2 | Skript sám označí top úseky jako „Probíhající oprava“ / „plánováno“ s vymyšlenými daty | Porota zná realitu. Vymyšlená data vydávaná za skutečná = ztráta důvěry. | Jasně označit „simulace / návrh“. Skutečné jsou jen realizované opravy (`rok_real`). ✅ opraveno (`c6de97f`) |
| 3 | Oznámení tvrdí, že „IREDO, obce a IZS budou informováni automaticky“ | Neděláme to. | Přeformulovat na „návrh textu k odeslání“. ✅ opraveno (`c6de97f`) |
| 4 | `hist[rok]` se přepisuje po částech úseku | Příznak „zhoršení“ (`worse`) je nespolehlivý. | Agregovat stav úseku za rok (nejhorší nebo vážený délkou). ✅ opraveno (`c6de97f`) |
| 5 | Natvrdo `2026` v `roadScore` | Drobnost. | `new Date().getFullYear()`. ✅ opraveno (`c6de97f`) |
| 6 | Vrstva HSOO (ohrožené oblasti) se stahuje, ale ve skóre není | Zbytečná data. | Přidat jako faktor „sociální dopad“, nebo vyhodit. ✅ opraveno (`c6de97f`) |
| 7 | Chybí stránka **Zdroje dat** s odkazy na datasety | **Povinné** podle pravidel (5.2 b, 7.3). | Stránka + odkaz v patičce. ✅ opraveno (`c6de97f`) |
| 8 | Chybí `LICENSE` | Pravidla 5.2 c chtějí volnou licenci. | Přidat MIT nebo EUPL‑1.2 (rozhodnout). |
| 9 | Kód vzniká **před** soutěží | Pravidla mluví o dílech „vzniklých při soutěži“. | ✅ Rozhodnuto 13. 10.: připravený základ je v pořádku, hlavní práce (backend, AI, priorita, role, API) proběhne na soutěži. V pitchi to říct otevřeně. |

Chybí vůči tomu, co chceme (kap. 4–5): backend a databáze, přihlášení a role, AI, třídy priority, ruční přepsání priority, dvě osy stavů, hlasování, sledování tras, veřejné API, widget, export otevřených dat.

---

## 4. Cílová podoba

Tři pohledy nad stejnými daty. Celá aplikace **česky** a jen pro Královéhradecký kraj.

### A) Správa silnic (kraj, po přihlášení)
- Žebříček a mapa úseků podle priority, posuvníky vah.
- Detail úseku: rozpad skóre, třída priority, AI zdůvodnění, dopady uzavírky, historie stavu a oprav.
- **Ruční připíchnutí priority** s nepovinným důvodem (rychlé volby nebo text). AI hodnocení zůstává vidět vedle.
- Stav práce: posun úseku Navrženo → Schváleno → Naplánováno → Probíhá → Hotovo.
- Návrh oznámení pro obce a dopravce.
- Hlášení od občanů: přehled, sloučení k úseku, vyřízení.

### B) Občan (veřejně, s volitelným přihlášením)
- Mapa: co se opravuje, co je naplánováno, jak je na tom moje silnice.
- **Moje trasa / moje linka:** vyberu autobusovou linku nebo obec → stav silnic, pořadí v prioritách, probíhající uzavírky.
- **Nahlášení výtluku / závady** (bod na mapě, foto volitelně, popis).
- **Sledování** úseků nebo trasy (upozornění v aplikaci).
- **Hlasování** „tohle opravte“, jako slabý faktor do skóre (s limitem, aby to nešlo zmanipulovat).

### C) Veřejné API a widget (pro média a obce)
- `GET /api/useky` → GeoJSON úseků se skóre, třídou a stavem práce.
- `GET /api/statistiky?uroven=obec|orp|okres` → souhrny (km havarijních, pořadí, probíhající opravy).
- `GET /api/export.csv` a `export.geojson` → **nová otevřená data** pro Data KHK (kritérium „využití pro kraj“).
- **Widget** na vložení (`<iframe>`): mapka obce nebo ORP pro web obce či článek iDNES.
- Dokumentace API česky přímo v aplikaci.

---

## 5. Jak se počítá priorita

Čtyři vrstvy, od rychlé po lidskou:

1. **Skóre 0–100 na pozadí.** Deterministický výpočet z faktorů (kap. 6) a vah. Je rychlý, přepočítá se při každé změně dat nebo vah. Základ je `roadScore` z v1.
2. **Třídy priority.** Skóre → **Kritická / Vysoká / Střední / Nízká** (hranice podle percentilů nebo pevných prahů, doladit). Rychlý klasifikátor, žádné čekání na AI.
3. **AI vrstva.**
   - Úředník napíše česky, na čem mu záleží („letos hlavně školy a autobusy“), AI z toho nastaví váhy.
   - AI projde Top N a u každého úseku napíše **zdůvodnění** lidskou řečí. Může navrhnout posun o třídu, ale vždy s důvodem.
   - Když AI nejede: statický text sestavený z faktorů. Demo nesmí padnout kvůli API.
4. **Člověk má poslední slovo.** Připíchnutí priority + nepovinný důvod (rychlé volby: „nařízeno vedením“, „havárie“, „koordinace s jinou stavbou“, „dotace“ + vlastní text). Ukládá se historie: kdo, kdy, z čeho na co.

**Dvě nezávislé osy stavu:**

| Priorita | Stav práce |
|---|---|
| Kritická / Vysoká / Střední / Nízká (z modelu) | Navrženo |
| 📌 připíchnuto ručně (s důvodem) | Schváleno |
| | Naplánováno (termín) |
| | Probíhá |
| | Hotovo |

---

## 6. Datasety

Pravidlo: **každý dataset buď mění skóre, nebo odpovídá na otázku občana.** Nic nepřilepovat jen kvůli počtu.

| Dataset (Data KHK) | Ve v1? | K čemu |
|---|---|---|
| Stav povrchu silnic (2018–2024) | ✅ (jen 2024, opravit) | základ skóre, historie, zhoršení |
| Opravy silnic liniové + bodové | ✅ | roky od opravy, „Hotovo“ |
| Plán zimní údržby | ✅ | důležitost silnice, kolize s opravou |
| Autobusové linky VDKHK, zastávky IREDO | ✅ | veřejná doprava, „moje linka“ |
| Zaručené přípoje | ✅ | dopady uzavírky |
| Železniční zastávky | ✅ | návaznost na vlak |
| Nemocnice, praktičtí lékaři, pediatři | ✅ | dostupnost péče |
| Výjezdové základny ZZS, stanice HZS, služebny Policie ČR | ✅ | dostupnost IZS |
| Školy a školská zařízení | ✅ | cesty dětí, školní rok |
| Sociální služby | ✅ | zranitelní lidé |
| Průmyslové zóny | ✅ | nákladní doprava |
| Hospodářsky a sociálně ohrožená území | stahuje se, nepoužívá | sociální dopad |
| **Dopravní nehody** (Policie ČR / CDV, NKOD) | ❌ | bezpečnost: nehody na špatných úsecích. **Ověřit dostupnost a licenci.** |
| **Záplavová území Q100** | ❌ | riziko a odolnost silnice. Ověřit na Data KHK. |
| **Dojížďka do škol / za prací** (ČSÚ, NKOD) | ❌ | kolik lidí trasu reálně používá. Ověřit. |
| Hranice obcí a ORP | ❌ | agregace pro API, widget a „moje obec“ |

Zdroj všech vrstev Data KHK: `https://services6.arcgis.com/ogJAiK65nXL1mXAW/arcgis/rest/services/`, katalog `https://open.datakhk.cz/katalog.jsonld`. Na stránku **Zdroje dat** dát odkaz na každý dataset.

MHD (DPMHK) v datech kraje **není**. Mluvíme o „veřejné dopravě“ (IREDO), ne o MHD.

### Intenzita dopravy a objížďky (návrh Tomáš, 13. 10.)

**Data o počtu aut:** Data KHK je nemají. Má je **ŘSD – Celostátní sčítání dopravy 2020** ([scitani.rsd.cz/CSD_2020](https://scitani.rsd.cz/CSD_2020)), licence CC BY‑SA 4.0. Uvádí roční průměr vozidel za den (RPDI) po sčítacích úsecích. V KHK je ~460 sčítacích úseků na silnicích II. a III. třídy, medián ~3 000 vozidel/den. Pokrývá skoro všechny dvojky, trojky jen částečně. Sčítání 2025 už proběhlo, výsledky zatím nezveřejněné.
- Kde sčítání není: **odhad** z třídy silnice, počtu linek a zastávek, obcí v okolí. V aplikaci označit „odhad“.
- Živá data z dopravních čítačů otevřeně nejsou. Neslibovat.

**Objížďka při uzavírce:**
1. Ze silnic (Stav povrchu) + silnic I. třídy (OSM nebo ŘSD) postavit graf: uzly = konce úseků, hrany = úseky s délkou.
2. Při uzavírce úsek z grafu odebrat a najít nejkratší cestu mezi jeho konci (Dijkstra).
3. Ukázat: objížďku na mapě, kolik km a minut navíc, kolik aut/den se přesune (RPDI uzavřeného úseku).
4. Upozornit: objížďka vede přes **havarijní** úsek, přes obec se školou, mění trasu autobusových linek.
5. Poctivě říct: model posílá všechna auta jednou nejkratší objížďkou, ve skutečnosti se rozdělí.

Dopad na skóre: nový faktor „Intenzita dopravy“ (RPDI) a „Délka objížďky“. Silnice s dlouhou objížďkou je důležitější.

### Zdroje dopravních dat a pravidla (rešerše Tomáš, 13. 10.)

Doplnění k části výše: **předběžné výsledky sčítání 2025 už ŘSD zveřejnilo.**

**Počet aut (intenzita):**
- **ŘSD – sčítání 2025** (předběžné), CC BY‑SA 4.0. Stránka: [rsd.cz/silnice-a-dalnice/scitani-dopravy](https://www.rsd.cz/silnice-a-dalnice/scitani-dopravy), [XLSX](https://www.rsd.cz/documents/38144/3734982/V2_CSD_2025_20260826.xlsx/5a2163ce-1bcc-6264-8251-98e4dd34a9ec?t=1788264442427).
  - KHK: 666 řádků (I. tř. 281, II. 264, III. 113, D 8). Medián SV na II./III. tř. 2 513 vozidel/den.
  - Sloupce: SIL, ÚSEK, začátek/konec úseku, stanoviště sčítače, délka, TV, O, M, SV.
  - Souřadnice chybí. Párování podle čísla silnice pokryje ~120 z 667 silnic, ~1 418 z 3 192 km. Zbytek = odhad.
- **Sčítání 2020:** XLSX na stejné stránce, mapa [scitani.rsd.cz/CSD_2020](https://scitani.rsd.cz/CSD_2020). Starší roky (2016, 2010, …) taky.
- **Precedent:** JMK publikuje sčítání jako open data: [data.jmk.cz](https://data.jmk.cz/content/42a4242cf141469692fff75a8291e51c). Argument pro porotu: KHK může totéž.

**Živé uzavírky a stavby:**
- **ŘSD SRTI** v NKOD, CC BY 4.0: [datová sada](https://data.gov.cz/datová-sada?iri=https://data.gov.cz/zdroj/datové-sady/65993390/1087749998), [snapshot + SPARQL](https://lod.tamtamresearch.com/srti/snapshot).
  - Geometrie (WKT) a platnost od–do. V KHK ~140 záznamů, hlavně silnice I. třídy.
- Plánované opravy kraje jako data nejsou. Jen PDF a články (např. [zpravodaj UNVK duben 2026](https://khk.cz/system/files/2026-03/UNVK_duben2026_final_small.pdf)). Použít jen jako ručně ověřený příklad.

**Nehody:**
- Policie ČR: [statistiky 2025](https://policie.gov.cz/statistiky-dopravni-nehodovosti-za-rok-2025), soubor `data2025.rar` (~6,3 MB). Má GPS a příčinu „stav vozovky (výtluky)“ a „závada komunikace“.
- Archiv 2008–2025: [archiv.policie.gov.cz](https://archiv.policie.gov.cz/). [Open data katalog Policie](https://policie.gov.cz/opendata/catalogue): „bez licenčních omezení“. Obsahuje i sadu KŘP KHK, obsah zatím neověřen.

**Pravidla (5.2b, 7.3):**
- OK: CC BY, CC BY‑SA, data bez omezení. Každý zdroj uvést na stránce Zdroje dat s odkazem.
- CC BY‑SA: náš export s intenzitami musí mít taky CC BY‑SA a uvést ŘSD.
- Nelze: živé čítače NDIC/JSDI (DATEX II, nutná registrace), Waze, Google, TomTom, mýtná data.
- V aplikaci psát: intenzita = roční průměr ze sčítání, ne živý tok.

---

## 7. Architektura

```
[React + Vite + MapLibre]  ──HTTP──▶  [FastAPI]  ──▶  [SQLite / PostgreSQL]
   (existující v1)                     │                (na jednom z našich notebooků,
                                       │                 v pitchi „server kraje“)
                                       ├─▶ skóre + třídy (Python, na pozadí)
                                       └─▶ AI (Azure OpenAI od Microsoftu, klíč jen v .env)
```

- **Frontend:** necháme v1 (React/TS), jen místo `public/data/*.json` a localStorage bude volat API.
- **Backend:** FastAPI. Při startu načte předzpracovaná data, spočítá skóre a třídy, drží hlášení, hlasy, stavy práce a připíchnutí.
- **Role:** veřejnost (bez přihlášení), občan, správa silnic, admin. Na hackathon stačí jednoduché přihlášení s testovacími účty ze seed souboru.
- **Bezpečnost:** repo je **veřejné**. API klíče a hesla nikdy do gitu, jen `.env` (je v `.gitignore`), do repa jen `.env.example`.
- **Síť na místě:** backend na notebooku, ostatní přes lokální Wi‑Fi nebo tunel. Záloha: vše na jednom notebooku + nahrané video dema.

---

## 8. Vlny (co když nestihneme)

**MVP: musí být v demu**
- [ ] Oprava dat: celá síť, poslední měření na úsek (bod 1 v kap. 3).
- [ ] Skóre → 4 třídy, posuvníky, Top N, detail s rozpadem.
- [ ] Ruční připíchnutí priority s důvodem + dvě osy stavů.
- [ ] Dopady uzavírky (už jsou).
- [ ] Občan: mapa + moje linka + nahlášení výtluku.
- [ ] Stránka Zdroje dat, LICENSE, označení simulací.

**Vlna 2**
- [ ] FastAPI + DB + přihlášení (4 role).
- [ ] AI: váhy z textu + zdůvodnění Top N (+ fallback).
- [ ] Veřejné API (GeoJSON, statistiky) + export CSV/GeoJSON.

**Vlna 3: jen když zbude čas**
- [ ] Widget na vložení.
- [ ] Hlasování a sledování tras.
- [ ] Nehody, Q100, dojížďka.

Pokud backend nestihneme, MVP běží i bez něj (jako v1) a backend ukážeme jako architekturu.

---

## 9. Kdo co dělá

| Člověk | Oblast | Poznámka |
|---|---|---|
| Šimon Drápal (drapek9) | | |
| Tomáš Radek (radys-s, Bidák) | | |
| Přemysl Skopal | | |
| matousada | | |

Návrh rozdělení: **data + skóre**, **backend + API**, **frontend správa**, **frontend občan + pitch**. Od 15:00 jeden člověk jen na prezentaci a PDF.

---

## 10. Harmonogram 15. 10.

| Čas | Co |
|---|---|
| 8:00–9:00 | registrace, rozjet prostředí, ověřit Wi‑Fi, AI přístup |
| 9:00–10:30 | oprava dat, kostra backendu, napojení frontendu |
| 10:30–12:00 | třídy priority, připíchnutí, stavy práce |
| 12:00–12:30 | oběd, sync týmu (co jede, co škrtáme) |
| 12:30–14:30 | AI vrstva, pohled občana, API |
| 14:30–16:00 | Zdroje dat, export, widget nebo škrty; od 15:00 jeden člověk jen pitch |
| **16:00** | **feature freeze** |
| 16:00–17:00 | stabilizace, záložní video dema, zkouška pitche nanečisto |
| 17:00–17:15 | odevzdání kódu + PDF/PPTX na flash disk |

---

## 11. Pitch (5 min, jde o ukázku fungování)

1. **Problém (30 s):** 1 375 km havarijních silnic, 90 km oprav ročně, 15 let. Otázka není *jestli*, ale *v jakém pořadí*.
2. **Správa silnic (2 min):** posuvníky přeskládají mapu a Top N → detail úseku s AI zdůvodněním → dopady uzavírky (nemocnice, přípoje, zimní údržba) → úředník připíchne prioritu s důvodem.
3. **Občan (1 min):** moje linka → stav silnic na trase a pořadí v kraji → nahlášení výtluku.
4. **Data a přínos (1 min):** kolik datasetů a proč každý, API a export jako nová otevřená data na Data KHK, widget pro obce a média.
5. **Rozvoj (30 s):** napojení na skutečný plán investic kraje, nehody, notifikace.

---

## 12. Otevřené otázky

1. ✅ **Hotový kód před soutěží:** připravený základ smí vzniknout předem, na soutěži na něm stavíme hlavní funkce. V pitchi otevřeně říct, co bylo připravené a co vzniklo na místě. — Tomáš, 13. 10.
2. **AI:** Azure OpenAI od Microsoftu (přístup dostane vedoucí týmu), nebo jiný poskytovatel?
3. **Backend:** stihneme FastAPI + DB, nebo zůstat u frontendu a backend jen ukázat?
4. **Dopravní nehody:** je otevřený dataset s polohou pro KHK? Kdo ověří?
5. **Název aplikace** (zatím „Cesty KHK“).
6. **Licence:** MIT, nebo EUPL‑1.2?
7. Kód se po soutěži odevzdává na `github.com/krhk`. Kdo to pohlídá?

---

## 13. Sekce pro každého

### Doplňuje Šimon

### Doplňuje Tomáš (Bidák)
- 13. 10.: rozbor pravidel a poroty v `docs/ROZBOR.md`, review nápadu v `docs/PLAN_SILNICE.md`, tento plán.

### Doplňuje Přemysl

### Doplňuje matousada
