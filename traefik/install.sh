#!/bin/bash
# Stage the Traefik + CrowdSec edge proxy on this host.
#
# Idempotent, and it does NOT touch nginx. It brings the new stack up on
# 8070/8453 alongside the live nginx so every route can be proved before
# anything moves. The port flip is a separate, deliberate step: cutover.sh.
#
#   Usage: bash install.sh
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ENV_FILE=.env
STAGE_WEB_PORT=8070
STAGE_TLS_PORT=8453

log() { echo "[install] $*"; }

# ---------------------------------------------------------------------------
# Bouncer key
# ---------------------------------------------------------------------------
# One shared secret between CrowdSec (which mints it via BOUNCER_KEY_traefik)
# and the Traefik plugin (which presents it). Generated once and kept; a new
# key on every run would orphan the registered bouncer.
if [ -f "$ENV_FILE" ] && grep -q '^CROWDSEC_BOUNCER_KEY=' "$ENV_FILE"; then
    log "reusing existing bouncer key from $ENV_FILE"
else
    KEY=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40)
    printf 'CROWDSEC_BOUNCER_KEY=%s\n' "$KEY" > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    log "generated a new bouncer key"
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

# ---------------------------------------------------------------------------
# Render the middleware template
# ---------------------------------------------------------------------------
# Traefik's file provider does not expand environment variables, so the key has
# to be substituted in. The tracked file is the .template; the rendered .yml
# holds a live secret and is gitignored -- which also means `git reset --hard`
# in the deploy workflow leaves it alone, while Traefik's provider only ever
# picks up the .yml.
log "rendering dynamic/middlewares.yml.template -> dynamic/middlewares.yml"
sed "s|__CROWDSEC_BOUNCER_KEY__|${CROWDSEC_BOUNCER_KEY}|" \
    dynamic/middlewares.yml.template > dynamic/middlewares.yml
chmod 600 dynamic/middlewares.yml

if grep -q '__CROWDSEC_BOUNCER_KEY__' dynamic/middlewares.yml; then
    log "ERROR: key substitution failed, refusing to start with a placeholder key"
    exit 1
fi

# ---------------------------------------------------------------------------
# Dashboard credentials
# ---------------------------------------------------------------------------
if [ ! -f dynamic/dashboard-users ]; then
    if ! command -v htpasswd >/dev/null 2>&1; then
        log "installing apache2-utils for htpasswd"
        apt-get update -qq && apt-get install -y -qq apache2-utils
    fi
    DASH_PASS=$(head -c 18 /dev/urandom | base64 | tr -d '/+=')
    htpasswd -nbB admin "$DASH_PASS" > dynamic/dashboard-users
    chmod 600 dynamic/dashboard-users
    printf 'DASHBOARD_USER=admin\nDASHBOARD_PASS=%s\n' "$DASH_PASS" >> "$ENV_FILE"
    log "dashboard credentials written to $ENV_FILE (user: admin)"
else
    log "dashboard credentials already present"
fi

# ---------------------------------------------------------------------------
# Disk
# ---------------------------------------------------------------------------
# The host sits at 82% with ~4GB free and the two new images want ~350MB. There
# is 3GB of reclaimable image layers, so take that first rather than risking a
# pull that fills the disk.
log "disk before prune: $(df -h / | awk 'NR==2{print $4" free ("$5" used)"}')"
docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true
docker builder prune -af >/dev/null 2>&1 || true
log "disk after prune:  $(df -h / | awk 'NR==2{print $4" free ("$5" used)"}')"

# ---------------------------------------------------------------------------
# Up, on staging ports
# ---------------------------------------------------------------------------
# Traefik ignores CLI port overrides when a static config file is mounted (the
# sources are mutually exclusive, not merged), so staging gets its own copy of
# the static file with the two entrypoint addresses rewritten. Generated, not
# hand-maintained, so it cannot drift from traefik.yml.
log "generating traefik.staging.yml (:$STAGE_WEB_PORT / :$STAGE_TLS_PORT)"
sed -e "s|^\( *\)address: \":80\"|\1address: \":$STAGE_WEB_PORT\"|" \
    -e "s|^\( *\)address: \":443\"|\1address: \":$STAGE_TLS_PORT\"|" \
    traefik.yml > traefik.staging.yml

if ! grep -q "address: \":$STAGE_TLS_PORT\"" traefik.staging.yml; then
    log "ERROR: staging port rewrite failed -- refusing to start and fight nginx for :443"
    exit 1
fi

log "starting traefik + crowdsec on :$STAGE_WEB_PORT / :$STAGE_TLS_PORT (nginx untouched)"
TRAEFIK_STATIC=./traefik.staging.yml \
    docker compose -f docker-compose.traefik.yml up -d --force-recreate traefik
TRAEFIK_STATIC=./traefik.staging.yml \
    docker compose -f docker-compose.traefik.yml up -d crowdsec

log "waiting for crowdsec to register the bouncer and install collections..."
for i in $(seq 1 30); do
    if docker exec crowdsec cscli bouncers list 2>/dev/null | grep -q traefik; then
        log "bouncer registered (attempt $i)"
        break
    fi
    sleep 3
done

echo
log "=== state ==="
docker exec crowdsec cscli bouncers list 2>&1 || log "WARN: could not list bouncers"
docker exec crowdsec cscli collections list 2>&1 | head -12 || true
echo
log "=== appsec listener ==="
docker exec crowdsec cscli metrics 2>&1 | grep -iA3 appsec || log "(no appsec metrics yet -- normal before first request)"
echo
log "staged. Validate with validate.sh, then run cutover.sh to take :80/:443."
