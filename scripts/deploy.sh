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
STATE_FILE="$REPO_DIR/.active-color"
LOCAL_IMAGE=asterias-backend
KEEP_IMAGES=${KEEP_IMAGES:-3}
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
# Cut nginx over
# ---------------------------------------------------------------------------
log "Switching nginx upstream to port $NEXT_PORT..."
PREV_CONF=$(cat "$UPSTREAM_CONF" 2>/dev/null || true)

cat > "$UPSTREAM_CONF" <<EOF
upstream asterias_backend {
    server 127.0.0.1:$NEXT_PORT;
}
EOF

# Validate before reloading: a reload on a bad config is refused and nginx keeps
# serving the old upstream, but leaving a broken file on disk would break the
# next restart, so restore it instead of leaving it there.
if ! nginx -t; then
    log "ERROR: nginx rejected the new upstream — restoring previous config"
    printf '%s\n' "$PREV_CONF" > "$UPSTREAM_CONF"
    docker compose --profile "$NEXT" down 2>/dev/null || true
    exit 1
fi

nginx -s reload
echo "$NEXT" > "$STATE_FILE"
log "nginx reloaded — traffic on $NEXT"

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
