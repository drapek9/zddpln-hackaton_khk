# Pitch Cesty KHK: pracovní rozpis

**Vlastník: Přemek.** Společně ho doladíme kolem 15:00. Do té doby je to živý koncept: kdo se o čemkoli rozhodne, připíše to sem (jen přidávat, zastaralé označit **NEAKTIVNÍ**).
Zdroj: [PLAN_FINAL.md](../PLAN_FINAL.md) kap. 1 (výtky), kap. 2 (osnova), kap. 17.5 a 20; [NAPADY.md](../NAPADY.md) část E; [ROZBOR.md](ROZBOR.md) (porota, kritéria).

Termíny: feature freeze **16:00**, odevzdání **17:00–17:15** (kód + `.pptx`/`.pdf` na flashce). Pitch **5 min**, do top 5 pak volné hodnocení podle dojmu a příběhu, cena publika.

---

## 1. Jedna věta
> Kraj v posledních letech opravoval zhruba 90 km silnic ročně a havarijních je 1 375 km. Ukážeme, co opravit dřív, jak to uzavřít s nejmenší škodou a jak se o tom lidé dozví.

## 2. Osnova 5 minut (podle kap. 2, upraveno na to, co dnes reálně funguje)

| Čas | Kdo mluví / co je na plátně | Co říct |
|---|---|---|
| 0:00–0:30 | slajd s mapou kraje | Příběh: Hronov, uzavírka II/303. Každý den po ní jede **589 středoškoláků** a **8 246 vozidel** (ŘSD 2025). Pak čísla: 1 375 km havarijních, ~90 km/rok, **nejméně 15 let**. Proto rozhoduje pořadí. |
| 0:30–2:00 | ★1 úředník (živě) | Žebříček podle skóre, detail úseku s faktory, připíchnutí priority s důvodem. **Hlavní moment:** simulace uzavírky II/303 Velké Poříčí – Hronov: objížďka na mapě, +km/+min, auta, studenti, odříznuté obce, dojezd ZZS/HZS. „Potvrdit“. |
| 2:00–3:15 | ★2 občan (telefon nebo druhá záložka) | Občan má uloženou trasu domov–škola. Po potvrzení uzavírky mu přijde upozornění. **Web Push jen když v 16:00 funguje** (E1), jinak ukázat seznam upozornění v „Moje cesty“. |
| 3:15–4:15 | ★3 admin a data | Váhy (trvalé, audit změn), export CSV/GeoJSON s metadaty DCAT‑AP‑CZ, veřejné API, stránka Zdroje dat. „Vracíme kraji nová otevřená data.“ |
| 4:15–5:00 | slajd | Co bylo připravené a co vzniklo dnes. Rozvoj: napojení na skutečný plán investic, nehody, nasazení u kraje. QR jen když funguje mobil. |

## 3. Demo scénář (klik po kliku) — doplnit podle stavu v 15:30
1. Předem: úředník přihlášený na notebooku, občan na telefonu. **Nepřihlašovat před porotou, hesla neukazovat.**
2. Žebříček: ukázat top úsek, klik na detail, faktory skóre (stav, intenzita, nemocnice, školy, autobusy…).
3. Simulace: vybrat doporučenou uzavírku z `/api/demo-closures` (skutečný plán kraje 2022) **II/303 Velké Poříčí – Hronov** → karta: objížďka +0,8 km, 8 246 vozidel, 589 studentů.
   - Záloha pro „velký“ efekt: **II/302 Broumov – Velká Ves** (7 909 vozidel, 447 studentů, objížďka +14,6 km / +16 min, 2 obce přes limit dojezdu ZZS) nebo **III/28526 Jizbice – Lipí – Náchod** (+31 km / +33 min).
4. Potvrdit uzavírku → přepnout na telefon občana → upozornění.
5. Admin: změnit váhu, ukázat záznam v auditu, stáhnout export.
6. Zdroje dat: seznam sad s licencemi.

**TODO Přemek + Matouš:** projít scénář nanečisto v 15:30 a zapsat sem, co skutečně kliká (D1–D10, E1–E8).

## 4. Klíčová čísla (všechna ověřitelná)
**Ověřeno 14:20 (Tomáš) přímo z jádra nad snímkem `public/data`:** všech 9 řádků sedí (4 726 úseků, 3 192 km, 1 375,6 km havarijních = 43 %, objížďka 81,5 %, ŘSD 1 343 km, 22 382 studentů v 5 011 tocích, 448 obcí, 20 úplných uzavírek 2022). Pro slajd 4: II/303 Velké Poříčí – Hronov = 589 středoškoláků denně, 8 246 vozidel (sčítání ŘSD 2025), objížďka +0,8 km / +2 min, ZZS přes 20 min v 1 obci (Machov).

| Číslo | Zdroj |
|---|---|
| 1 375 km havarijních a superhavarijních silnic (43 % sítě) | Data KHK, `docs/PLAN_SILNICE.md` |
| 906 km oprav 2015–2024 = ~90 km/rok | Data KHK |
| 4 726 úseků, 3 192 km silnic II. a III. třídy | Data KHK |
| objížďka nalezena u 81,5 % úseků | náš graf: Data KHK + OSM (ODbL) |
| auta měřená na 1 343 km (~44 %), zbytek „odhad“ | sčítání ŘSD 2025 (CC BY‑SA) |
| 22 382 středoškoláků denně, 5 011 toků | Data KHK |
| 448 obcí, záplavy Q5/Q20/Q100 | Data KHK |
| 20 skutečných úplných uzavírek z plánu 2022 | Data KHK |
| aktuální uzavírky ŘSD | NDIC SRTI (CC BY 4.0) |

## 5. Jedna věta na kritérium
- **Unikátnost:** RoadMapper (vítěz 2022) ukazoval stav. My řešíme pořadí oprav, dopad uzavírky na lidi a upozornění občanům.
- **Otevřená data:** 18+ sad Data KHK v jednom modelu, plus ŘSD, SRTI a OSM. Výstup vracíme jako otevřená data s metadaty DCAT‑AP‑CZ.
- **Využití pro kraj:** úředník vidí, co zavřít kdy a koho to zasáhne (studenti, IZS, odříznuté obce), dřív než podepíše.
- **Využití pro veřejnost:** občan se o uzavírce na své trase dozví sám, nemusí hledat.

## 6. Na koho v porotě co mluví
- **Dědeček (ekonomika):** pořadí = kam dát omezené peníze; rozpočtový scénář.
- **Novák Gabrielová (DIA, data) a Merta (GIS, Data KHK):** kolik sad, jak spojené, export zpět, Zdroje dat.
- **Brigant (MF kontrola), Broža (NKÚ):** deterministické skóre, audit změn, člověk rozhoduje, AI jen vysvětluje.
- **Tesařová (BI):** žebříček, filtry, export CSV.
- **Horálek (bezpečnost):** role, hesla hashovaná, token v httpOnly cookie, tajné klíče jen v `.env`. Jedna věta o GDPR: domov a práce jen jako bod, export bez osobních údajů.
- **Rejthar (použitelnost):** 3 role, mobil 375 px.
- **Šulc (open source):** veřejný repozitář, otevřené API.

## 7. Poctivé věty (říct je sami, dřív než se zeptají)
- „Kraj **opravoval** zhruba 90 km ročně“ — tempo, ne rozpočet. „**Nejméně** 15 let.“
- Objížďka: „Model pošle všechna auta jednou nejrychlejší trasou a nezná místní ulice. Ve skutečnosti se rozdělí.“
- Auta: měřená jen na ~44 % km, zbytek je odhad a v aplikaci tak označený. Nikdy „živý provoz“.
- Dojezd IZS je odhad (`estimate`).
- AI jen vysvětluje a navrhuje, štítek „návrh AI“. Pořadí počítá pevný vzorec.
- Běží u nás na notebooku, nasazení u kraje je další krok.

## 8. Připravené odpovědi na otázky (zkráceně z kap. 1)
| Otázka | Odpověď |
|---|---|
| Váhy jste si vymysleli. | Výchozí jsou expertní odhad, admin je ladí, každá změna je v auditu. Model doporučuje, úředník rozhoduje. |
| Kód vznikl před soutěží? | Podle odpovědi organizátorů: co bylo připravené a co vzniklo dnes (sekce 9). |
| Hlasování = populismus? | Slabá váha se stropem, 1 hlas na občana a úsek, admin ho vypne. (Jen když hlasování ukazujeme.) |
| AI rozhoduje o penězích? | Ne. AI nepočítá pořadí. |
| Prompt injection přes hlášení? | Výstup AI je pevná struktura, nic se z něj nespouští. |
| Proč ne RoadMapper? | Mapa stavu je jen náš základ. Nové je pořadí, uzavírky, objížďky a občan. |

## 9. Co bylo připravené a co vzniklo dnes — NEAKTIVNÍ (15. 10., 13:20: rozhodnuto nepsat, nepoužíváme)
- Před soutěží: _doplnit podle odpovědi organizátorů._
- Dnes: _doplnit_ (např. propojení frontend–backend, skutečné uzavírky 2022, studenti, IZS, povodně, přihlášení a role, export DCAT).

## 10. Slajdy pro PDF/PPTX (návrh, max. 7)
1. Titul + jedna věta.
2. Problém: 1 375 km / 90 km ročně / nejméně 15 let (jeden graf).
3. Řešení ve třech rolích: úředník, občan, admin.
4. Ukázka uzavírky II/303 (screenshot karty s čísly).
5. Data: loga/seznam sad + licence, export zpět.
6. Poctivost a bezpečnost: deterministické skóre, audit, role, GDPR.
7. Rozvoj + QR (QR jen když mobil funguje).

## 11. Záloha
- **Záložní video** celé ukázky (natočit do 16:30).
- **GitHub Pages** build frontendu se štítkem „offline ukázka bez serveru“ (po 15:00, E8).
- Když spadne tunel nebo Mac: pustit video, mluvit dál podle osnovy.

## 12. Zkontrolovat v 16:00 (odškrtnout)
- [ ] ★1 simulace bere čísla z backendu (D1, D2, E4).
- [ ] ★2 upozornění: Web Push, nebo aspoň seznam v „Moje cesty“ (E1).
- [ ] Rozpočet z `/api/budget` (E3), jinak o něm mluvit jen obecně.
- [ ] AI „Zdůvodnit“ funguje (E5), jinak vynechat.
- [ ] Mobil 375 px, jinak bez QR.
- [ ] Video a GitHub Pages hotové (E8).
- [ ] Demo účty přihlášené předem, hesla nikde na plátně.
