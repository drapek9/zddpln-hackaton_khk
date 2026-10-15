# TODO frontend: top priority (15. 10. 2026, ~16:15, Tomáš podle Tomášova testu)

Majitel: **Matouš** (`src/`). Pořadí = priorita. Hlavní cíl je **`/sprava`** (★1), na tu se teď soustředíme.
Backend k tomu je v [TODO_BACKEND.md](TODO_BACKEND.md). Cílová podoba obrazovek je v `PLAN_FINAL.md`, kap. 25.

**Povinné ověření:** každý bod po dokončení proklikat přes **Playwright** (rozšíření / MCP `playwright`): desktop 1440×900 i mobil 390×844, světlý i tmavý režim, bez chyb v konzoli. Screenshot přiložit do commitu nebo do `docs/funkce.html`. Bez proklikání bod není hotový.

## P0: co vadí nejvíc (do pitche)

| # | Co | Hotovo, když |
|---|---|---|
| F‑1 | **„Úředník“ → „Správce“ / „Správa“** všude v UI (štítek role, přepínač, menu, texty). Aplikace je pro kraj i město, ne pro úředníka. Role v kódu zůstává `official`. | Slovo „Úředník“ se v UI nevyskytuje. |
| F‑2 | **Přepínač pořadí: „Jen parametry“ / „Parametry + AI“** nad žebříčkem. „Parametry + AI“ volá `GET /api/ranking?mode=ai` (B‑AI‑1). U každého úseku, který AI posunula, štítek **„návrh AI“** a šipka ↑/↓ o kolik míst, po rozkliknutí věta s důvodem. Bez AI na serveru se přepínač zamkne s textem „AI teď není dostupná“. | Přepnutím se pořadí změní, u posunutých úseků je štítek „návrh AI“ a důvod. |
| F‑3 | **Všechny parametry v panelu vah.** Dnes chybí 4 z 14: `intensity` (vozidla/den), `detour` (délka objížďky), `students` (studenti/den), `votes` (hlasy občanů). Klíče a výchozí hodnoty bere z `GET /api/weights/schema` (B‑W‑1), ne natvrdo. Skupiny: Stav silnice, Lidé a služby, Doprava, Ostatní. | V panelu je 14 parametrů ve skupinách, každý s krátkým popisem. |
| F‑4 | **Váha jde napsat číslem.** Vedle slideru pole `0–100` (klik na číslo = editace, Enter potvrdí, šipky ±1, Shift ±10). Tlačítko „Výchozí“ u celé sady. | Do čísla jde napsat 37 a slider se posune. |
| F‑5 | **Rozkliknout jde všechno.** Každý řádek žebříčku, každá tečka i silnice na mapě otevře detail. Tečky (školy, nemocnice, zastávky, IZS, uzavírky) mají vlastní kartu s názvem a vzdáleností k úseku. Kurzor `pointer` a hover stav u všeho, co je klikací. | Klik na libovolnou tečku otevře kartu. |
| F‑6 | **Barvy silnic podle stavu, jasně oddělené.** Jedna škála pro stav (výborný → SUPERhavarijní) a **jiný kanál** pro opravy (přerušovaná čára nebo obrys, ne další odstín oranžové). Dnes „opotřebovaná“ i „dokončená oprava“ vypadají stejně oranžově. Legenda s oběma vrstvami a vypínači. | Na první pohled je jasné, co je stav a co oprava. |
| F‑7 | **Zelený okraj pryč.** Okraj kraje / panelů světlejší a neutrální (šedá, ne zelená), ať nevypadá jako silnice. | Žádná zelená čára, která jde splést se silnicí. |
| F‑8 | **Scroll v postranním panelu.** Panel má vlastní viditelný scrollbar, záhlaví (hledání, filtry, přepínač AI) zůstane nahoře (`position: sticky`), tlačítko „Nahoru“ po odscrollování. | Z konce seznamu se jde nahoru jedním klikem. |
| F‑9 | **Širší postranní panel.** Výchozí šířka **420–480 px** na desktopu, jde roztáhnout (Resizer) a šířka se pamatuje. | Detail úseku se vejde bez vodorovného scrollu. |
| F‑10 | **Nic se nepřekrývá.** Detail, váhy, legenda a mapové ovládání mají pevná místa. Otevřený detail zavře jiný plovoucí panel, `Esc` zavře horní vrstvu. | Při proklikání se žádné dva panely nepřekryjí. |

## P1: rozvržení `/sprava` (po P0)
- **Dvě části:** vlevo žebříček silnic (seznam + detail), vpravo **váhy jako plnohodnotný panel** (ne schovaný), uprostřed mapa. Na užším displeji jsou váhy záložka v levém panelu.
- **Silnice bez dat o stavu** (I. třída ŘSD, místní komunikace obcí) zobrazit šedě se štítkem „stav nesledujeme (není silnice kraje)“, vypínatelně. Soukromé a účelové cesty nezobrazovat. Data: B‑R‑1.
- Filtry žebříčku (třída, okres, stav, obec), hledání podle čísla silnice nebo obce (B‑1, B‑2).
- Prázdné stavy a chyby podle kap. 25.9 (skeleton, „Zkusit znovu“).

## P2: „next level“
- Detail úseku: rozpad skóre na příspěvky jednotlivých parametrů (sloupcový graf), proč je úsek tam, kde je.
- Porovnání pořadí před a po změně vah (B‑4, ↑/↓ u řádků).
- Uložené sady vah („Zima“, „Školy“, „Rozpočet“) (B‑3).
- Klávesové zkratky, tisk detailu, česká čísla všude.

## Co se nemění
- Skóre počítá backend deterministicky. AI jen posouvá v okně (max 5 míst) a vždy má štítek „návrh AI“.
- Žádná nová knihovna pro routing. Adresy `/`, `/sprava`, `/admin` už fungují (`src/lib/route.ts`).
