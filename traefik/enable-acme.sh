#!/bin/bash
# Hand certificate management to Traefik and retire certbot.
#
# RUN THIS ONLY AFTER cutover.sh HAS SUCCEEDED. Traefik validates via TLS-ALPN
# on :443, so it has to actually own :443 or every issuance fails.
#
# Safe to run: the certbot certificates in dynamic/tls.yml keep being served
# until ACME produces a replacement, so a failed issuance degrades to "still
# using the old cert" rather than to a TLS outage. That is also why this does
# not need a maintenance window.
#
#   Usage: bash enable-acme.sh
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
log() { echo "[acme] $*"; }

# Names Traefik should end up holding certificates for. api.melissourgoi.dev is
# absent on purpose: it has no DNS record, so ACME cannot validate it and
# including it would just log failures forever.
DOMAINS=(api.asteriashome.gr api.kyklosedu.gr api.adinfinity.gr mail.adinfinity.gr)

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
if ! ss -tlnp 2>/dev/null | grep -q ':443 .*traefik'; then
    log "ERROR: Traefik is not listening on :443."
    log "       TLS-ALPN validation would fail for every domain. Run cutover.sh first."
    exit 1
fi

if grep -qE '^\s*certResolver:\s*le' traefik.yml; then
    log "certResolver already enabled in traefik.yml"
else
    log "enabling certResolver on the websecure entrypoint"
    cp traefik.yml "traefik.yml.bak.$(date +%Y%m%d%H%M%S)"
    # Replace the bare `tls: {}` under websecure with a resolver-bearing block.
    # Anchored on the comment line directly above it so this cannot match the
    # `tls` key of some unrelated future entrypoint.
    sed -i 's|^\( *\)tls: {}$|\1tls:\n\1  certResolver: le|' traefik.yml

    if ! grep -qE '^\s*certResolver:\s*le' traefik.yml; then
        log "ERROR: edit did not apply -- traefik.yml left unchanged, see the .bak"
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# Apply
# ---------------------------------------------------------------------------
# acme.json lives in the traefik-acme volume and must be 0600 or Traefik
# refuses to use it.
log "recreating Traefik"
docker compose -f docker-compose.traefik.yml up -d --force-recreate traefik
docker exec traefik sh -c 'touch /letsencrypt/acme.json && chmod 600 /letsencrypt/acme.json' 2>/dev/null || true

log "waiting for issuance (TLS-ALPN, up to ~3 min)"
for i in $(seq 1 36); do
    COUNT=$(docker exec traefik sh -c \
        'grep -o "\"main\":" /letsencrypt/acme.json 2>/dev/null | wc -l' 2>/dev/null || echo 0)
    if [ "${COUNT:-0}" -ge "${#DOMAINS[@]}" ]; then
        log "acme.json holds $COUNT certificates (attempt $i)"
        break
    fi
    sleep 5
done

# ---------------------------------------------------------------------------
# Verify, per domain
# ---------------------------------------------------------------------------
# A Traefik-issued cert is distinguishable from certbot's by serial, so compare
# against what is on disk in /etc/letsencrypt rather than trusting acme.json.
echo
log "=== certificate check ==="
FAIL=0
for d in "${DOMAINS[@]}"; do
    SERVED=$(echo | openssl s_client -connect 127.0.0.1:443 -servername "$d" 2>/dev/null \
        | openssl x509 -noout -serial 2>/dev/null | cut -d= -f2)
    ONDISK=$(openssl x509 -noout -serial -in "/etc/letsencrypt/live/$d/fullchain.pem" 2>/dev/null \
        | cut -d= -f2)
    EXPIRY=$(echo | openssl s_client -connect 127.0.0.1:443 -servername "$d" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

    if [ -z "$SERVED" ]; then
        printf '  FAIL  %-24s no certificate served\n' "$d"; FAIL=$((FAIL + 1))
    elif [ "$SERVED" = "$ONDISK" ]; then
        printf '  WAIT  %-24s still certbot'"'"'s cert (expires %s)\n' "$d" "$EXPIRY"
    else
        printf '  OK    %-24s Traefik-issued (expires %s)\n' "$d" "$EXPIRY"
    fi
done

echo
log "=== acme errors, if any ==="
docker logs traefik 2>&1 | grep -iE 'acme|certificate' | grep -iE 'error|unable|fail' | tail -8 \
    || log "(none)"

echo
if [ "$FAIL" -gt 0 ]; then
    log "Something is not serving TLS. Roll back with:"
    log "  cp traefik.yml.bak.* traefik.yml && docker compose -f docker-compose.traefik.yml up -d --force-recreate traefik"
    exit 1
fi

log "Any domain still showing WAIT will switch over on Traefik's next renewal"
log "check; it is not an error while the certbot cert is still valid."
echo
log "Once every domain reads OK, certbot is redundant. Stop its timer with:"
log "  systemctl disable --now certbot.timer"
log "Leave /etc/letsencrypt in place -- dynamic/tls.yml still references it as"
log "the fallback and the default store."
