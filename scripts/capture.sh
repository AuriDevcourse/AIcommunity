#!/bin/bash
# Screenshot helper for the running dev server.
#   ./scripts/capture.sh <outdir> [label]
# Captures every tab in both colour schemes plus a mobile width.
# Requires `npm run dev` to be up on 127.0.0.1:5280.
set -uo pipefail

OUT=${1:?usage: capture.sh <outdir> [label]}
BASE=${BASE_URL:-http://127.0.0.1:5280}
CHROME=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}

mkdir -p "$OUT"

shoot() { # name url width height scheme
  local name=$1 url=$2 w=$3 h=$4 scheme=$5
  "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --force-color-profile=srgb --virtual-time-budget=9000 \
    --window-size="${w},${h}" \
    ${scheme:+--force-prefers-color-scheme=$scheme} \
    --screenshot="$OUT/${name}.png" "$url" >/dev/null 2>&1
  if [ -s "$OUT/${name}.png" ]; then
    printf '  %-34s %6s KB\n' "${name}.png" "$(( $(stat -f%z "$OUT/${name}.png") / 1024 ))"
  else
    printf '  %-34s FAILED\n' "${name}.png"
  fi
}

for tab in cockpit news members sessions; do
  shoot "${tab}-dark"  "$BASE/#${tab}" 1440 1600 dark
  shoot "${tab}-light" "$BASE/#${tab}" 1440 1600 light
done
shoot "cockpit-mobile" "$BASE/#cockpit" 390 1400 light
shoot "news-mobile"    "$BASE/#news"    390 1400 light

echo "captured to $OUT"
