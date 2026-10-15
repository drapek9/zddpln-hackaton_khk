# Ukázka: průchod v prohlížeči

Spustit backend a frontend (viz [README.md](../README.md)). Průchod udělat na desktopu i na mobilu 375 px. Osnova je v [PITCH.md](PITCH.md) (sekce 2 a 3).

Pokud krok nejde, značka „✗“ a poznámka. Neskrývat.

## ★1 Úředník (desktop)
- [ ] Přihlásit `urednik` (heslo z `seed.py`, ne na plátno). Vidět žebříček s údajem o zdroji dat.
- [ ] Otevřít první úsek, ukázat faktory skóre.
- [ ] Připíchnout úsek s důvodem; po obnovení stránky pin zůstane.
- [ ] Simulace: II/303 Velké Poříčí – Hronov. Čekáme: 589 studentů, 8 246 vozidel, objížďka +0,8 km.
- [ ] Ukázat objížďku na mapě, dojezd ZZS/HZS, odříznuté obce.
- [ ] Záloha: II/302 Broumov – Velká Ves (7 909 vozidel, +14,6 km / +16 min).
- [ ] Potvrdit uzavírku.

## ★2 Občan (telefon, 375 px)
- [ ] Přihlásit `obcan1`. Otevřít „Moje cesty“, vidět uloženou trasu.
- [ ] Seznam upozornění obsahuje potvrzenou uzavírku.
- [ ] Zapnout upozornění (Web Push). Pokud nejde, ukázat seznam a říct to.

## ★3 Admin a data
- [ ] Přihlásit `admin`. Změnit váhu, ukázat záznam v auditu.
- [ ] Stáhnout export CSV nebo GeoJSON, ukázat metadata DCAT‑AP‑CZ.
- [ ] Stránka Zdroje dat: seznam sad s licencemi.

## Veřejnost (bez přihlášení)
- [ ] Mapa oprav a uzavírek, štítek „simulace“ u demo dat.
- [ ] Landing se nezasekne na mobilu.

## Výsledek
Datum a čas: ____  Prohlížeč: ____  Zařízení: ____
Chyby: ____

## Záznam průchodu (15. 10., 14:10, Chrome přes náhled, localhost, seed účty)
- **Veřejná mapa:** SRTI body (bílé, tmavý okraj) z `/api/closures`, 45 bodů v kraji. OK.
- **★1 úředník, simulace:** v UI funguje na libovolném úseku. II/302 Náchod: „Uzavírka“ → objížďka +7,9 km, +10 min. OK.
- **★1 II/303 v UI:** NEOK. Ukázkové uzavírky v UI jsou II/324, II/502, III/300 (lokální demo). II/303 z `/api/demo-closures` tam není. Úsek 303.3 (id 2773) jde najít jen přes API.
- **Potvrzení uzavírky:** NEOK v UI. Tlačítko „Potvrdit“ jsem v tomto zobrazení nenašel. Uzavírku II/303 (road 2773, testovací, `simulated: false`) jsem založil a potvrdil přes API `POST /api/closures` a `POST /api/closures/{id}/confirm`. Potvrzení vrátilo `notified: 1`.
- **Upozornění občanovi:** OK. `obcan1` dostal upozornění „Uzavírka na vaší trase“ (II/303). Trasa se uložila přes API (`PUT /api/me/places`, `GET /api/me/route`). Domov a práce se ale v UI nezobrazí jako nastavené, protože místa jsou v `localStorage`. Na mobilu se upozornění zobrazí.
- **Web Push:** NEOK, neověřeno. Tlačítko „Zapnout upozornění v prohlížeči“ je vidět, klik jsem nezkoušel. Potřebuje VAPID klíč a souhlas.
- **Mobil 375 px:** OK pro „Moje cesty“ a upozornění. Bez vodorovného posunu. Ostatní obrazovky neověřeny.
- **★3 export a Zdroje dat:** OK. `/api/export.csv` (504 kB), `/api/export.geojson` (2,4 MB), `/api/export/metadata.jsonld` (DCAT‑AP‑CZ). Stránka Zdroje dat se načte.
- **NEOK, text:** na stránce Zdroje dat stojí „Plánované a probíhající opravy kraj jako otevřená data nezveřejňuje“. Neplatí, protože používáme plán 2022 z Data KHK. Opravit text (Matouš).
