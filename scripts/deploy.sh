#!/bin/bash
# Blue-green cutover for asterias-backend.
#
# This script does NOT build anything. The image is built and pushed to ghcr by
# .github/workflows/deploy.yml on a GitHub runner, where the layer cache lives
# between runs; the VPS only pulls it and swaps nginx over.
#
#   Usage: deploy.sh <image-ref>
#   e.g.   deploy.sh ghcr.io/konstantinos193/asterias-backend:42
set -euo pipefail

NEW_IMAGE="${1:-}"
if [ -z "$NEW_IMAGE" ]; then
    echo "Usage: $0 <image-ref>" >&2
    exit 1
fi
# Docker refuses uppercase in a repository name, and GitHub org/repo names are
# not normalised for us.
NEW_IMAGE=$(printf '%s' "$NEW_IMAGE" | tr '[:upper:]' '[:lower:]')
IMAGE_REPO="${NEW_IMAGE%:*}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_CONF=${UPSTREAM_CONF:-/etc/nginx/conf.d/asterias-upstream.conf}
TRAEFIK_SERVICE_CONF=${TRAEFIK_SERVICE_CONF:-$REPO_DIR/traefik/dynamic/services-asterias.yml}
STATE_FILE="$REPO_DIR/.active-color"
LOCAL_IMAGE=asterias-backend
KEEP_IMAGES=${KEEP_IMAGES:-3}
# Headroom demanded before the pull: the image unpacks to ~1.6GB, plus margin
# for the compressed blobs containerd keeps alongside the unpacked snapshot.
REQUIRE_FREE_MB=${REQUIRE_FREE_MB:-2560}
LOCK_FILE=/var/lock/asterias-deploy.lock
LOCK_WAIT=600

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

cd "$REPO_DIR"

# ---------------------------------------------------------------------------
# Host deploy lock
# ---------------------------------------------------------------------------
# GitHub's concurrency group already queues runs of this workflow, but a manual
# deploy from a shell would not be covered. Two overlapping cutovers fight over
# the upstream file and can leave nginx pointing at a container the other run
# has already stopped.
exec 9>"$LOCK_FILE" || { log "ERROR: cannot open $LOCK_FILE"; exit 1; }
if ! flock -w "$LOCK_WAIT" 9; then
    log "ERROR: timed out after ${LOCK_WAIT}s waiting for another deploy to finish"
    exit 1
fi

# ---------------------------------------------------------------------------
# Pick the idle colour
# ---------------------------------------------------------------------------
CURRENT=$(cat "$STATE_FILE" 2>/dev/null || echo "blue")
if [ "$CURRENT" = "blue" ]; then
    NEXT="green"; NEXT_PORT=5011
else
    NEXT="blue";  NEXT_PORT=5010
fi

log "=== Deploy: $CURRENT → $NEXT (port $NEXT_PORT) ==="
log "Image: $NEW_IMAGE"

# ---------------------------------------------------------------------------
# Pull the prebuilt image
# ---------------------------------------------------------------------------
if [ -n "${GHCR_TOKEN:-}" ]; then
    log "Logging in to ghcr.io as ${GHCR_USER:-unknown}..."
    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:?GHCR_USER not set}" --password-stdin
fi

# ---------------------------------------------------------------------------
# Make room before pulling
# ---------------------------------------------------------------------------
# This image is ~1.6GB and the host disk is 23GB shared with three other
# projects. On 24/9/2026 a pull on a nearly-full disk took kyklos-mongodb down
# with it. disk-guard runs every 15 minutes, so on its own it reacts after the
# pull that caused the problem, not before it. Reclaim first, and refuse the
# deploy rather than fill the disk — the running colour keeps serving.
free_mb() { df -Pm / | awk 'NR==2 {print $4}'; }

if [ "$(free_mb)" -lt "$REQUIRE_FREE_MB" ]; then
    log "Only $(free_mb)MB free, need ${REQUIRE_FREE_MB}MB — reclaiming..."
    [ -x /usr/local/bin/docker-reclaim ] && /usr/local/bin/docker-reclaim 2>&1 | sed 's/^/  /'
    apt-get clean 2>/dev/null || true

    if [ "$(free_mb)" -lt "$REQUIRE_FREE_MB" ]; then
        log "ERROR: still only $(free_mb)MB free, need ${REQUIRE_FREE_MB}MB."
        log "       Staying on $CURRENT. What is left needs a decision:"
        log "       rollback images (docker images), stopped containers, or a bigger disk."
        exit 1
    fi
    log "Reclaimed — $(free_mb)MB free, continuing"
fi

log "Pulling $NEW_IMAGE..."
PULLED=false
for attempt in 1 2 3; do
    if docker pull "$NEW_IMAGE"; then
        PULLED=true
        break
    fi
    log "  pull failed (attempt $attempt/3), retrying in $((attempt * 10))s..."
    sleep $((attempt * 10))
done
if [ "$PULLED" = false ]; then
    log "ERROR: could not pull $NEW_IMAGE — staying on $CURRENT"
    exit 1
fi

# docker-compose.yml pins each profile to asterias-backend:<colour>, so the
# pulled digest is retagged rather than the compose file being rewritten.
docker tag "$NEW_IMAGE" "$LOCAL_IMAGE:$NEXT"

# ---------------------------------------------------------------------------
# Start the idle colour
# ---------------------------------------------------------------------------
log "Starting $NEXT container..."
docker compose --profile "$NEXT" up -d --force-recreate

log "Health-checking port $NEXT_PORT..."
HEALTHY=false
for i in $(seq 1 40); do
    if curl -sf "http://127.0.0.1:$NEXT_PORT/health" > /dev/null 2>&1; then
        HEALTHY=true
        log "Healthy on attempt $i"
        break
    fi
    log "  attempt $i/40 — waiting 3s..."
    sleep 3
done

if [ "$HEALTHY" = false ]; then
    log "ERROR: health check failed — staying on $CURRENT"
    docker compose --profile "$NEXT" logs --tail=100 || true
    docker compose --profile "$NEXT" down 2>/dev/null || true
    exit 1
fi

# ---------------------------------------------------------------------------
# Cut the reverse proxy over
# ---------------------------------------------------------------------------
# Which proxy is live is detected rather than assumed, so this script works
# before, during and after the nginx -> Traefik conversion, and keeps working
# if cutover.sh has to roll back.
#
# "Is the Traefik container up" is the wrong question: Traefik runs staged on
# 8070/8453 for weeks before it owns the public ports, and answering yes there
# reconfigures a proxy nobody is talking to while nginx keeps pointing at the
# container this deploy is about to stop. The question is who holds 443.
live_proxy() {
    local holders
    holders=$(ss -ltnp 2>/dev/null | awk '$4 ~ /:443$/')
    case "$holders" in
        *'"traefik"'*) echo traefik; return ;;
        *'"nginx"'*)   echo nginx;   return ;;
    esac
    # Nothing on 443 at all — a proxy is down mid-cutover. Fall back to
    # whichever one exists so the deploy can still place its config.
    if docker ps --format '{{.Names}}' | grep -qx traefik; then
        echo traefik
    else
        echo nginx
    fi
}

# A 200 from /health through a proxy. The status code is checked rather than
# leaning on `curl -f`, because -f treats a redirect as success and both
# proxies answer plain HTTP for this host with a 301 to https — a probe that
# landed on the wrong port used to pass without reaching a container at all.
# -k because an expired cert should fail the uptime alarm, not roll back an
# otherwise healthy deploy; --resolve is what gets the SNI and Host right.
probe_health() {  # $1 = port
    [ "$(curl -s -k -o /dev/null -w '%{http_code}' --max-time 5 \
        --resolve "api.asteriashome.gr:$1:127.0.0.1" \
        "https://api.asteriashome.gr:$1/health" 2>/dev/null)" = "200" ]
}

LIVE_PROXY=${LIVE_PROXY:-$(live_proxy)}
log "Live proxy: $LIVE_PROXY"

if [ "$LIVE_PROXY" = traefik ]; then
    log "Switching Traefik service to port $NEXT_PORT..."
    PREV_CONF=$(cat "$TRAEFIK_SERVICE_CONF" 2>/dev/null || true)

    # Written to a temp file and moved into place: the file provider watches
    # this directory, and a partial write would be picked up mid-save. mv
    # within the same filesystem is atomic, so Traefik only ever sees the old
    # file or the complete new one.
    cat > "$TRAEFIK_SERVICE_CONF.tmp" <<EOF
# GENERATED by scripts/deploy.sh -- see traefik/dynamic/services-asterias.yml
http:
  services:
    asterias:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:$NEXT_PORT"
        passHostHeader: true
EOF
    mv "$TRAEFIK_SERVICE_CONF.tmp" "$TRAEFIK_SERVICE_CONF"

    # There is no `traefik -t` and no reload signal: the file provider reloads
    # on write. A malformed file is rejected in-process and Traefik keeps
    # serving the previous config, so the check is to confirm the new port is
    # actually being served rather than to validate syntax.
    #
    # Probed on the port Traefik really serves: 443 once it owns the public
    # ports, its staging port while the cutover is still pending.
    TRAEFIK_HTTPS_PORT=${TRAEFIK_HTTPS_PORT:-8453}
    if ss -ltnp 2>/dev/null | awk '$4 ~ /:443$/' | grep -q '"traefik"'; then
        TRAEFIK_HTTPS_PORT=443
    fi

    SWITCHED=false
    for i in $(seq 1 15); do
        if probe_health "$TRAEFIK_HTTPS_PORT"; then
            SWITCHED=true
            log "Traefik serving $NEXT on :$TRAEFIK_HTTPS_PORT (attempt $i)"
            break
        fi
        sleep 2
    done

    if [ "$SWITCHED" = false ]; then
        log "ERROR: Traefik did not pick up the new service — restoring previous config"
        printf '%s\n' "$PREV_CONF" > "$TRAEFIK_SERVICE_CONF"
        docker compose --profile "$NEXT" down 2>/dev/null || true
        exit 1
    fi
else
    log "Switching nginx upstream to port $NEXT_PORT..."
    PREV_CONF=$(cat "$UPSTREAM_CONF" 2>/dev/null || true)

    cat > "$UPSTREAM_CONF" <<EOF
upstream asterias_backend {
    server 127.0.0.1:$NEXT_PORT;
}
EOF

    # Validate before reloading: a reload on a bad config is refused and nginx
    # keeps serving the old upstream, but leaving a broken file on disk would
    # break the next restart, so restore it instead of leaving it there.
    if ! nginx -t; then
        log "ERROR: nginx rejected the new upstream — restoring previous config"
        printf '%s\n' "$PREV_CONF" > "$UPSTREAM_CONF"
        docker compose --profile "$NEXT" down 2>/dev/null || true
        exit 1
    fi

    nginx -s reload
    log "nginx reloaded"

    # `nginx -t` only says the file parses; it says nothing about anything
    # listening on $NEXT_PORT. Without this probe a cutover to a container
    # that never came up leaves the whole public API answering 502.
    SWITCHED=false
    for i in $(seq 1 15); do
        if probe_health 443; then
            SWITCHED=true
            log "nginx serving $NEXT on :$NEXT_PORT (attempt $i)"
            break
        fi
        sleep 2
    done

    if [ "$SWITCHED" = false ]; then
        log "ERROR: nginx is not serving $NEXT — restoring previous upstream"
        if [ -n "$PREV_CONF" ]; then
            printf '%s\n' "$PREV_CONF" > "$UPSTREAM_CONF"
            nginx -t && nginx -s reload
        fi
        docker compose --profile "$NEXT" down 2>/dev/null || true
        exit 1
    fi
fi

echo "$NEXT" > "$STATE_FILE"
log "Traffic on $NEXT"

# ---------------------------------------------------------------------------
# Retire the old colour
# ---------------------------------------------------------------------------
log "Stopping old $CURRENT container..."
docker compose --profile "$CURRENT" down 2>/dev/null || true
docker stop "asterias-$CURRENT" 2>/dev/null || true

# ---------------------------------------------------------------------------
# Reclaim disk
# ---------------------------------------------------------------------------
# Keep the newest few pulled tags so a rollback is a retag away, drop the rest.
log "Pruning old images (keeping newest $KEEP_IMAGES of $IMAGE_REPO)..."
docker images "$IMAGE_REPO" --format '{{.Tag}}' \
    | grep -E '^[0-9]+$' \
    | sort -nr \
    | tail -n +"$((KEEP_IMAGES + 1))" \
    | while read -r tag; do
        docker rmi "$IMAGE_REPO:$tag" >/dev/null 2>&1 \
            && log "  removed $IMAGE_REPO:$tag" \
            || log "  kept $IMAGE_REPO:$tag (still in use)"
    done
docker image prune -f >/dev/null 2>&1 || true

log "=== Done — serving from $NEXT on port $NEXT_PORT ==="
