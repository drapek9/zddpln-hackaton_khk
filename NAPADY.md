# Nápady k doplnění (15. 10.)

Zásobník věcí, které se **hned nedělají**. Nejsou to úkoly. `PLAN_FINAL.md` obsahuje jen to, co se dnes dělá. Když se nápad začne dělat, přesune se do `PLAN_FINAL.md` (a do `docs/BACKEND.md` / `docs/FRONTEND.md`) a tady se označí **PŘESUNUTO DO PLÁNU**. Nejdřív po MVP ★1 (sync ve 12:00 nebo později).

Část A: nové nápady odsouhlasené 15. 10. Část B: věci přesunuté z `PLAN_FINAL.md`, protože se nebudou dělat hned.

## Část A: nové nápady (15. 10.)

Odsouhlasil Tomáš 15. 10. dopoledne. Ke každému nápadu: proč ho chceme, jak by fungoval, kdo by ho dělal, odhad času, rizika a co říct porotě.

Pořadí podle síly pro porotu: **1. Rozpočtový asistent → 2. Dojezd IZS → 3. Kolize uzavírek → 4. Export DCAT‑AP‑CZ → 5. Bezpečnost a GDPR → 6. QR kód na web.**

---

### 1. Rozpočtový asistent (nahrazuje „Scénář s rozpočtem“, v plánu je jako V2)

**Proč:** Úředník neplánuje po kouscích silnic, ale po stavbách a po penězích. Porota z MF, NKÚ a ekonomické gesce kraje chce vidět, co se za danou částku pořídí. Odpovídá na větu z pitche „co opravit dřív“.

**Jak to funguje:**
1. Úředník zadá **rozpočet v Kč**. Volitelně okres a co má přednost (školy, IZS, linky, stav).
2. Výpočet sestaví **stavby**:
   - navazující kusy **stejné silnice** (stejné číslo `sil`) spojené v grafu,
   - jen ve stavu nevyhovující, havarijní nebo SUPERhavarijní,
   - **celá stavba v jednom okrese** (okres zhruba odpovídá správci a cestmistrovství, nemíchat správu),
   - krátký dobrý kus (do ~300 m) mezi dvěma špatnými se přibere, ať se silnice nezavírá dvakrát,
   - délka stavby zhruba 0,5–5 km.
   - Vlastník: silnice II. a III. třídy patří kraji. Silnice I. třídy a dálnice (OSM) jsou ŘSD a do kalkulačky nepatří.
3. Každá stavba dostane **skóre** (průměr skóre úseků vážený délkou), **cenu** (km × cena za km podle stavu) a **objížďku** pro celou stavbu (zavřou se všechny její úseky naráz).
4. Výběr: hladový algoritmus podle skóre na korunu, dokud se stavby vejdou do rozpočtu. Je deterministický, stejný vstup dá vždy stejný výsledek.
5. Výstup:
   - seznam staveb s km, cenou, skóre, objížďkou a varováními,
   - mapa staveb,
   - souhrn: kolik km se opraví a **kolik havarijních km zůstane**.
6. **AI text** (štítek „návrh AI“): 3–5 vět, proč právě tyto stavby. Vstupem jsou jen čísla z výpočtu. Když AI nejede, zůstane šablona.

**Cena za km = předpoklad** (štítek „předpoklad“, úředník ji změní posuvníkem):

| Stav | Typ opravy | Výchozí cena | Zdroj |
|---|---|---|---|
| nevyhovující | nový kryt (obrusná vrstva) | 2,5 mil. Kč/km | CDV, průměr opravy narušeného krytu |
| havarijní | kryt + podkladní vrstvy | 12 mil. Kč/km | mezi CDV hodnotami; Liberecký kraj: III/28711, 1,1 km za 12,5 mil. Kč |
| SUPERhavarijní | obnova celé konstrukce vozovky | 17 mil. Kč/km | CDV |

- Kontrola: kraj má na rok 2026 1,936 mld. Kč na 48 km silnic a 18 mostů. Je to horní mez, protože v částce jsou mosty a velké stavby.
- Datová sada „Opravy silniční infrastruktury od 2016“ náklady **neobsahuje** (ověřeno 15. 10., jen délka a rok).
- Zdroje uvést na stránce Zdroje dat:
  - [CDV: Faktory ovlivňující náklady na údržbu a opravy silnic nižších tříd](https://www.cdv.cz/file/vav-faktory-ovlivnujici-naklady-na-udrzbu-a-opravy/)
  - [Opravy silnic v KHK za bezmála dvě miliardy (2026)](https://auto-mania.cz/tag/rekonstrukce-mostu)
  - [Liberecký kraj, III/28711](https://liberecka.drbna.cz/zpravy/doprava/42668-kraj-opravi-tri-silnice-za-88-milionu-docka-se-bily-kostel-i-rychnov.html)
- Na místě se zeptat mentorů nebo lidí z kraje na skutečnou cenu. Když ji řeknou, dosadit ji a citovat.

**Kdo:** Tomáš `core/` (`Engine.budget`, sestavení staveb), Šimon endpoint `POST /api/budget` a AI text, Matouš obrazovka.
**Odhad:** core 1,5 h, API 30 min, obrazovka 1 h.
**Rizika:** cena je hrubá. Říkat „pořadí a poměry“, ne „přesný rozpočet“. Stavba přes hranici okresu se rozdělí na dvě.
**Pro porotu:** „Zadáte 100 milionů a dostanete seznam souvislých staveb, ne náhodných kousků silnic. Víte, kolik havarijních kilometrů zbude a kudy pojedou objížďky.“

---

### 2. Dojezd záchranky a hasičů (ZZS + HZS) při uzavírce

**Proč:** Nejsilnější argument „škody“ uzavírky. Porota z veřejné správy a krizového řízení. Žádný jiný tým to mít nebude.

**Jak to funguje:**
1. Body: 16 výjezdových základen ZZS a 22 stanic HZS (už jsou v `pois.json`).
2. Před uzavírkou: z každé základny Dijkstra po grafu do obcí v okolí úseku (střed obce z T13 `Obce`). Pro obec platí nejrychlejší základna.
3. Po uzavírce: totéž bez zavřeného úseku (nebo stavby).
4. Výstup: obce, kde se dojezd prodlouží, o kolik minut, kolik tam žije lidí. Zvlášť ZZS a HZS.
5. Varování „kritické“, když dojezd ZZS přesáhne 20 minut. To je zákonná dojezdová doba (zákon o ZZS a plán pokrytí kraje).

**Kdo:** Tomáš `core/` (`Engine.rescue_impact`), Šimon přidá pole do odpovědi uzavírky, Matouš řádek na kartě ★1.
**Odhad:** core 1 h, zbytek 30 min.
**Rizika:**
- Rychlosti v grafu jsou odhad, ne skutečná jízda sanitky. Štítek „odhad“.
- Graf nemá místní ulice, takže střed obce se přichytí k nejbližší silnici.
**Pro porotu:** „Když zavřete tenhle most, sanitka do Malé Úpy pojede o 14 minut déle a překročí 20 minut.“

---

### 3. Kolize uzavírek

**Proč:** V praxi nejčastější chyba: dvě uzavírky ve stejném termínu a objížďka jedné vede přes druhou. Kraj to dnes hlídá ručně.

**Jak to funguje:**
1. Při potvrzení uzavírky (a už při simulaci) vzít ostatní aktivní uzavírky a opravy, jejichž termín se překrývá.
2. Kontrola A: vede objížďka přes jiný uzavřený úsek? Pak **kritické varování** a objížďka se přepočítá se všemi uzavírkami najednou (graf už umí parametr `closed`).
3. Kontrola B: je jiná uzavírka do ~5 km nebo na stejné silnici? Pak varování „souběh uzavírek v oblasti“.
4. Výstup: seznam kolizí s odkazem na druhou uzavírku.

**Kdo:** Tomáš `core/` (`Engine.conflicts`), Šimon volá při `POST /api/closures`.
**Odhad:** 30–45 min.
**Rizika:** závisí na tom, že uzavírky jsou v DB (S5). Bez DB jde ukázat jen na ukázkových uzavírkách.
**Pro porotu:** „Aplikace nedovolí poslat objížďku přes jinou uzavírku.“

---

### 4. Export s metadaty podle DCAT‑AP‑CZ

**Proč:** Kritérium „využití pro kraj“ a publikace na Data KHK. Porotkyně z DIA (bývalé NKÚ) a lidé z Data KHK. Výstup se dá rovnou nahrát do NKOD.

**Jak to funguje:**
1. Export `useky.csv` a `useky.geojson`: úsek, silnice, třída, okres, stav, skóre, třída priority, intenzita nebo odhad, studenti, datum výpočtu.
2. Vedle soubor `metadata.jsonld` podle DCAT‑AP‑CZ (formát NKOD): název, popis, poskytovatel, klíčová slova, licence, periodicita, časové a prostorové pokrytí, distribuce s formátem a URL.
3. `popis-sloupcu.csv` (CSV on the Web, `csvw`): význam a jednotka každého sloupce.
4. Licence: CC BY 4.0. Pokud export obsahuje data ŘSD, pak **CC BY‑SA 4.0**.
5. Na stránce API dokumentace odkaz „Stáhnout jako otevřená data“.

**Kdo:** Šimon (export S9). Tomáš dodá seznam sloupců a jejich popis.
**Odhad:** 30–45 min.
**Pro porotu:** „Výstup je hned nová otevřená datová sada pro Data KHK, včetně metadat podle národní normy.“

---

### 5. Bezpečnost a osobní údaje

**Proč:** Porotce Horálek (kyberbezpečnost). Ukládáme domov a práci občanů.

**Co udělat:**
- Hesla jen jako hash (`argon2` nebo `bcrypt`).
- Role kontrolovat na **každém** endpointu, nejen ve frontendu.
- Limit pokusů o přihlášení (např. 5 za minutu).
- Domov a práce jen jako **bod**, žádná adresa. Bod zaokrouhlit na ~100 m.
- Text od občana do AI jen k roztřídění, výstup jen v pevné struktuře.
- Tajné hodnoty jen v `.env`, CORS jen na naše adresy.
- **Souhlas** při registraci a při uložení míst (zaškrtávací pole s jednou větou, k čemu data slouží a jak je smazat).
- Tlačítko „Smazat můj účet a místa“.
- **Footer:** odkaz „Bezpečnost a osobní údaje“ na krátkou stránku (co ukládáme, proč, jak dlouho, jak smazat).

**Kdo:** Šimon (auth, DB), Matouš (footer, souhlas, stránka).
**Odhad:** 45 min celkem, hlavně při S3.
**Pro porotu:** jedna věta: „Ukládáme jen bod, ne adresu, se souhlasem a s tlačítkem na smazání.“

---

### 6. QR kód na web na posledním slajdu

**Proč:** Cena diváků a porotci si web proklikají sami.

**Jak:**
- Veřejná HTTPS adresa (Tailscale Funnel nebo cloudflared, viz [docs/STAV_A_DOPORUCENI.md](docs/STAV_A_DOPORUCENI.md), kap. 6).
- QR na posledním slajdu a na plátně při otázkách.
- **Podmínka:** QR dáme jen tehdy, když web na mobilu přes tunel jede dobře (rychlé načtení, žádné rozbité obrazovky). Ověřit v 16:00 na dvou telefonech. Jinak bez QR.
- Živé hlasování během pitche **nebude**. Hlasování ve webu může fungovat normálně.

**Kdo:** Přemek (slajd), Šimon (tunel).
**Riziko:** ~9 MB dat na mobil. Mobil má brát data z API, nebo zmenšený snímek.

---

## Část B: přesunuto z PLAN_FINAL.md (15. 10.)

Bylo v plánu jako V2, V3 nebo „po MVP“. Nic z toho se dnes nedělá, dokud nejede MVP a V2.

### 7. Povodňový scénář Q5 / Q20 / Q100
- **Data KHK:** `Záplavové_území_{pětileté,dvacetileté,stoleté}_vody`, 78 / 77 / 65 polygonů.
- **Jak:** tlačítko u úředníka „Povodeň Q100“. Zavřou se všechny úseky, které záplavové území protíná. Mapa ukáže zatopené silnice, odříznuté obce, počet lidí a studentů a dojezd IZS (navazuje na nápad 2).
- **Proč:** porota z veřejné správy a krizového řízení. Kraj nic takového nemá.
- **Poctivě:** úsek se zavře, jakmile jakákoli jeho část leží v záplavovém území. Skutečná povodeň zavírá podle hladiny.
- **Kdo:** Tomáš T15 (`Engine.flood(level)`), Šimon S12 (`GET /api/flood?level=q5|q20|q100`), Matouš tlačítko a mapa.
- **Závisí na:** T13 (obce) a T14 (toky studentů).

### 8. Ověření modelu (zpětná kontrola)
- **Otázka:** měly úseky opravené v letech 2018–2024 vysoké skóre už před opravou? A měly vysoké skóre úseky v plánu oprav na rok 2022?
- **Jak:** skóre spočítat ze stavu měření před rokem opravy, porovnat s pořadím. Výstup: „X % opravených úseků bylo v horní třetině“.
- **Proč:** odpověď na výtku „váhy jste si vymysleli“ (`PLAN_FINAL.md`, kap. 1, výtka 1). Matouš M2.4.
- **Riziko:** většina měření je z let 2022–2024, takže stav „před opravou“ často není změřený. Výsledek může vyjít slabě, pak ho neukazovat.
- **Kdo:** Tomáš T16 (`backtest_2022()`).

### 9. Srovnání dvou úseků A vs B
- Dva úseky vedle sebe: rozpad skóre, objížďka, dopady. Zvýrazní faktor, který rozhodl.
- **Proč:** úředník musí obhájit, proč A a ne B. Matouš M2.1.
- **Kdo:** Matouš (obrazovka), data už dává `Engine.breakdown`.

### 10. Nehody Policie ČR
- **Zdroj:** [statistiky nehodovosti 2025](https://policie.gov.cz/statistiky-dopravni-nehodovosti-za-rok-2025), bez omezení. Sada KŘP KHK na Data KHK.
- **K čemu:** nový faktor bezpečnosti ve skóre, export nehod na úsecích.
- **Otevřené:** co přesně sada obsahuje (GPS? jen KHK?). Neověřeno, termín „do čtvrtka“ propadl (Matouš M3.7).
- **Kdo:** Tomáš (napárování na úseky), jen když se ověří, že data mají souřadnice.

### 11. Moje obec a statistiky
- Veřejnost vybere obec a uvidí stav jejích silnic, pořadí v kraji, uzavírky a linky.
- **Data:** `Obce` z Data KHK (T13) a hranice obcí a ORP (otevřená data ČÚZK nebo RÚIAN).
- **API:** `GET /api/obce`, `GET /api/statistiky`.
- **Kdo:** Šimon S13, Matouš obrazovka.

### 12. Widget pro weby obcí
- Malá vložitelná mapka (`iframe`) se stavem silnic a uzavírkami v obci. Obec ji dá na svůj web.
- **Závisí na:** Moje obec (nápad 11).

### 13. Skutečné odesílání e‑mailů
- Dnes je v plánu jen testovací SMTP (Mailpit) a náhled na webu. Skutečný e‑mail potřebuje SMTP účet a ochranu proti spamu.
- **Kdo:** Šimon, až po Web Push.

---

## Zamítnuto

- Veřejný odkaz a QR ke každé uzavírce (pro web obce, zastávku). Stačí upozornění pro přihlášené.
- Samostatný pohled „peníze kraje po okresech“. Místo něj je rozpočtový asistent (nápad 1).
- Živé hlasování publika během pitche.
