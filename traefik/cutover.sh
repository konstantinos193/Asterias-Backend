#!/bin/bash
# Move :80/:443 from nginx to Traefik. This is the only step with an outage
# window (a few seconds) and the only one that is visible to the internet.
#
# Run validate.sh first and get a clean pass. Then:
#   bash cutover.sh          # flip to Traefik
#   bash cutover.sh rollback # flip back to nginx
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-forward}"
log() { echo "[cutover] $*"; }

# Each vhost the box must keep serving. Checked after the flip; any failure
# triggers an automatic rollback rather than leaving a client down.
#
# api.melissourgoi.dev is deliberately absent: it has no DNS record, so it
# serves no real traffic and has no certificate. Gating the cutover on a dead
# name would roll back a good conversion.
HOSTS=(api.asteriashome.gr api.kyklosedu.gr api.adinfinity.gr mail.adinfinity.gr)

check_all() {
    local bad=0
    for h in "${HOSTS[@]}"; do
        local code
        code=$(curl -ks -o /dev/null -w '%{http_code}' --max-time 15 \
            --resolve "${h}:443:127.0.0.1" "https://${h}:443/" 2>/dev/null)
        # Anything that is not a connection failure or a gateway error means
        # the request reached the app behind the proxy.
        case "$code" in
            000|502|503|504) log "  DOWN $h ($code)"; bad=1 ;;
            *)               log "  ok   $h ($code)" ;;
        esac
    done
    return $bad
}

start_traefik_on_443() {
    # No TRAEFIK_STATIC in the environment, so the compose default mounts
    # traefik.yml, whose entrypoints are :80 and :443.
    docker compose -f docker-compose.traefik.yml up -d --force-recreate traefik
}

if [ "$MODE" = "rollback" ]; then
    log "rolling back to nginx"
    docker compose -f docker-compose.traefik.yml down
    systemctl start nginx
    sleep 3
    check_all || log "WARN: some hosts still unhealthy under nginx -- investigate"
    log "nginx is serving :80/:443 again"
    exit 0
fi

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
log "pre-flight: nginx is currently serving these hosts"
check_all || true

if ! docker ps --format '{{.Names}}' | grep -q '^crowdsec$'; then
    log "ERROR: crowdsec is not running -- run install.sh first"
    exit 1
fi

# The staged stack is bound to 8070/8453 via traefik.staging.yml. It has to let
# go of those and be recreated against traefik.yml (80/443), which cannot
# happen while nginx holds them. crowdsec is left running throughout.
log "stopping the staged Traefik (on 8070/8453)"
TRAEFIK_STATIC=./traefik.staging.yml \
    docker compose -f docker-compose.traefik.yml stop traefik

# ---------------------------------------------------------------------------
# The flip
# ---------------------------------------------------------------------------
# nginx is stopped rather than disabled, so a rollback is one systemctl away.
# It is also masked afterwards only on success, further down.
log "stopping nginx"
systemctl stop nginx

log "starting Traefik on :80/:443"
if ! start_traefik_on_443; then
    log "ERROR: Traefik failed to start -- restoring nginx"
    systemctl start nginx
    exit 1
fi

# Traefik needs a moment to bind and load the dynamic directory.
for i in $(seq 1 20); do
    if curl -sf --max-time 5 http://127.0.0.1:8099/ping >/dev/null 2>&1; then
        log "Traefik answering /ping (attempt $i)"
        break
    fi
    sleep 2
done

log "verifying every vhost through Traefik"
if ! check_all; then
    log "ERROR: a vhost is down under Traefik -- rolling back to nginx"
    docker compose -f docker-compose.traefik.yml down
    systemctl start nginx
    sleep 3
    check_all || true
    log "rolled back. Fix the config and try again."
    exit 1
fi

# ---------------------------------------------------------------------------
# Make it stick
# ---------------------------------------------------------------------------
# Without this, an apt upgrade or a reboot starts nginx, it loses the :80 bind
# race with Traefik, and the box half-serves.
log "disabling nginx at boot (not uninstalled -- rollback stays available)"
systemctl disable nginx >/dev/null 2>&1 || true

log "=== cutover complete: Traefik owns :80/:443 ==="
log ""
log "NEXT STEP -- certificates. certbot renewed through its nginx plugin, which"
log "cannot work now that nginx is stopped. Hand issuance to Traefik:"
log ""
log "    bash enable-acme.sh"
log ""
log "That is safe to run immediately and needs no window: the certbot certs keep"
log "being served until ACME has a replacement. They are valid to 2026-12-23, so"
log "this is not urgent, but it must happen before then."
