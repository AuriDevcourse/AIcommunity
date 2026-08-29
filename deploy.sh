#!/bin/bash
# Restricted-shell deploy script invoked by GitHub Actions over SSH.
#
# Server setup (run as root once):
#   adduser --disabled-password --gecos "" deploy
#   chown -R deploy:deploy /opt/aiworkshop
#   # /home/deploy/.ssh/authorized_keys — pin the command so the key can do
#   # nothing but deploy:
#   #   command="/opt/aiworkshop/deploy.sh",no-port-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA...
#   # /etc/sudoers.d/aiworkshop — the one privileged action this needs:
#   #   deploy ALL=(root) NOPASSWD: /bin/systemctl restart aiworkshop
#   mkdir -p /var/lib/aiworkshop && chown deploy:deploy /var/lib/aiworkshop
#   # /etc/aiworkshop.env — read by BOTH the unit and this script:
#   #   PORT=3003
#   #   HOST=127.0.0.1
#   #   DATA_DIR=/var/lib/aiworkshop
#   # systemd unit: EnvironmentFile=/etc/aiworkshop.env
#
# Running the whole deploy as root was unnecessary: only the service restart
# needs privilege, and the forced command plus a narrow sudoers rule keeps a
# leaked deploy key from being a root shell.
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/aiworkshop}
BRANCH=${DEPLOY_BRANCH:-main}
SERVICE=${DEPLOY_SERVICE:-aiworkshop}
# Live poll/feedback state MUST live outside the checkout: `git reset --hard`
# below wipes anything tracked, and would otherwise discard every vote cast
# since the last deploy. Set the same DATA_DIR in the systemd unit.
DATA_DIR=${DATA_DIR:-/var/lib/aiworkshop}

# One source of truth for the runtime config. Both the systemd unit
# (EnvironmentFile=/etc/aiworkshop.env) and this script read it, so the health
# check below can never probe a different port than the service listens on.
# SSH forced commands do not forward client env vars, so PORT can only come
# from here — the previous ${PORT:-3003} was always the hardcoded default.
ENV_FILE=${ENV_FILE:-/etc/aiworkshop.env}
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
fi
HEALTH_PORT=${PORT:-3003}

mkdir -p "$DATA_DIR"

cd "$APP_DIR"

OLD_LOCK_HASH=$(sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1 || echo "")

git fetch --all
git reset --hard "origin/${BRANCH}"

NEW_LOCK_HASH=$(sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1 || echo "")

if [ "$OLD_LOCK_HASH" != "$NEW_LOCK_HASH" ]; then
  echo "lockfile changed — running npm ci"
  npm ci
else
  echo "lockfile unchanged — skipping npm ci"
fi

npm run build

# Fail the deploy rather than restarting into a broken build.
if [ ! -f dist/index.html ]; then
  echo "build produced no dist/index.html — aborting, service left running on the previous build" >&2
  exit 1
fi

sudo -n /bin/systemctl restart "$SERVICE"

# Give the service a moment, then confirm it actually came up.
for i in $(seq 1 10); do
  sleep 1
  if curl -fsS "http://127.0.0.1:${HEALTH_PORT}/healthz" > /dev/null 2>&1; then
    echo "deploy ok at $(date -Iseconds)"
    exit 0
  fi
done

echo "service did not answer /healthz on port ${HEALTH_PORT} after restart" >&2
echo "(port comes from ${ENV_FILE}; make sure the systemd unit uses the same EnvironmentFile)" >&2
exit 1
