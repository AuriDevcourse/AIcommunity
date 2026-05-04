#!/bin/bash
# Restricted-shell deploy script invoked by GitHub Actions over SSH.
# Authorized_keys entry pins it via command="/opt/aiworkshop/deploy.sh".
set -euo pipefail

cd /opt/aiworkshop

OLD_LOCK_HASH=$(sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1 || echo "")

git fetch --all
git reset --hard origin/main

NEW_LOCK_HASH=$(sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1 || echo "")

if [ "$OLD_LOCK_HASH" != "$NEW_LOCK_HASH" ]; then
  echo "lockfile changed — running npm ci"
  npm ci
else
  echo "lockfile unchanged — skipping npm ci"
fi

npm run build

systemctl restart aiworkshop
echo "deploy ok at $(date -Iseconds)"
