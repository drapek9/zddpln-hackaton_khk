"""Czech API documentation for the open-data page."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["Dokumentace"])

PAGE = """<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <title>Cesty KHK — dokumentace API</title>
  <style>
    body { font-family: Georgia, serif; max-width: 46rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.45; color: #1c1917; }
    code { font-family: ui-monospace, monospace; font-size: 0.92em; }
    h1 { font-size: 1.7rem; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border-bottom: 1px solid #d6d3d1; text-align: left; padding: 0.35rem 0.4rem; vertical-align: top; }
  </style>
</head>
<body>
  <h1>Cesty KHK — veřejné API</h1>
  <p>Licence aplikace i tohoto rozhraní je <strong>EUPL-1.2</strong>. Export obsahuje skóre, třídu priority a stav úseku. Auta za den jsou ze sčítání ŘSD 2025 (CC BY-SA 4.0) nebo mají štítek <code>odhad</code>. Když údaj chybí, kvalita je <code>chybi</code>.</p>
  <p>Simulované uzavírky mají štítek <code>demo data</code>. Texty z modelu mají štítek <code>návrh AI</code>, náhradní text bez modelu má štítek <code>šablona</code>. Veřejný žebříček města může pořadí posunout nejvýš o 5 míst a každý posun má štítek <code>návrh AI</code>. Parametr <code>ai=0</code> nechá čistý vzorec. Soukromé váhy úředníka model neposouvá.</p>

  <h2>Veřejné, bez přihlášení</h2>
  <table>
    <tr><th>Metoda</th><th>Cesta</th><th>Co vrací</th></tr>
    <tr><td>GET</td><td><code>/api/health</code></td><td>Žije server, počet úseků a uzlů grafu.</td></tr>
    <tr><td>GET</td><td><code>/api/useky</code></td><td>GeoJSON úseků se skóre, třídou, stavem a intenzitou. Volitelně <code>limit</code> a <code>offset</code>.</td></tr>
    <tr><td>GET</td><td><code>/api/useky/{id}</code></td><td>Detail, rozpad skóre, geometrie.</td></tr>
    <tr><td>GET</td><td><code>/api/ranking</code></td><td>Objekt <code>{items, count, weights_source, vypocteno, ai, ai_note}</code>, ne holé pole. U vah města je výchozí pohled s návrhem AI (<code>ai=navrh</code>): prvních 40 úseků, posun nejvýš o 5 míst, štítek u posunu. <code>?ai=0</code> je jen vzorec. Když model neběží, <code>ai=nedostupne</code> a pořadí je vzorec. <code>?compact=1</code> vrací id, skóre, třídu, pořadí, připíchnutí, hlasy a pole návrhu AI. Váhy v query platí jen pro ten požadavek a model se na ně nepoužije.</td></tr>
    <tr><td>GET</td><td><code>/api/stability?top=100</code></td><td>Jak jistý je vrchol žebříčku, když se váhy trochu pohnou. Štítek jisté, pravděpodobné nebo nejisté.</td></tr>
    <tr><td>GET</td><td><code>/api/route?home=lon,lat&amp;work=lon,lat</code></td><td>Trasa mezi dvěma body bez přihlášení. Nic se neukládá.</td></tr>
    <tr><td>GET</td><td><code>/api/uzavirky</code></td><td>Potvrzené uzavírky. Koncepty veřejnost nevidí.</td></tr>
    <tr><td>GET</td><td><code>/api/statistiky</code></td><td>Souhrn sítě a počet potvrzených uzavírek.</td></tr>
    <tr><td>GET</td><td><code>/api/export.geojson</code></td><td>Stejná data jako úseky, soubor ke stažení, metadata uvnitř.</td></tr>
    <tr><td>GET</td><td><code>/api/export.csv</code></td><td>CSV s komentářem k licenci, datu výpočtu a významu sloupců. Vedle <code>stav</code> je <code>stav_nazev</code> pro lidi.</td></tr>
    <tr><td>GET</td><td><code>/api/export/metadata.jsonld</code></td><td>Metadata sady ve tvaru DCAT-AP-CZ. Není to oficiální katalog kraje.</td></tr>
    <tr><td>GET</td><td><code>/api/push/vapid-public-key</code></td><td>Veřejný klíč pro Web Push. Soukromý klíč v datech není.</td></tr>
    <tr><td>GET</td><td><code>/api/obce</code></td><td>448 obcí z Data KHK: kód, název, obyvatelé a střed.</td></tr>
    <tr><td>GET</td><td><code>/api/demo-closures</code></td><td>Skutečné plány kraje na rok 2022. Štítek je <code>skutečný plán 2022 (Data KHK)</code>. Simulace, kterou zadá úředník, má dál štítek demo data.</td></tr>
  </table>

  <h2>Občan</h2>
  <p>Registrace <code>POST /api/auth/register</code> s tělem <code>{email, password}</code> založí vždy roli občan. Přihlášení <code>POST /api/auth/login</code> se stejným tělem vrátí <code>{token, user: {id, email, role, blocked}}</code> a uloží token do cookie <code>cesty_session</code>. Token jde poslat i jako <code>Authorization: Bearer</code>. <code>GET /api/auth/me</code> vrátí stejný objekt uživatele, bez přihlášení 401. Po pěti špatných pokusech z jedné IP za minutu vrátí login 429. <code>POST /api/auth/logout</code> token zneplatní.</p>
  <table>
    <tr><th>Metoda</th><th>Cesta</th><th>Co dělá</th></tr>
    <tr><td>PUT</td><td><code>/api/me/places</code></td><td>Domov a práce jako bod <code>{lon, lat}</code>. Adresa se neukládá.</td></tr>
    <tr><td>GET</td><td><code>/api/me/route</code></td><td>Obvyklá trasa a trasa s objížďkou aktivních uzavírek.</td></tr>
    <tr><td>GET</td><td><code>/api/me/notifications</code></td><td>Upozornění v aplikaci a náhled e-mailu.</td></tr>
    <tr><td>POST</td><td><code>/api/me/push-subscription</code></td><td>Uloží push odběr prohlížeče.</td></tr>
    <tr><td>POST</td><td><code>/api/reports</code></td><td>Hlášení závady. Foto se neukládá, jen příznak že bylo.</td></tr>
    <tr><td>POST</td><td><code>/api/votes</code></td><td>Jeden hlas na úsek. Druhý hlas vrátí 409.</td></tr>
  </table>

  <h2>Úředník</h2>
  <table>
    <tr><th>Metoda</th><th>Cesta</th><th>Co dělá</th></tr>
    <tr><td>PUT</td><td><code>/api/me/weights</code></td><td>Váhy jen pro vlastní pohled.</td></tr>
    <tr><td>POST</td><td><code>/api/pins</code></td><td>Připíchnutí priority a důvodu. Má přednost před modelem.</td></tr>
    <tr><td>POST</td><td><code>/api/closures/preview</code></td><td>Náhled objížďky a varování. Tělo <code>{road_id, date_from, date_to, restriction}</code>. Do databáze se nezapíše.</td></tr>
    <tr><td>POST</td><td><code>/api/closures</code></td><td>Návrh uzavírky. Odpověď obsahuje objížďku, varování, auta za den, studenty a odříznuté obce. Dojezd záchranky a hasičů je <code>rescue</code> ve tvaru RescueCard (<code>items</code> s <code>sluzba</code>, <code>pred_min</code>, <code>po_min</code>, <code>nad_20_min</code>), ne anglický RescueImpact z jádra.</td></tr>
    <tr><td>GET</td><td><code>/api/flood?level=q5|q20|q100</code></td><td>Povodňový scénář Q5, Q20 nebo Q100.</td></tr>
    <tr><td>GET</td><td><code>/api/budget?amount=…&amp;amount2=…</code></td><td>Rozpočet. Dokud chybí výpočet jádra, vrátí ready false a žádnou cenu.</td></tr>
    <tr><td>POST</td><td><code>/api/closures/{id}/confirm</code></td><td>Potvrdí uzavírku a pošle nejvýš jedno upozornění občanům, kteří mají úsek na trase.</td></tr>
    <tr><td>PATCH</td><td><code>/api/closures/{id}</code></td><td>Stav práce: navrzeno, schvaleno, naplanovano, probiha, hotovo. Jen dopředu.</td></tr>
    <tr><td>POST</td><td><code>/api/ai/explain</code></td><td>Zdůvodnění skóre. Když model neběží, vrátí šablonu.</td></tr>
    <tr><td>POST</td><td><code>/api/ai/announcement</code></td><td>Návrh oznámení k existující uzavírce.</td></tr>
    <tr><td>POST</td><td><code>/api/ai/weights</code></td><td>Návrh vah z textu. Neuloží se, dokud je úředník nepotvrdí.</td></tr>
    <tr><td>POST</td><td><code>/api/ai/budget</code></td><td>3–5 vět k rozpočtu, jen z čísel výpočtu. Štítek návrh AI nebo šablona. Neukládá se.</td></tr>
  </table>

  <h2>Admin</h2>
  <table>
    <tr><th>Metoda</th><th>Cesta</th><th>Co dělá</th></tr>
    <tr><td>GET, PATCH</td><td><code>/api/admin/users</code></td><td>Seznam, role, zablokování.</td></tr>
    <tr><td>GET, PUT</td><td><code>/api/admin/weights</code></td><td>Trvalé váhy a strop hlasů.</td></tr>
    <tr><td>GET</td><td><code>/api/admin/audit</code></td><td>Kdo, kdy a co změnil.</td></tr>
    <tr><td>GET, PUT</td><td><code>/api/admin/ai</code></td><td>Zapnutí návrhu AI. Klíč zůstává v <code>.env</code>.</td></tr>
  </table>

  <h2>Příklad</h2>
  <pre>curl -s http://localhost:8000/api/export.csv | head</pre>
  <p>Testovací účty jsou v seed souboru backendu. Hesla do veřejné dokumentace nepatří.</p>
</body>
</html>
"""


@router.get("/docs", response_class=HTMLResponse)
def api_docs() -> str:
    return PAGE
