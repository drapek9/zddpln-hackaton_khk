# Nápady k doplnění (15. 10.)

Zásobník věcí, které se **hned nedělají**. Nejsou to úkoly. `PLAN_FINAL.md` obsahuje jen to, co se dnes dělá. Když se nápad začne dělat, přesune se do `PLAN_FINAL.md` (a do `docs/BACKEND.md` / `docs/FRONTEND.md`) a tady se označí **PŘESUNUTO DO PLÁNU**. Nejdřív po MVP ★1 (sync ve 12:00 nebo později).

Část A: nové nápady odsouhlasené 15. 10. Část B: věci přesunuté z `PLAN_FINAL.md`, protože se nebudou dělat hned.

## Část A: nové nápady (15. 10.)

Odsouhlasil Tomáš 15. 10. dopoledne. Ke každému nápadu: proč ho chceme, jak by fungoval, kdo by ho dělal, odhad času, rizika a co říct porotě.

Pořadí podle síly pro porotu: **1. Rozpočtový asistent → 2. Dojezd IZS → 3. Kolize uzavírek → 4. Export DCAT‑AP‑CZ → 5. Bezpečnost a GDPR → 6. QR kód na web.**

---

### 1. Rozpočtový asistent (nahrazuje „Scénář s rozpočtem“, v plánu je jako V2)
**→ Přesunuto do plánu (15. 10.):** [PLAN_FINAL.md](PLAN_FINAL.md), kap. 17, úkoly T17, S17, S14, F5. Včetně porovnání dvou částek (č. 15).


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

**Doplnění 15. 10. (Šimon).** Body 1–6 a tabulka cen za km zůstávají. Tohle je k nim navíc.

**Odhad ceny jedné opravy.** Úředník vybere jednu silnici nebo několik silnic a může zadat vlastní cenu za metr čtvereční. Výchozí odhad pořád vychází z tabulky za kilometr podle stavu a nese štítek „předpoklad“. Když to datové sady dovolí, do odhadu vstupují další údaje, každý se stejným štítkem, nebo s textem „v datech není“: šířka vozovky (plocha = šířka × délka, pak plocha × Kč/m²), hloubka nebo tloušťka konstrukce, třída silnice, roky od poslední opravy a typ povrchu. Úředník výslednou částku dál upraví. Pořád se říká „odhad“, ne „cena zakázky“. Sada oprav od roku 2016 náklady neobsahuje, to platí i tady.

**Napojené silnice vhodné k opravě.** Kromě stavby z úseků stejného čísla silnice (bod 2) jde sestavit řetěz, který pokračuje na navazující silnici jiného čísla. Podmínka je spojení v grafu a stav, ve kterém se oprava vyplatí: nevyhovující, havarijní nebo SUPERhavarijní. Krátký lepší kus mezi nimi se může přibrat stejně jako v bodu 2, ať se trasa nezavírá dvakrát. Výsledek je víc na sebe napojených silnic, ne jeden úsek. S celým řetězem se pak pracuje jako se samostatnou silnicí: skóre, rozpad, objížďka, varování, dopady a odhad ceny.

**Víc nabídek do jednoho stropu.** Úředník zadá maximální rozpočet. Kromě jednoho výběru, který rozpočet naplní (bod 4), se ukáže několik samostatných nabídek, třeba pět až deset. Každá nabídka je jedna napojená trasa z odstavce výše a celá se vejde do stropu. Pořadí nabídek je podle skóre na korunu a je deterministické. U každé je délka, odhad ceny, objížďka a kolik havarijních kilometrů by po ní ještě zůstalo.

**Kdo:** Tomáš `core/` (`Engine.budget`, sestavení staveb), Šimon endpoint `POST /api/budget` a AI text, Matouš obrazovka.
**Odhad:** core 1,5 h, API 30 min, obrazovka 1 h.
**Rizika:** cena je hrubá. Říkat „pořadí a poměry“, ne „přesný rozpočet“. Stavba přes hranici okresu se rozdělí na dvě.
**Pro porotu:** „Zadáte 100 milionů a dostanete seznam souvislých staveb, ne náhodných kousků silnic. Víte, kolik havarijních kilometrů zbude a kudy pojedou objížďky.“

---

### 2. Dojezd záchranky a hasičů (ZZS + HZS) při uzavírce
**→ Přesunuto do plánu (15. 10.):** [PLAN_FINAL.md](PLAN_FINAL.md), kap. 17, úkoly T18, S18, F2 (varování na kartě uzavírky).


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
**→ Přesunuto do plánu (15. 10.):** [PLAN_FINAL.md](PLAN_FINAL.md), kap. 17, úkoly S18, F2 (jen varování, časová osa č. 14 ne).


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
**→ Přesunuto do plánu (15. 10.):** [PLAN_FINAL.md](PLAN_FINAL.md), kap. 17, úkoly S19 (spolu s č. 19).


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
**→ Přesunuto do plánu (15. 10.):** [PLAN_FINAL.md](PLAN_FINAL.md), kap. 17, úkoly S15 (rate limit), F7 (patička, souhlas).


**Proč:** Porotce Horálek (kyberbezpečnost). Ukládáme domov a práci občanů.

**Co udělat:**
- Hesla jen jako hash (`argon2` nebo `bcrypt`).
- Role kontrolovat na **každém** endpointu, nejen ve frontendu.
- Limit pokusů o přihlášení (např. 5 za minutu).
- Domov a práce jen jako **bod**, žádná adresa. Bod zaokrouhlit na ~100 m. Další uložené body (nápad 17) jsou totéž: jen bod, žádná adresa.
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
**→ Přesunuto do plánu (15. 10.):** [PLAN_FINAL.md](PLAN_FINAL.md), kap. 17, úkoly 17.5 (pitch).


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
**→ Přesunuto do plánu (15. 10.):** [PLAN_FINAL.md](PLAN_FINAL.md), kap. 17, úkoly F4 (jádro T15 a API S12 jsou hotové).

- **Data KHK:** `Záplavové_území_{pětileté,dvacetileté,stoleté}_vody`, 78 / 77 / 65 polygonů.
- **Jak:** tlačítko u úředníka „Povodeň Q100“. Zavřou se všechny úseky, které záplavové území protíná. Mapa ukáže zatopené silnice, odříznuté obce, počet lidí a studentů a dojezd IZS (navazuje na nápad 2).
- **Proč:** porota z veřejné správy a krizového řízení. Kraj nic takového nemá.
- **Poctivě:** úsek se zavře, jakmile jakákoli jeho část leží v záplavovém území. Skutečná povodeň zavírá podle hladiny.
- **Kdo:** Tomáš T15 (`Engine.flood(level)`), Šimon S12 (`GET /api/flood?level=q5|q20|q100`), Matouš tlačítko a mapa.
- **Závisí na:** T13 (obce) a T14 (toky studentů).

### 8. Ověření modelu (zpětná kontrola)
**→ Přesunuto do plánu (15. 10.):** [PLAN_FINAL.md](PLAN_FINAL.md), kap. 17, úkoly T19. Ukázat jen když vyjde.

- **Otázka:** měly úseky opravené v letech 2018–2024 vysoké skóre už před opravou? A měly vysoké skóre úseky v plánu oprav na rok 2022?
- **Jak:** skóre spočítat ze stavu měření před rokem opravy, porovnat s pořadím. Výstup: „X % opravených úseků bylo v horní třetině“.
- **Proč:** odpověď na výtku „váhy jste si vymysleli“ (`PLAN_FINAL.md`, kap. 1, výtka 1). Matouš M2.4.
- **Riziko:** většina měření je z let 2022–2024, takže stav „před opravou“ často není změřený. Výsledek může vyjít slabě, pak ho neukazovat.
- **Kdo:** Tomáš T16 (`backtest_2022()`).

### 9. Srovnání dvou úseků A vs B
**Zůstává v nápadech** (rozhodnuto 15. 10.), dnes se nedělá. Znovu potvrzeno 14:20 (kap. 21).

- Dva úseky vedle sebe: rozpad skóre, objížďka, dopady. Zvýrazní faktor, který rozhodl.
- **Proč:** úředník musí obhájit, proč A a ne B. Matouš M2.1.
- **Kdo:** Matouš (obrazovka), data už dává `Engine.breakdown`.

### 10. Nehody Policie ČR
**Zamítnuto pro dnešek (15. 10.):** data neověřená, faktor by měnil skóre na poslední chvíli. Po hackathonu.

- **Zdroj:** [statistiky nehodovosti 2025](https://policie.gov.cz/statistiky-dopravni-nehodovosti-za-rok-2025), bez omezení. Sada KŘP KHK na Data KHK.
- **K čemu:** nový faktor bezpečnosti ve skóre, export nehod na úsecích.
- **Otevřené:** co přesně sada obsahuje (GPS? jen KHK?). Neověřeno, termín „do čtvrtka“ propadl (Matouš M3.7).
- **Kdo:** Tomáš (napárování na úseky), jen když se ověří, že data mají souřadnice.

### 11. Moje obec a statistiky
**→ Přesunuto do plánu (15. 10.):** [PLAN_FINAL.md](PLAN_FINAL.md), kap. 17, úkoly F6 (widget č. 12 ne).

- Veřejnost vybere obec a uvidí stav jejích silnic, pořadí v kraji, uzavírky a linky.
- **Data:** `Obce` z Data KHK (T13) a hranice obcí a ORP (otevřená data ČÚZK nebo RÚIAN).
- **API:** `GET /api/obce`, `GET /api/statistiky`.
- **Kdo:** Šimon S13, Matouš obrazovka.

### 12. Widget pro weby obcí
**Zůstává v nápadech** (rozhodnuto 15. 10.), dnes se nedělá. Znovu potvrzeno 14:20 (kap. 21).

- Malá vložitelná mapka (`iframe`) se stavem silnic a uzavírkami v obci. Obec ji dá na svůj web.
- **Závisí na:** Moje obec (nápad 11).

### 13. Skutečné odesílání e‑mailů
**Zůstává v nápadech** (rozhodnuto 15. 10.), dnes se nedělá. Znovu potvrzeno 14:20 (kap. 21).

- Dnes je v plánu jen testovací SMTP (Mailpit) a náhled na webu. Skutečný e‑mail potřebuje SMTP účet a ochranu proti spamu.
- **Kdo:** Šimon, až po Web Push.

---

## Část C: nápady k designu (Matouš, 15. 10. odpoledne)

Ze stavby nového designu (úvodní stránka, rozpočet, Moje cesty). Nic z toho se hned nedělá.

### 14. Časová osa uzavírek na mapě
**Zůstává v nápadech** (rozhodnuto 15. 10.), dnes se nedělá. Znovu potvrzeno 14:20 (kap. 21).

- Posuvník s datem nad mapou. Mapa ukáže uzavírky a opravy platné v ten den (dnes, za týden, v listopadu).
- **Proč:** úředník hned vidí souběh uzavírek (navazuje na č. 3), občan vidí, kdy ho to potká.
- **Kdo:** Matouš (frontend). Data už jsou v opravách (`from`, `to`).

### 15. Porovnání dvou rozpočtů vedle sebe
**→ Přesunuto do plánu (15. 10.):** [PLAN_FINAL.md](PLAN_FINAL.md), kap. 17, úkoly T17, S17, F5 (spolu s č. 1).

- V rozpočtovém asistentu (č. 1) dvě částky vedle sebe, třeba 100 a 250 mil. Kč: kolik km, kolik havarijních km zůstane, které stavby přibudou.
- **Proč:** zastupitelstvo rozhoduje o částce, ne o úsecích. Silný moment pro porotu z MF a ekonomické gesce.
- **Kdo:** Matouš (obrazovka), výpočet je stejný jako č. 1.

### 16. Plán staveb jako PDF pro zastupitelstvo
**Zůstává v nápadech** (rozhodnuto 15. 10.), dnes se nedělá. Znovu potvrzeno 14:20 (kap. 21).

- Tlačítko „Tisk / PDF“: mapa staveb, tabulka, předpoklady ceny a štítek „návrh, ne rozhodnutí“.
- **Kdo:** Matouš (tiskový styl v CSS, bez backendu).

### 17. Ranní souhrn „Moje cesty“
**→ Přesunuto do plánu (15. 10.):** [PLAN_FINAL.md](PLAN_FINAL.md), kap. 17, úkoly F3.

- Po přihlášení jedna věta nahoře: „Dnes na vaší cestě: bez omezení“ nebo „od pondělí uzavírka II/300, objížďka +6 min“.
- Navazuje na Web Push (v3). Bez přihlášení jen v prohlížeči.
- **Kdo:** Matouš (frontend), Šimon (push), Tomáš (trasa po silnicích místo pásu kolem spojnice).

**Doplnění 15. 10. (Šimon).** V nastavení si přihlášený občan uloží víc bodů: bydliště, práci a další místa, která si sám označí na mapě. Uloží se jen bod, ne adresa (nápad 5). Mezi těmi body se spočítá trasa (nápad 18). Aplikace ukáže, jestli ji něco omezuje teď, a jestli ji omezení čeká do budoucna, tedy plánovaná oprava nebo uzavírka s termínem. Když se takový plán týká jeho trasy, může mu přijít oznámení. Jedno oznámení na jednu událost. Ranní věta nahoře bere text z toho samého.

### 18. Trasa po silnicích místo pásu kolem spojnice
**→ Přesunuto do plánu (15. 10.):** [PLAN_FINAL.md](PLAN_FINAL.md), kap. 17, úkoly S20, F3.

- „Moje cesty“ teď berou silnice v pásu 1,5 km kolem přímky domov–práce (odhad). Lepší je skutečná trasa z grafu (`Engine.route`), stejně jako objížďka.
- Trasa se počítá mezi všemi body, které si občan uloží, ne jen mezi domovem a prací (nápad 17).
- **Kdo:** Tomáš (`core/`), Šimon endpoint `GET /api/route`.

### 19. Srozumitelné názvy stavů v exportu
**→ Přesunuto do plánu (15. 10.):** [PLAN_FINAL.md](PLAN_FINAL.md), kap. 17, úkoly S19 (spolu s č. 4).

- V UI teď „Rozpadlá vozovka“ místo „SUPERhavarijní“, „Opotřebovaná“ místo „nevyhovující“ atd. V datech kraje zůstávají původní hodnoty. Do exportu (č. 4) přidat oba sloupce: původní hodnota a název pro lidi.

---

## Část D: kontrola propojení frontendu a backendu (15. 10. ~13:00, Tomáš)

**→ Přesunuto do plánu (15. 10., 13:15):** chyby D1–D8 a nápady F‑a, F‑b, F‑e do [docs/FRONTEND.md](docs/FRONTEND.md), sekce „NEJVYŠŠÍ PRIORITA“. D9, D10 a B1–B7 do [PLAN_FINAL.md](PLAN_FINAL.md), kap. 19 (S21–S26, T21–T24). V nápadech zůstávají F‑c, F‑d, F‑f a F‑g.

Kontrola na sloučeném `main` (`ae75d6e`): backend a Vite proxy spuštěné lokálně, každé volání ověřené přes `curl`, frontend přečtený v `src/lib/`. Nic se tím nemění samo, o pořadí rozhodne tým. **Chyby D1–D10 mají přednost před novými funkcemi.** D1 až D3 je potřeba udělat najednou, jinak se rozbijí piny.

### Jak frontend dnes mluví s backendem

| Endpoint | Volá ho frontend? | Výsledek |
|---|---|---|
| `/api/auth/*` (login, registrace, me, odhlášení) | ano | funguje |
| `/api/admin/users`, `/weights`, `/audit` | ano | funguje (drobnost D5) |
| `GET /api/ranking` | ano | **nefunguje**: odpověď se nepřečte, vždy se počítá lokálně (D1) |
| `POST /api/closures` (simulátor) | ano | **nefunguje**: vždy se použije snímek `public/demo/detours.json` (D2) |
| `/api/export.csv`, `/export.geojson`, `/docs` | jen odkazy u admina | funguje |
| `closures/preview`, `demo-closures`, `budget`, `flood`, `obce`, `route`, `me/*`, `pins`, `votes`, `reports`, `ai/*`, `statistiky`, `useky/{id}` | **ne** | backend je hotový, ve frontendu nic |

Shrnutí: frontend dnes běží skoro celý z lokálních JSON v `public/data` (asi 11 MB) a z vlastního výpočtu v TypeScriptu. Backend je hotový a odpovídá rychle, ale v ukázce pro porotu ho není vidět.

**Změřené odpovědi** (přes Vite proxy, přihlášený úředník):

| Volání | Čas | Velikost |
|---|---|---|
| `GET /api/ranking` | 0,09 s | **1,7 MB** |
| `GET /api/ranking?stav=30` | 0,24 s | 1,7 MB |
| `GET /api/ranking?detour=50&students=50&intensity=50` (poprvé) | **5,2 s** | 1,7 MB |
| `POST /api/closures/preview` | 0,09 s | 16 kB |
| `GET /api/budget?amount=…&amount2=…` | 0,74 s | 25 kB |
| `GET /api/route`, `/flood`, `/obce`, `/demo-closures`, `/closures`, `/statistiky` | do 0,06 s | 0,5–133 kB |

### Nalezené chyby

**D1. Žebříček z API se nepřečte.** `src/lib/api.ts` čeká pole, backend vrací `{weights_source, count, items}`. `ranked.map` spadne s TypeError, `fetchRanking` to jen zapíše do konzole a spočítá žebříček lokálně. Oprava: číst `items` (jeden řádek, Matouš, je to úkol M-b). Pozor: backend už váhy z query bere (`weights_from_query` v `api/roads.py`). Věta „váhy bere z účtu“ v `PLAN_FINAL.md`, kap. 18, už neplatí.

**D2. Simulátor uzavírky volá špatný endpoint.** `POST /api/closures` vrací nepřihlášenému 401, občanovi 403 a úředníkovi 422, protože chybí `title`. Kdyby `title` posílal, každé kliknutí na „Simulovat“ by uložilo novou uzavírku do DB. Oprava: náhled přes `POST /api/closures/preview` (klíče `detour` a `alerts` jsou stejné), ukládat přes `/closures` až tlačítkem „Potvrdit“. Náhled je jen pro úředníka. Občan a nepřihlášený zůstanou u snímku a frontend to musí označit. (Matouš, M-b.)

**D3. Piny jsou jen v prohlížeči.** `src/lib/store.ts` je drží v `localStorage`. Jakmile se opraví D1, žebříček z API piny z prohlížeče nezná a ručně připnutá priorita zmizí. Oprava: `POST` a `DELETE /api/pins` (backend je hotový). **Udělat spolu s D1.** (Matouš.)

**D4. Posuvníky a pořadí se můžou rozejít.** `weightsQuery` posílá jen váhy změněné proti výchozím. Když jsou všechny výchozí, backend použije uložené váhy admina nebo úředníka a posuvníky ukazují jiné váhy, než podle kterých se řadí. Oprava: posílat vždy všechny váhy, nebo posuvníky naplnit z `GET /api/me/weights`. (Matouš.)

**D5. Uložení vah admina přepíše strop hlasů.** `adminApi.saveWeights` posílá vždy `vote_cap = 10`. Oprava: poslat hodnotu načtenou z `GET /api/admin/weights`. (Matouš.)

**D6. Nové váhy T20 ve frontendu chybí.** Typ `Weights` ve `src/lib/types.ts` nemá `intensity`, `detour` a `students`, takže pro ně nejsou posuvníky. Dají se přidat až po D1, lokální výpočet je nezná. První výpočet s `detour` nebo `students` nad 0 trvá asi 5 s, pak je v cache. Oprava v backendu: předpočítat v lifespanu (B3). (Matouš posuvníky, Tomáš a Šimon předpočet.)

**D7. Žebříček je 1,7 MB bez komprese při každém pohybu posuvníku.** Přes tunel cloudflared (`start-server.command`) a na mobilu to bude pomalé. Opravy:
- backend: `GZipMiddleware`, jeden řádek v `main.py` (Šimon). JSON se zmenší asi na desetinu.
- frontend: debounce asi 300 ms a zrušení starého požadavku přes `AbortController` (Matouš).
- později malý režim žebříčku (B4).

**D8. Chybová odpověď 404 se tváří jako „API neběží“.** `api.ts` bere 404 jako „endpoint zatím není“ a tiše přepne na lokální data. Po přechodu na API (F2) odlišit skutečné 404, například neexistující úsek, od nedostupného serveru. (Matouš, nízká priorita.)

**D9. Bezpečnost: veřejný server a veřejná demo hesla.** Hesla demo účtů jsou v `backend/app/db/seed.py` ve veřejném repu. Server je přes tunel dostupný odkudkoli, takže se kdokoli přihlásí jako admin. Oprava: hesla seedu brát z `.env` (`CESTY_SEED_ADMIN_PASSWORD` atd.). Když tam nejsou, vygenerovat náhodná a vypsat je jen do konzole serveru. (Šimon, **před ukázkou porotě přes tunel**.)

**D10. Duplicitní názvy obcí v datech.** 22 úseků má stejnou obec dvakrát s jinou velikostí písmen, třeba „Hradec Králové“ a „Hradec králové“. Vidí se to v `/api/useky/{id}` i v kartě úseku. Oprava: v `scripts/` sjednotit názvy podle číselníku obcí (448 obcí z Data KHK) a odstranit duplicity. (Tomáš.)

### Návrhy: frontend (Matouš)

- **F‑a. Štítek zdroje dat v hlavičce:** „živá data ze serveru“ nebo „offline snímek“ podle `/api/health`. Porota uvidí, že běží backend, a my uvidíme, když spadne fallback.
- **F‑b. Karta uzavírky z `/closures/preview`:** auta za den s kvalitou (`csd2025` / `odhad`), středoškoláci denně, odříznuté obce, dojezd ZZS a HZS (`rescue.obce` s časem před a po, limit 20 min), kolize s jinými uzavírkami. Rozšiřuje M-b o T18.
- **F‑c. → Přesunuto do plánu (14:20, kap. 21).** **Rozpad skóre z API:** `GET /api/useky/{id}` vrací `breakdown` po faktorech, včetně T20. Nahradí výpočet v `priority.ts` a čísla budou stejná jako v exportu.
- **F‑d. → Přesunuto do plánu (14:20, kap. 21).** **Aktuální uzavírky ŘSD na mapě:** `GET /api/closures` vrací i `srti` (NDIC, CC BY 4.0). Šedá vrstva „právě teď zavřeno“ vedle simulace.
- **F‑e. Načítání a chyby:** skeleton nebo spinner při čekání a krátká hláška při chybě 5xx. Teď se chyba schová do `console.warn` a tiše se přepne na lokální výpočet.
- **F‑f. Zůstává v nápadech (14:20).** **Hlasování a hlášení občana:** endpointy `votes` a `reports` existují, UI chybí. Tlačítko „Tahle silnice je špatná“ u úseku, u úředníka fronta hlášení.
- **F‑g. Zůstává v nápadech (14:20), S25 se nedělá.** **Odznak stability pořadí:** „jisté“ / „citlivé na váhy“ u úseku v top 100. Potřebuje B2.

### Návrhy: backend

- **B1. GZip** (D7), Šimon, 1 řádek.
- **B2. `GET /api/stability`:** `Engine.stability(weights)` (T10) je hotová, endpoint chybí. Vrací pro top N úseků, jak často zůstanou nahoře při náhodných vahách ±50 %. Šimon, asi 15 min.
- **B3. Zahřátí při startu:** v lifespanu spočítat také faktory T20, `stavby()` a `rescue`, nejen `people` a `demo_closures`. Pak první posuvník ani první rozpočet nečekají. Tomáš přidá `Engine.warmup()`, Šimon ho zavolá. Start serveru se prodlouží asi o 10 s.
- **B4. Malý režim žebříčku:** `?compact=1` vrací jen `id`, `score`, `priority`, `rank` a `pinned`. Geometrie a názvy má frontend ze `roads.json`. Asi 150 kB místo 1,7 MB. Šimon.
- **B5. Typy pro frontend z OpenAPI:** vygenerovat `src/lib/api-types.ts` z `/openapi.json` (balíček `openapi-typescript`). Chyby D1 a D2 by pak našel už překladač. Šimon a Matouš.
- **B6. Kontrola všech endpointů jedním skriptem:** `scripts/smoke_api.sh` přihlásí demo úředníka a zavolá všechny GET a náhledové endpointy přes proxy. Hodí se před ukázkou a po každém sloučení. Tomáš.
- **B7. Hesla demo účtů z `.env`** (D9), Šimon.

### Doporučené pořadí na odpoledne
1. **Před ukázkou přes tunel:** D9 a B1.
2. **Matouš najednou:** D1, D3 a D4, pak D2 a F‑b. Tím začne být backend v ukázce vidět.
3. B3 a D6: nové váhy ve skóre a posuvníky.
4. F‑a, F‑e, D5, D10.
5. Zbytek (B2, B4–B6, F‑c, F‑d, F‑f, F‑g, D8) podle času.

---

## Část E: celkové hodnocení z pohledu poroty (15. 10. 13:00, Tomáš)

Doplněk k části D. D je o tom, jak spolu mluví frontend a backend. E je o tom, **co porota v ukázce uvidí a co ne**. Stav `main` `7ea72fc`: backend 49/49 testů, `npm run build` projde.

**Shrnutí:** jádro a API jsou hotové a silné. Porota ale uvidí hlavně frontend, a ten skoro všechno počítá lokálně. Na `main` je přihlášení, rozpočtový plánovač, Moje cesty, patička a nový design. Největší rizika jsou tři: **★2 nejde ukázat**, **pitch a PDF nemá nikdo** a **silná data z jádra nejsou na obrazovce**.

### Důležité nedostatky
**→ Přesunuto do plánu (14:20):** E1–E8 mají vlastníky a pořadí v [PLAN_FINAL.md](PLAN_FINAL.md), kap. 20 a 21. Tady jsou jen jako hodnocení.

**E1. ★2 Web Push ve frontendu chybí úplně.** Není service worker ani `PushManager`. V Moje cesty je jen zaškrtávátko „Poslat upozornění“. Backend (`notify/`, `/api/me/push-subscription`, VAPID) je hotový. Příběh „úředník potvrdí uzavírku → občanovi pípne telefon“ je druhý pilíř pitche. Bez něj ukázat aspoň seznam upozornění v aplikaci (`GET /api/me/notifications`). (Matouš, Šimon.)

**E2. Pitch, PDF/PPTX a záložní video nemá nikdo.** Odevzdání 17:15, freeze 16:00. Pitch je 5 minut a rozhoduje víc než kterákoli funkce. (Tým, hned.)

**E3. Rozpočet na obrazovce je lokální odhad, ne T17.** `src/lib/budget.ts` sám píše, že čeká na API. Souvislé stavby, porovnání dvou částek a AI text jsou v backendu (`/api/budget`), na obrazovce ne. Porota z ekonomické gesce uvidí slabší verzi. (Matouš.)

**E4. Skutečná data kraje nejsou vidět.** Ukázkové uzavírky v simulátoru jsou 3 naše úseky, ne 20 skutečných plánů kraje 2022 (`/api/demo-closures`). Aktuální uzavírky ŘSD (SRTI) nejsou na mapě. Studenti, odříznuté obce a dojezd IZS jsou jen v náhledu z API, který frontend nevolá (D2). Tohle je přitom naše hlavní odlišení od RoadMapperu. (Matouš, navazuje na D2.)

**E5. AI není nikde vidět.** Backend má zdůvodnění, oznámení a váhy z textu, frontend nevolá nic z `/api/ai/*`. Oznámení o uzavírce je pořád šablona z `src/lib/announce.ts`. Nevíme, jestli máme platný klíč. (Šimon ověří klíč, Matouš jedno tlačítko „Zdůvodnit“ v detailu.)

**E6. Nové faktory T20 mají váhu 0.** Intenzita, objížďka a studenti jsou ve skóre, ale nic nemění. Řeší T24 v `PLAN_FINAL.md`, kap. 19.4 (váhy 50 po D1 a D6).

**E7. Povodeň nemá obrazovku.** Jádro i API jsou hotové. Silné pro porotu z krizového řízení, ale až po E1–E5. (Matouš, jen když zbude čas.)

**E8. Ukázka stojí na jednom Macu a tunelu.** Záložní statický web (GitHub Pages) ani video zatím nejsou. Mobil na 375 px nikdo neověřil. (Přemek.)

### Co je dobře (říct v pitchi)
- Deterministické skóre se 4 třídami, připnutí s důvodem, audit.
- Objížďka po grafu pro 81,5 % úseků, auta za den ze sčítání ŘSD 2025 (měřeno 1 343 km, zbytek označený „odhad“).
- Z dat kraje: středoškoláci na úseku, odříznuté obce, dojezd záchranky a hasičů, povodeň Q5/Q20/Q100, skutečné plány 2022.
- Přihlášení se 3 rolemi, otevřené API, export CSV/GeoJSON s metadaty DCAT‑AP‑CZ.

---

## Zamítnuto

- Nehody Policie ČR (č. 10) pro dnešek, 15. 10. Po hackathonu znovu.
- Veřejný odkaz a QR ke každé uzavírce (pro web obce, zastávku). Stačí upozornění pro přihlášené.
- Samostatný pohled „peníze kraje po okresech“. Místo něj je rozpočtový asistent (nápad 1).
- Živé hlasování publika během pitche.
