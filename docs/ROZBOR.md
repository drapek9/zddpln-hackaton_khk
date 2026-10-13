# Hackathon Královéhradeckého kraje 2026 — rozbor a strategie na 1. místo

Stav k 13. 10. 2026. Zdroje: oficiální pravidla 2026 (`podklady/Pravidla_2026.pdf`), stránka poroty a mentorů na datakhk.cz, prezentace organizátorů z ISSS 2026 (`podklady/ISSS2026_DataKHK_hackathony.pdf`), tiskové zprávy kraje.

## 1. Fakta, která rozhodují

| Co | Hodnota |
|---|---|
| Termín | **čt 15. 10. 2026, 8:00–21:00**, FIM UHK, budova J, aula J1 |
| Tým | 3–4 lidi, studentský průkaz / potvrzení o studiu u registrace |
| Programování | 9:00–12:00 a 12:30–17:00 = **7,5 h** |
| Odevzdání | **17:00–17:15**: zdrojáky + náhled jako `.pptx`/`.pdf` na flash disk pořadatele. Bez toho nesmíte prezentovat. |
| Prezentace | 17:15–20:15, **5 minut, forma „ukázka fungování“** (demo, ne slajdy) |
| Jazyk | Aplikace **musí být česky**; jazyk programování libovolný |
| Data | Aspoň část funkcí na otevřených datech KHK nebo NKOD (území KHK); v aplikaci odkaz na použité datasety |
| Licence | Kód půjde na `github.com/krhk`, volná licence, majetek pořadatele |
| AI | Vítána; Microsoft dává přístupy (GitHub Copilot, Azure for Students) |
| Ceny | 20 000 / 10 000 / 5 000 Kč + cena diváků 2 500 / 1 500 / 1 000 Kč |

### Hodnocení (čl. 6)
- **1. kolo**: každý porotce dá 0–10 bodů za 4 kritéria, součet:
  1. **Unikátnost** — je to nové, něco, „co nám chybí“?
  2. **Otevřená data** — jak moc a jaká data KHK / NKOD využíváte
  3. **Využití pro Královéhradecký kraj** — hodí se k dalšímu rozvoji a **publikaci na Data KHK**
  4. **Využití pro veřejnost** — užitečnost pro širokou veřejnost, potenciál dalšího rozvoje
- **2. kolo**: top 5 → porota určí pořadí **volně, body z 1. kola nehrají roli**. Rozhoduje dojem a příběh.
- **Cena diváků**: online hlasování všech přítomných (~80 soutěžících + porota + mentoři).

Pozor: 3 ze 4 kritérií nejsou technická. Technika se hodnotí jen nepřímo přes demo.

## 2. Porota 2026 — kdo hodnotí a co chce slyšet

| Porotce | Kdo | Na co slyší |
|---|---|---|
| Ing. Jaromír Dědeček | radní pro **ekonomickou gesci**, garant Data KHK | přínos pro kraj, ekonomika, prestiž portálu |
| Jana Novák Gabrielová | DIA, správa dat ve veřejné správě, ex-NKÚ | kvalita a standardy dat, otevřená data |
| Ing. Juraj Brigant | ředitel odboru **Kontroly, MF ČR** | kontrola, audit, analýza veřejných peněz pomocí IT |
| Mgr. Jaroslav Broža | NKÚ, organizátor **hackujstat.cz** | transparentnost, srozumitelnost pro občana; vítězové KHK postupují na HackujStát |
| Ing. Barbora Tesařová | FIM UHK, databáze, BI | datová analýza, dashboardy |
| Zbyněk Hála | analytik kraje, velké datové sady | práce s objemnými daty |
| Doc. Josef Horálek | FIM UHK, kyberbezpečnost | bezpečnost, robustnost |
| Mgr. Tomáš Merta | Data KHK, **GIS**, autor portálu | mapy, vizualizace, napojení na portál |
| Ing. Karel Rejthar | lektor IT | použitelnost pro běžného člověka |
| Milan Šulc | Data KHK, software architekt, open source | čistý kód, GitHub, open source |

Mentoři (můžete je během dne využít): Havelka (Unicorn, Java/Node), Rejthar, Šulc, Těhan (Microsoft, Azure + AI).

Závěr: porota je převážně **veřejná správa a data**, ne vývojáři. Vyhrává jasný přínos pro občana a kraj + chytře zkombinovaná data, ne technická hloubka.

## 3. Minulí vítězové a proč vyhráli

| Rok | 1. místo | Aplikace |
|---|---|---|
| 2019 | SPŠ el-it Dobruška | web nad daty kraje |
| 2022 | team.devs, DELTA Pardubice | **RoadMapper** — stav povrchu silnic II./III. třídy + plánované opravy |
| 2023 | Hackneme to, Křesťanské gymnázium Praha | **vyhledávač SŠ/VOŠ** pro uchazeče (na HackujStát pak „Můžu zde?“ – 1. místo) |
| 2024 | Goober devs, SPŠ Dvůr Králové | **aktivity pro seniory** |
| 2025 | Mackokládi, SPŠ Dvůr Králové | **KompaZ** — 200+ životních a krizových situací, AI asistent, mapa napojená na spoje; **62 datových sad**; pak 1. místo na HackujStát |

Další umístění: 2024 – trasa k památkám (Dobruška), akce pro mladé (DELTA); 2025 – výběr bydlení (EDUCA), Lifely (SPŠE Pardubice). Na HackujStát uspěly i „LékařNaKlik“, „MEET.MAP“, „Hradecký dobrodruh“, „Sněmovna pro lidi“.

### Vzorec vítězů
1. **Konkrétní cílová skupina a konkrétní problém** (senior, uchazeč o SŠ, řidič, člověk v krizi). Ne „portál pro všechny“.
2. **Data kraje v jádru**, ne jako ozdoba. Kraj chce vidět své datasety v akci (RoadMapper = přímo dataset „Stav povrchu silnic“).
3. **Mapa** skoro vždy. Merta je GIS člověk.
4. **Kombinace mnoha datasetů** — KompaZ 62 sad. Trend roste.
5. **AI jako asistent, který vysvětlí** (2025, kdy AI poprvé vítána). Pro rok 2026 je AI explicitně podporovaná, takže ji bude mít skoro každý → AI sama o sobě už nediferencuje.
6. **Hotové, klikatelné demo** s čistým UI. Demo, ne slajdy.
7. **Opakující se školy**: Dvůr Králové vyhrál 2× po sobě → počítejte, že přijdou znovu a připravení.

### Co je už „vyčerpané“ (riziko pro kritérium unikátnost)
- turistika, památky, výlety, trasy (Turistník, Netwach, Hradecký dobrodruh, Lokátor)
- vyhledávač škol (2023), lékařů (LékařNaKlik), akcí pro mladé (2024)
- průvodce životními situacemi s AI chatem a mapou (**KompaZ 2025**)
- „chat s otevřenými daty“ — kraj už má studentskou „Mapu dat s AI“ (katalog.datakhk.tech)
- bezpečnostní mapa s hlášením incidentů (Jičín 2025, 16. místo)

## 4. Málo využitá data (příležitost)

Katalog KHK má ~133 datových sad. Málo vytěžené, a přitom „sexy“ pro tuto porotu:
- **Peníze kraje**: schválené dotace 2021–2025 po ORP/okresech/kraji, příjmy, výdaje, kapitálové výdaje, investice, dluh, úvěry, sdílené daně → Brigant (MF kontrola), Broža (NKÚ), Dědeček (ekonomika)
- **Záplavová území** Q5/Q20/Q100/Q500 + aktivní zóna
- **Doprava**: autobusové linky a zastávky VDKHK, železnice, **zaručené přípoje**, plán zimní údržby silnic, opravy silnic od 2016
- **Školství**: přijímací řízení SŠ/VOŠ, **dojížďka do SŠ**, počty žáků v oborech, absolventi VŠ
- **Krizová infrastruktura**: výjezdové základny ZZS, stanice HZS, služebny Policie, nemocnice, LPS
- **Rozvoj**: hospodářsky a sociálně ohrožené oblasti (HSOO), ZÚR, průmyslové zóny, kanalizace v obcích
- NKOD navíc: ČSÚ statistiky po obcích, jízdní řády (GTFS/CIS JŘ), ČHMÚ, RÚIAN adresy

## 5. Směry nápadů (seřazeno podle předpokládaného skóre)

1. **„Moje obec / Kam tečou peníze“** — zadám obec nebo adresu, vidím, kolik do ní šlo dotací a investic kraje, opravy silnic, porovnání s podobnými obcemi, AI to vysvětlí lidsky.
   Plus: 6 porotců z kontroly, NKÚ, ekonomiky a dat. Unikátní (zatím nikdo nevyhrál s financemi). Přímo publikovatelné na Data KHK.
   Minus: „využití pro veřejnost“ je slabší → nutný silný občanský příběh („jsem starosta / občan, chci vědět…“).
2. **„Profil adresy“ (bydlení / krizová připravenost)** — adresa → záplavová zóna, nejbližší ZZS/HZS/nemocnice + dojezd, zimní údržba, spoje, školy.
   Plus: silně mapové, mnoho datasetů, konkrétní a hmatatelné. Minus: částečný překryv s KompaZ a s „výběrem bydlení“ (2025, 2. místo).
3. **„Do školy bez auta“** — přijímací řízení + dojížďka + VDKHK linky + zaručené přípoje → reálná dosažitelnost SŠ z mé obce, plus pohled pro kraj (kde chybí spoje).
   Plus: dvojí přínos (občan i kraj jako plánovací nástroj). Minus: překryv s vítězem 2023.

Obecný „zabiják“: **dvě obrazovky — občan + úředník kraje**. Kritérium „využití pro kraj“ se tím boduje explicitně, a to ostatní týmy obvykle nedělají.

## 6. Checklist pro review vašeho plánu (typické vady)

- [ ] Odpovídá plán každému ze 4 kritérií **jednou větou do pitche**?
- [ ] Je jasná **jedna** cílová skupina a **jeden** hlavní scénář pro demo?
- [ ] Nekryje se nápad s KompaZ / vyhledávačem škol / turistikou / chatem nad daty?
- [ ] Jsou **jmenovitě vybrané datasety KHK** a ověřené, že jdou stáhnout a mají potřebná pole (souřadnice, kód obce)?
- [ ] Je rozsah na **7,5 h** realistický? Scope = 1 hlavní flow hotový na 100 %, ne 5 flow na 60 %.
- [ ] Je hotový „**freeze**“ v 16:15 a do 17:00 jen stabilizace, PDF a zkouška dema?
- [ ] Je připravený **offline záložní režim** dema (cache dat lokálně, video záznam), kdyby padla Wi‑Fi nebo AI API?
- [ ] UI je **celé česky** včetně chybových hlášek a AI odpovědí?
- [ ] V aplikaci je **stránka „Zdroje dat“** s odkazy na datasety (povinnost dle pravidel)?
- [ ] Repo připravené k předání: README, LICENSE (MIT/Apache), bez klíčů v kódu (`.env` mimo repo)?
- [ ] Rozdělení rolí: data / backend, frontend + mapa, AI, **pitch + PDF + demo** (jeden člověk od 15:00 jen na prezentaci)
- [ ] Plán pro **cenu diváků** (krátké QR / odkaz na živou appku na slajdu)
- [ ] Pitch do 5 min: problém (30 s) → živé demo (3 min) → data a přínos pro kraj (1 min) → další rozvoj (30 s)

## 7. Co udělat do čtvrtka

1. Přečíst přílohu z mailu od T. Slezáka „Požadavky na soutěžící od UHK.docx“ (z Gmailu ji neumím stáhnout).
2. Aktivovat GitHub Student Pack / Copilot a Azure for Students **před soutěží** (ověření trvá).
3. Vybrat nápad a 5–10 konkrétních datasetů; stáhnout je a prohlédnout strukturu.
4. Připravit prostředí: šablonu projektu, mapovou knihovnu (Leaflet + OSM / Mapy.cz API), deploy (Azure Static Web Apps / Vercel), AI klíč.
5. Pravidla neříkají nic o předem napsaném kódu. Výsledné dílo ale musí vzniknout na soutěži. Bezpečné: research, design, datová příprava, prázdná šablona. Riskantní: hotové funkce. Při pochybnosti se zeptat T. Slezáka (tslezak@khk.cz).
6. Nacvičit 5min demo nanečisto aspoň 2×.
7. Studentské průkazy / potvrzení o studiu.
