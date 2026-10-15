#!/usr/bin/env bash
# Cesty KHK: spustí celý server (API + databáze + web) na tomto Macu pro celý tým.
#
# Spuštění: dvojklik v Finderu, nebo v terminálu ./start-server.command
# Volby (proměnné prostředí):
#   NO_PULL=1      nestahovat main z GitHubu (použít, co je na disku)
#   NO_TUNNEL=1    nespouštět veřejnou HTTPS adresu (cloudflared)
#   API_PORT=8000  port backendu (jen lokálně), WEB_PORT=5173 port webu
#   RESET_DB=1     zálohovat backend/cesty.db a založit novou (demo účty s hesly z .env)
#
# Co se stane:
#   1. git pull větve main (jen když nejsou neuložené změny)
#   2. kontrola nástrojů (uv, node, npm), .env z .env.example: náhodný klíč,
#      náhodná hesla demo účtů a VAPID klíče pro push (vše jen v .env, nikdy v gitu)
#   3. uv sync + npm install
#   4. backend (FastAPI + SQLite backend/cesty.db) na 127.0.0.1:$API_PORT
#   5. web (Vite) na 0.0.0.0:$WEB_PORT, /api posílá na backend
#   6. adresy pro tým: síť (Wi-Fi) a veřejná HTTPS adresa přes cloudflared
# Ctrl+C vše ukončí. Databáze zůstane v backend/cesty.db.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-5173}"
LOG_DIR="$ROOT/.server-logs"
mkdir -p "$LOG_DIR"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mCHYBA: %s\033[0m\n' "$*" >&2; exit 1; }

# ---- 1. latest main --------------------------------------------------------
if [ "${NO_PULL:-0}" != "1" ]; then
  say "Stahuji main z GitHubu"
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "Máš neuložené změny, pull přeskakuji (spouštím, co je na disku)."
  else
    git fetch origin main
    branch="$(git rev-parse --abbrev-ref HEAD)"
    if [ "$branch" != "main" ]; then
      echo "Jsi na větvi '$branch', přepínám na main."
      git checkout main
    fi
    git pull --ff-only origin main || fail "main nejde stáhnout fast-forwardem. Vyřeš ručně (git status)."
  fi
fi
echo "Verze: $(git log -1 --format='%h %s')"

# ---- 2. tools and .env -----------------------------------------------------
say "Kontroluji nástroje"
command -v uv >/dev/null || fail "Chybí uv. Nainstaluj: brew install uv"
command -v node >/dev/null || fail "Chybí Node 20+. Nainstaluj: brew install node"
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge 20 ] || fail "Node $node_major je starý, potřeba 20+ (brew upgrade node)."
echo "uv $(uv --version | awk '{print $2}'), node $(node --version)"

if [ ! -f .env ]; then
  say "Vytvářím .env z .env.example"
  cp .env.example .env
fi
random_hex() { openssl rand -hex "$1" 2>/dev/null || uv run --no-project python -c "import secrets; print(secrets.token_hex($1))"; }
env_get() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- || true; }
# Replace or append KEY=VALUE in .env. sed -i differs on macOS and Linux; use a temp file.
env_set() {
  grep -vE "^$1=" .env >.env.tmp || true
  printf '%s=%s\n' "$1" "$2" >>.env.tmp
  mv .env.tmp .env
}

# F11: a short or default key lets anyone forge a login token through the tunnel.
key="$(env_get CESTY_SECRET_KEY)"
if [ "${#key}" -lt 32 ] || [ "$key" = "change-me-dev-only" ]; then
  env_set CESTY_SECRET_KEY "$(random_hex 32)"
  echo "Vygenerován nový CESTY_SECRET_KEY (64 znaků, jen v .env). Staré přihlášení přestane platit."
fi

# S21: demo account passwords come from .env. Generate them once so they stay stable.
NEW_PASSWORDS=0
for role in ADMIN OFFICIAL CITIZEN; do
  if [ -z "$(env_get "CESTY_SEED_${role}_PASSWORD")" ]; then
    env_set "CESTY_SEED_${role}_PASSWORD" "$(random_hex 8)"
    NEW_PASSWORDS=1
  fi
done
[ "$NEW_PASSWORDS" = 1 ] && echo "Vygenerována hesla demo účtů (CESTY_SEED_*_PASSWORD v .env)."

DB_FILE="$ROOT/backend/cesty.db"
if [ "${RESET_DB:-0}" = "1" ] && [ -f "$DB_FILE" ]; then
  backup="$DB_FILE.$(date +%Y%m%d-%H%M%S).bak"
  mv "$DB_FILE" "$backup"
  echo "Databáze zazálohována do $backup, založí se nová."
elif [ "$NEW_PASSWORDS" = 1 ] && [ -f "$DB_FILE" ]; then
  # Seeding runs only on an empty DB, so the old public passwords from seed.py still work.
  printf '\033[33mPOZOR: backend/cesty.db už existuje a demo účty v ní mají stará veřejná hesla.\n'
  printf 'Před tunelem pro porotu spusť: RESET_DB=1 ./start-server.command\033[0m\n'
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a
# The relative DB path from .env.example depends on the working directory.
# Without it the backend uses its default: backend/cesty.db (absolute, see app/config.py).
if [ "${CESTY_DB_URL:-}" = "sqlite:///./backend/cesty.db" ]; then unset CESTY_DB_URL; fi
# The tunnel starts after the API, so the cookie flag has to be set before uvicorn.
if [ "${NO_TUNNEL:-0}" != "1" ]; then
  export CESTY_COOKIE_SECURE=1
fi

# ---- 3. dependencies -------------------------------------------------------
say "Instaluji závislosti (poprvé to chvíli trvá)"
(cd backend && uv sync --quiet)

# F12: Web Push needs a VAPID key pair. Generate it once into .env; never print it.
if [ -z "${VAPID_PUBLIC_KEY:-}" ] || [ -z "${VAPID_PRIVATE_KEY:-}" ]; then
  vapid="$(cd backend && uv run python -m app.notify.vapid)" || fail "VAPID klíče nejdou vygenerovat."
  env_set VAPID_PUBLIC_KEY "$(printf '%s\n' "$vapid" | sed -n 's/^VAPID_PUBLIC_KEY=//p' | tr -d '\r')"
  env_set VAPID_PRIVATE_KEY "$(printf '%s\n' "$vapid" | sed -n 's/^VAPID_PRIVATE_KEY=//p' | tr -d '\r')"
  unset vapid
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
  if [ "${CESTY_DB_URL:-}" = "sqlite:///./backend/cesty.db" ]; then unset CESTY_DB_URL; fi
  echo "Vygenerovány VAPID klíče pro push (jen v .env)."
fi
npm install --no-audit --no-fund --loglevel=error

# ---- 4-6. run --------------------------------------------------------------
PIDS=()
cleanup() {
  printf '\nUkončuji server...\n'
  for pid in ${PIDS[@]+"${PIDS[@]}"}; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
port_busy "$API_PORT" && fail "Port $API_PORT už něco používá. Zavři jiný backend, nebo API_PORT=8001 ./start-server.command"
port_busy "$WEB_PORT" && fail "Port $WEB_PORT už něco používá. Zavři jiné npm run dev, nebo WEB_PORT=5174 ./start-server.command"

say "Spouštím backend (API + databáze) na portu $API_PORT"
(cd backend && exec uv run python -m uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT") >"$LOG_DIR/api.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 180); do
  curl -fs "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1 && break
  kill -0 "${PIDS[0]}" 2>/dev/null || { tail -20 "$LOG_DIR/api.log"; fail "Backend spadl při startu (log výše)."; }
  sleep 1
done
curl -fs "http://127.0.0.1:$API_PORT/api/health" || fail "Backend neodpovídá (log: $LOG_DIR/api.log)"
echo

say "Spouštím web na portu $WEB_PORT"
CESTY_API_TARGET="http://127.0.0.1:$API_PORT" npx vite --host 0.0.0.0 --port "$WEB_PORT" --strictPort >"$LOG_DIR/web.log" 2>&1 &
PIDS+=($!)
for _ in $(seq 1 60); do
  curl -fs "http://127.0.0.1:$WEB_PORT/api/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fs "http://127.0.0.1:$WEB_PORT/api/health" >/dev/null || fail "Web neodpovídá (log: $LOG_DIR/web.log)"

LAN_IP=""
if command -v ipconfig >/dev/null && [ "$(uname)" = "Darwin" ]; then
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
fi
[ -n "$LAN_IP" ] || LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"

PUBLIC_URL=""
if [ "${NO_TUNNEL:-0}" != "1" ]; then
  if command -v cloudflared >/dev/null; then
    say "Spouštím veřejnou HTTPS adresu (cloudflared)"
    cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$WEB_PORT" >"$LOG_DIR/tunnel.log" 2>&1 &
    PIDS+=($!)
    for _ in $(seq 1 30); do
      PUBLIC_URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG_DIR/tunnel.log" | head -1 || true)"
      [ -n "$PUBLIC_URL" ] && break
      sleep 1
    done
    [ -n "$PUBLIC_URL" ] || echo "Tunel se nerozběhl (log: $LOG_DIR/tunnel.log). Síťová adresa funguje dál."
  else
    echo "cloudflared není nainstalovaný, veřejná adresa nebude (brew install cloudflared)."
  fi
fi

cat <<EOF

================================================================
 Cesty KHK běží.  Databáze: backend/cesty.db (na tomto Macu)

 Tento Mac:        http://localhost:$WEB_PORT
EOF
[ -n "$LAN_IP" ] && echo " Stejná Wi-Fi:     http://$LAN_IP:$WEB_PORT"
[ -n "$PUBLIC_URL" ] && echo " Odkudkoli HTTPS:  $PUBLIC_URL   (telefony, push, porota)"
cat <<EOF

 Vývoj frontendu u kolegy proti tomuto serveru:
   CESTY_API_TARGET=${PUBLIC_URL:-http://${LAN_IP:-<IP-tohoto-Macu>}:$WEB_PORT} npm run dev
 Demo účty: admin@ / urednik@ / obcan1@cesty-khk.test,
   hesla v .env (CESTY_SEED_*_PASSWORD).  Logy: .server-logs/
 Kontrola API:  scripts/smoke_api.sh ${PUBLIC_URL:-http://localhost:$WEB_PORT}
 Ukončit: Ctrl+C
================================================================
EOF

# Stay in the foreground until one of the processes ends.
while :; do
  for pid in "${PIDS[@]}"; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Jedna část serveru skončila. Logy: $LOG_DIR"
      tail -15 "$LOG_DIR/api.log" "$LOG_DIR/web.log" 2>/dev/null || true
      exit 1
    fi
  done
  sleep 2
done
