#!/usr/bin/env bash
# Smoke test of the whole API (T23). Run it before a demo and after every merge.
#
#   scripts/smoke_api.sh                         # through Vite proxy http://localhost:5173
#   scripts/smoke_api.sh http://localhost:8000   # backend directly
#   scripts/smoke_api.sh https://xyz.trycloudflare.com
#
# Official endpoints need a login. The password is never in this file:
#   SMOKE_EMAIL / SMOKE_PASSWORD, otherwise CESTY_SEED_OFFICIAL_PASSWORD from .env
#   (seed account urednik@cesty-khk.test). Without a password only public endpoints run.
#
# Prints status, time and size of every call. Exit code 1 when any call fails.

set -uo pipefail
export LC_NUMERIC=C  # curl prints 0.12; a Czech locale would want 0,12 in printf

BASE="${1:-http://localhost:5173}"
BASE="${BASE%/}"
API="$BASE/api"
SLOW_S="${SLOW_S:-2}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
JAR="$TMP/cookies.txt"
OUT="$TMP/body"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi
EMAIL="${SMOKE_EMAIL:-${CESTY_SEED_OFFICIAL_EMAIL:-urednik@cesty-khk.test}}"
PASSWORD="${SMOKE_PASSWORD:-${CESTY_SEED_OFFICIAL_PASSWORD:-}}"

FAILED=0
SLOW=0

# check <name> <expected status> <text the body must contain> <curl args...>
check() {
  local name="$1" want="$2" needle="$3"
  shift 3
  local meta code time size
  : >"$OUT"
  meta="$(curl -s -o "$OUT" -b "$JAR" -c "$JAR" -H "Accept-Encoding: gzip" --compressed \
    -w '%{http_code} %{time_total} %{size_download}' --max-time 60 "$@")" || meta="000 0 0"
  read -r code time size <<<"$meta"
  local mark="OK  "
  if [ "$code" != "$want" ] || { [ -n "$needle" ] && ! grep -q -- "$needle" "$OUT"; }; then
    mark="FAIL"
    FAILED=$((FAILED + 1))
  elif awk -v t="$time" -v s="$SLOW_S" 'BEGIN { exit !(t > s) }'; then
    mark="SLOW"
    SLOW=$((SLOW + 1))
  fi
  printf '%s %s %6.2fs %9s B  %s\n' "$mark" "$code" "$time" "$size" "$name"
  if [ "$mark" = "FAIL" ]; then
    printf '      čekáno %s a "%s", přišlo: %s\n' "$want" "$needle" "$(head -c 200 "$OUT" | tr '\n' ' ')"
  fi
}

echo "Kontrola API: $API"
if ! curl -s --max-time 10 -o /dev/null "$API/health"; then
  echo "Server na $BASE neodpovídá. Spusť backend (a npm run dev), nebo zadej jinou adresu."
  exit 1
fi
echo

echo "Veřejné"
check "health" 200 '"ok":true' "$API/health"
check "ranking (admin weights)" 200 '"items"' "$API/ranking?limit=5"
check "ranking mode=params" 200 '"ai_available"' "$API/ranking?mode=params&limit=1"
check "weights schema" 200 '"students"' "$API/weights/schema"
check "weights presets" 200 '"skoly"' "$API/weights/presets"
check "search" 200 '"type"' "$API/search?q=Hronov"
check "roads other" 200 '"src":"osm"' "$API/roads/other?limit=1"
check "poi" 200 '"nearest_roads"' "$API/pois/hospital-0"
check "ranking (weights in query)" 200 '"weights_source":"query"' "$API/ranking?limit=5&stav=30"
check "ranking T20 (warm cache)" 200 '"items"' "$API/ranking?limit=5&intensity=50&detour=50&students=50"
check "ranking full (size check)" 200 '"items"' "$API/ranking"
ROAD_ID="$(curl -s "$API/ranking?limit=1" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)"
ROAD_ID="${ROAD_ID:-581}"
check "useky (GeoJSON)" 200 '"FeatureCollection"' "$API/useky?limit=5"
check "useky/$ROAD_ID (breakdown)" 200 '"breakdown"' "$API/useky/$ROAD_ID"
check "useky/0 (unknown road)" 404 '"detail"' "$API/useky/0"
check "obce" 200 '"ready":true' "$API/obce"
check "demo-closures (plans 2022)" 200 '"recommended":true' "$API/demo-closures"
check "closures (+ SRTI)" 200 '"srti"' "$API/closures"
check "route" 200 '"found"' "$API/route?home=15.83,50.21&work=15.58,50.43"
check "statistiky" 200 '' "$API/statistiky"
check "export.csv" 200 'licence' "$API/export.csv"
check "export metadata (DCAT-AP-CZ)" 200 '"@context"' "$API/export/metadata.jsonld"
check "push VAPID key" 200 '"configured"' "$API/push/vapid-public-key"
check "docs" 200 '<html' "$API/docs"
check "preview without login" 401 '"detail"' -X POST -H "Content-Type: application/json" \
  --data "{\"road_id\":$ROAD_ID,\"date_from\":\"2026-11-02\",\"date_to\":\"2026-11-06\",\"restriction\":\"uplna uzavirka\"}" \
  "$API/closures/preview"

echo
if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "Úředník: přeskočeno (nastav SMOKE_EMAIL a SMOKE_PASSWORD, nebo CESTY_SEED_OFFICIAL_PASSWORD v .env)"
else
  echo "Úředník ($EMAIL)"
  printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASSWORD" >"$TMP/login.json"
  check "login" 200 '"user"' -X POST -H "Content-Type: application/json" --data-binary "@$TMP/login.json" "$API/auth/login"
  rm -f "$TMP/login.json"
  check "auth/me" 200 '"role"' "$API/auth/me"
  check "closure preview (detour, rescue)" 200 '"rescue"' -X POST -H "Content-Type: application/json" \
    --data "{\"road_id\":$ROAD_ID,\"date_from\":\"2026-11-02\",\"date_to\":\"2026-11-06\",\"restriction\":\"uplna uzavirka\"}" \
    "$API/closures/preview"
  check "budget 100 vs 250 mil. Kc" 200 '"plans"' "$API/budget?amount=100000000&amount2=250000000"
  check "flood Q100" 200 '' "$API/flood?level=q100"
  check "closures with drafts" 200 '"items"' "$API/closures?include_drafts=true"
fi

echo
GZIP="$(curl -s -o /dev/null -D - -H "Accept-Encoding: gzip" "$API/ranking?limit=50" | grep -ci '^content-encoding: *gzip')"
[ "$GZIP" -gt 0 ] && echo "gzip: zapnutý" || echo "gzip: vypnutý (S22, /api/ranking má bez něj asi 1,7 MB)"
echo "Výsledek: $FAILED chyb, $SLOW pomalejších než ${SLOW_S} s"
[ "$FAILED" -eq 0 ]
