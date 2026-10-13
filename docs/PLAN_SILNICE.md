# Nápad: portál oprav silnic — review a doporučená podoba

Stav k 13. 10. 2026. Čísla jsou ověřená přímo z API datového portálu KHK (ArcGIS FeatureServer).

## Verdikt
Dobrý směr, ale v podobě „mapa stavu silnic a oprav“ **neprojde na unikátnosti**. Přesně s tím vyhrál RoadMapper v roce 2022. Novinka musí být jinde: **transparentní pořadí, co opravit dřív a proč**, podle dopadu na lidi. To nikdo nedělal a data na to existují.

## Pitch číslo (ověřeno)
- Krajské silnice II. a III. třídy: **3 192 km** v datasetu „Stav povrchu silnic“ (poslední měření každého úseku).
- Havarijní + SUPERhavarijní: **1 375 km (43 %)**; s „nevyhovující“ 1 865 km (58 %).
- Opravy 2015–2024: 906 km, tj. **~90 km ročně**.
- Při tomto tempu trvá jen oprava havarijních úseků **~15 let**. Proto rozhoduje pořadí.

Pozor: stav je měřený v různých letech (2018–2024, většina 2023–2024). Část úseků mohla být mezitím opravena. Aplikace to musí ošetřit (spojit s opravami podle `ozn_sil_usek` a roku).

## Vady původní myšlenky
1. **„Čím víc datasetů, tím líp“ platí jen napůl.** Kritérium „otevřená data“ boduje množství i smysl. Porota jsou datoví lidé (DIA, Data KHK, NKÚ, MF). Dataset přilepený bez logiky ubere důvěryhodnost. Pravidlo: každý dataset buď mění skóre priority, nebo odpovídá na otázku občana.
2. **Policejní služebny samy o sobě do priority oprav nepatří.** Obhajitelné jen jako součást faktoru „dostupnost IZS“ (ZZS 16 základen, HZS, policie 36 služeben, nemocnice). Silnější „policejní“ data jsou **dopravní nehody** (Policie ČR / CDV, NKOD) — nehody na havarijních úsecích = bezpečnost. Dostupnost a licenci ověřit předem.
3. **MHD v datech kraje není.** Kraj má regionální linky IREDO/VDKHK (197 linek, 4 538 zastávek, 3 515 zaručených přípojů). Městská MHD (DPMHK) je mimo a silnice II./III. třídy stejně vedou hlavně mimo města. Říkat „veřejná doprava“, ne „MHD“.
4. **Plánované opravy v datech nejsou.** Dataset oprav obsahuje jen realizované opravy (`rok_real`). Neslibovat „kdy to opraví“.
5. **Linky nemají frekvenci spojů.** Náhrada: počet linek na úseku + zastávky podél + zaručené přípoje na nich. Linky a silnice jsou z různých zdrojů, spojení jde přes prostorový buffer (~30 m) a podíl překryvu.
6. **Občan opravy nerozhoduje.** Bez důvodu pro občana padá kritérium „využití pro veřejnost“. Viz pohled „Moje trasa“ níže.

## Doporučená podoba: „Které silnice dřív?“
Dvě obrazovky nad stejnými daty.

### A) Pro kraj — prioritizační mapa
- Každý úsek dostane **skóre priority 0–100** složené z faktorů níže.
- **Posuvníky vah** (stav, doprava, IZS, školy, bezpečnost…) → mapa a žebříček Top 20 se přepočítají živě. Wow moment dema.
- Detail úseku: proč je vysoko, rozpad skóre, kdy byl naposledy opraven.
- Export žebříčku jako **GeoJSON/CSV = nová otevřená data** → přímo na Data KHK (kritérium „využití pro kraj“).

### B) Pro občana — „Moje trasa / moje obec“
- Vyberu obec nebo autobusovou linku → stav silnic na trase, poslední oprava, pořadí v prioritách kraje.
- AI vysvětlí lidsky: „Úsek X je havarijní, jezdí po něm 4 linky a vede k výjezdové základně ZZS, proto je v kraji na 12. místě.“
- Volitelně, jen když zbude čas: nahlášení výmolu → publikované jako otevřená data.

## Faktory skóre a datasety
| Faktor | Datasety | Proč |
|---|---|---|
| Stav povrchu | Stav povrchu silnic | základ |
| Čas od opravy | Opravy liniové + bodové od 2016 | dlouho neopravené dřív |
| Veřejná doprava | Autobusové linky VDKHK, zastávky IREDO, zaručené přípoje, železniční stanice | kolik lidí to reálně využívá |
| Dostupnost IZS | Výjezdové základny ZZS, stanice HZS, služebny Policie ČR, nemocnice, LPS | sanitka a hasiči po havarijní silnici |
| Školy | Školy a školská zařízení, dojížďka do SŠ | cesty dětí |
| Důležitost v zimě | Plán zimní údržby (pluhování / chemický posyp) | co kraj sám považuje za důležité |
| Riziko | Záplavová území Q100 / aktivní zóna | odolnost silnice |
| Sociální dopad | Hospodářsky a sociálně ohrožené oblasti | spravedlnost |
| Bezpečnost (ověřit) | Dopravní nehody (NKOD, Policie ČR / CDV) | nehody na špatných úsecích |
| Kontext | Hranice obcí / ORP, počty obyvatel (ČSÚ, NKOD) | agregace pro obec |

Celkem ~15–18 datasetů a všechny mají v modelu smysl. To je silnější než 60 datasetů nahodile.

## Technika (realisticky na 7,5 h)
- Data: všechny vrstvy jsou na ArcGIS FeatureServer / GeoJSON download (`services6.arcgis.com/ogJAiK65nXL1mXAW/...`). Klíč pro spojení stavu a oprav: `ozn_sil_usek`.
- Předzpracování (Python + geopandas nebo turf.js): buffer spojení linky ↔ úseky, vzdálenost úsek ↔ IZS / školy. Výsledek = jeden GeoJSON s faktory na úsek. Skóre se počítá v prohlížeči, takže posuvníky jsou okamžité.
- Frontend: Leaflet nebo MapLibre + jednoduchý panel. Všechno česky.
- AI: zdůvodnění úseku z jeho faktorů (Azure OpenAI od Microsoftu). Mít statický fallback text, kdyby API spadlo.
- Stránka „Zdroje dat“ s odkazy (povinné).

## Rozvrh dne
- 9:00–10:30 data + spojení vrstev (1 člověk), kostra mapy (1), UI panel (1)
- 10:30–12:00 skóre + posuvníky, detail úseku
- 12:30–14:30 pohled občana, AI zdůvodnění
- 14:30–16:00 Top 20, export, Zdroje dat; 1 člověk od 15:00 jen na pitch a PDF
- 16:00 freeze, 16:00–17:00 stabilizace, nahrát záložní video dema, zkouška pitche

## Pitch (5 min)
1. Problém (30 s): 1 375 km havarijních silnic, 90 km oprav ročně, 15 let.
2. Demo kraj (2 min): posuvníky → přeskládá se mapa a Top 20.
3. Demo občan (1 min): moje linka → stav, pořadí, AI vysvětlení.
4. Data a přínos (1 min): kolik datasetů a proč každý, export jako otevřená data na Data KHK.
5. Rozvoj (30 s): napojení na plán investic, hlášení občanů, nehody.

## Do čtvrtka
- [ ] Ověřit dataset dopravních nehod (otevřený, území KHK, souřadnice).
- [ ] Stáhnout všechny vrstvy lokálně (záloha bez Wi‑Fi) a vyzkoušet spojení `ozn_sil_usek`.
- [ ] Rozhodnout váhy výchozího skóre a zdůvodnit je jednou větou.
- [ ] Rozdělit role.
