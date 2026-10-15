#!/usr/bin/env bash
# Sestaví zdrojový balík pro odevzdání: jen sledované soubory z HEAD, bez .env a závislostí.
# Použití: bash scripts/package_submission.sh
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="odevzdani"
mkdir -p "$OUT"
git archive --format=zip --prefix=cesty-khk/ -o "$OUT/cesty-khk-src.zip" HEAD

# Kontrola: v balíku nesmí být tajemství ani závislosti.
if unzip -l "$OUT/cesty-khk-src.zip" | grep -E "cesty-khk/\.env$|node_modules/|\.venv/" >/dev/null; then
  echo "CHYBA: balík obsahuje .env nebo závislosti" >&2
  exit 1
fi
echo "Hotovo: $OUT/cesty-khk-src.zip ($(du -h "$OUT/cesty-khk-src.zip" | cut -f1))"
echo "Přidejte ručně do $OUT/: PDF/PPTX (pitch) a záložní video."
