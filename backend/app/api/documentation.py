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
  <p>Licence aplikace i tohoto rozhraní je <strong>EUPL-1.2</strong>. Export je otevřená data kraje: skóre, třída priority a stav úseku. Pole intenzity (auta za den) je zatím prázdné a má štítek <code>chybi</code>. Až bude napojené sčítání ŘSD 2025, vyplní se a odvozenina z dat ŘSD ponese licenci CC BY-SA 4.0.</p>
  <p>Simulované uzavírky mají štítek <code>demo data</code>. Texty z modelu mají štítek <code>návrh AI</code>, náhradní text bez modelu má štítek <code>šablona</code>. Model pořadí nepočítá a nic neukládá, dokud to člověk nepotvrdí.</p>

  <h2>Veřejné, bez přihlášení</h2>
  <table>
    <tr><th>Metoda</th><th>Cesta</th><th>Co vrací</th></tr>
    <tr><td>GET</td><td><code>/api/health</code></td><td>Žije server, počet úseků a uzlů grafu.</td></tr>
    <tr><td>GET</td><td><code>/api/useky</code></td><td>GeoJSON úseků se skóre, třídou, stavem a intenzitou. Volitelně <code>limit</code> a <code>offset</code>.</td></tr>
    <tr><td>GET</td><td><code>/api/useky/{id}</code></td><td>Detail, rozpad skóre, geometrie.</td></tr>
    <tr><td>GET</td><td><code>/api/ranking</code></td><td>Žebříček. Stejné řazení jako mapa.</td></tr>
    <tr><td>GET</td><td><code>/api/uzavirky</code></td><td>Potvrzené uzavírky. Koncepty veřejnost nevidí.</td></tr>
    <tr><td>GET</td><td><code>/api/statistiky</code></td><td>Souhrn sítě a počet potvrzených uzavírek.</td></tr>
    <tr><td>GET</td><td><code>/api/export.geojson</code></td><td>Stejná data jako úseky, soubor ke stažení, metadata uvnitř.</td></tr>
    <tr><td>GET</td><td><code>/api/export.csv</code></td><td>CSV s komentářem k licenci, datu výpočtu a významu sloupců.</td></tr>
    <tr><td>GET</td><td><code>/api/push/vapid-public-key</code></td><td>Veřejný klíč pro Web Push. Soukromý klíč v datech není.</td></tr>
    <tr><td>GET</td><td><code>/api/obce</code></td><td>Obce. Než dorazí sada Obce, jen názvy z úseků, bez obyvatel a středu.</td></tr>
    <tr><td>GET</td><td><code>/api/demo-closures</code></td><td>Ukázkové uzavírky. Než dorazí plány 2022, tři úseky dnešní sítě se štítkem demo data.</td></tr>
  </table>

  <h2>Občan</h2>
  <p>Registrace <code>POST /api/auth/register</code> založí vždy roli občan. Přihlášení <code>POST /api/auth/login</code> vrátí token a uloží ho do cookie <code>cesty_session</code>. Token jde poslat i jako <code>Authorization: Bearer</code>. <code>POST /api/auth/logout</code> ho zneplatní.</p>
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
    <tr><td>POST</td><td><code>/api/closures</code></td><td>Návrh uzavírky. Odpověď obsahuje objížďku, varování a návrh oznámení. Počty studentů a odříznuté obce jsou null, dokud je engine nespočítá.</td></tr>
    <tr><td>GET</td><td><code>/api/flood?level=q5|q20|q100</code></td><td>Povodňový scénář. Dokud engine nemá záplavy, vrátí prázdný scénář a ready false.</td></tr>
    <tr><td>POST</td><td><code>/api/closures/{id}/confirm</code></td><td>Potvrdí uzavírku a pošle nejvýš jedno upozornění občanům, kteří mají úsek na trase.</td></tr>
    <tr><td>PATCH</td><td><code>/api/closures/{id}</code></td><td>Stav práce: navrzeno, schvaleno, naplanovano, probiha, hotovo. Jen dopředu.</td></tr>
    <tr><td>POST</td><td><code>/api/ai/explain</code></td><td>Zdůvodnění skóre. Když model neběží, vrátí šablonu.</td></tr>
    <tr><td>POST</td><td><code>/api/ai/announcement</code></td><td>Návrh oznámení k existující uzavírce.</td></tr>
    <tr><td>POST</td><td><code>/api/ai/weights</code></td><td>Návrh vah z textu. Neuloží se, dokud je úředník nepotvrdí.</td></tr>
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
