# TODO backend: top priority (15. 10. 2026, ~16:15, Tomáš podle Tomášova testu)

Majitelé: **Šimon** (`backend/app/api/`, `ai/`, `db/`, `main.py`), **Tomáš** (`backend/app/core/`, `scripts/`, `public/data/`).
Pořadí = priorita. Frontend k tomu je v [TODO_FRONTEND.md](TODO_FRONTEND.md). Po každém bodu `uv run pytest` a `scripts/smoke_api.sh`.

## P0 (do pitche)

| # | Kdo | Co | Hotovo, když |
|---|---|---|---|
| B‑AI‑1 | Šimon | **`GET /api/ranking?mode=params|ai`.** `mode=ai` vezme pořadí z core a pustí `app/ai/ranking.py` `reorder_window` (prvních 40, max posun 5 míst, připíchnuté se nehýbou). Funkce existuje, ale **žádný endpoint ji nevolá**. Ke každému řádku přidat `ai_shift` (int, + nahoru) a `ai_reason` (věta). Bez AI klíče vrátit pořadí parametrů a `ai_available: false`. Výsledek cachovat podle vah (AI se nevolá při každém kliknutí). | Přepínač ve frontendu ukáže jiné pořadí se štítky „návrh AI“. |
| B‑W‑1 | Šimon | **`GET /api/weights/schema`**: všech 14 parametrů z `core/schemas.py` `Weights` (`key`, `label`, `group`, `default`, `help`, `unit`). Frontend z toho kreslí panel vah, nic natvrdo. | Frontend ukazuje i `intensity`, `detour`, `students`, `votes`. |
| B‑W‑2 | Tomáš | Zkontrolovat, že `intensity`, `detour`, `students` mají v core rozumné normalizace a nenulový vliv, když je váha > 0. Test: váha 100 u `students` posune úsek se školní trasou nahoru. | Test v `tests/` prochází. |
| B‑N‑1 | Šimon | Role `official` v API zůstává, ale **texty pro uživatele** („Úředník“) v odpovědích, e‑mailech a auditu → „Správce“. | V odpovědích API není „úředník“. |

## P1

| # | Kdo | Co |
|---|---|---|
| B‑R‑1 | Tomáš | **Pokrytí silnic.** Dnes 4 726 úseků silnic II. a III. třídy kraje, všechny se stavem. Doplnit vrstvu ostatních silnic z OSM (`osm_roads.json`): I. třída (ŘSD) a místní komunikace, **bez soukromých a účelových** (`access=private`, `highway=track/service/private`). Bez stavu, štítek `src: "osm"`, `stav: null`. Do `/api/roads/other` nebo jako GeoJSON v `public/data`. |
| B‑P‑1 | Šimon | `GET /api/pois/{id}`: detail tečky (škola, nemocnice, zastávka, IZS) s názvem, adresou, zdrojem a nejbližšími úseky. Pro F‑5. |
| B‑1, B‑2 | Šimon + Tomáš | Filtry a hledání žebříčku na serveru (kap. 25.5). |
| B‑5 | Šimon | `home` podle role v `login` a `me`. |

## P2
- B‑3 uložené sady vah, B‑4 rozdíl pořadí, B‑7 přehled pro admina, B‑8/B‑9 filtry uzavírek a auditu (kap. 25.5).
- Kap. 25.10 žádost správce o přístup a schválení adminem (S35).

## Pravidla
- Skóre je deterministické. AI jen posouvá v okně a vrací důvod; člověk potvrzuje (připíchnutí).
- `schemas.py` jen přidávat pole. Hesla a klíče jen v `.env`.
