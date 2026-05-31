#!/bin/bash
# Blue-green deployment — runs on VPS via GitHub Actions SSH
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_CONF="/etc/nginx/conf.d/asterias-upstream.conf"
STATE_FILE="$REPO_DIR/.active-color"
IMAGE_NAME="asterias-backend"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

cd "$REPO_DIR"

CURRENT=$(cat "$STATE_FILE" 2>/dev/null || echo "blue")
if [ "$CURRENT" = "blue" ]; then
    NEXT="green"; NEXT_PORT=5011
else
    NEXT="blue";  NEXT_PORT=5010
fi

log "=== Deploy: $CURRENT → $NEXT (port $NEXT_PORT) ==="

log "Pulling latest code..."
git pull origin main

log "Building image $IMAGE_NAME:$NEXT..."
docker build -t "$IMAGE_NAME:$NEXT" .

log "Starting $NEXT container..."
docker compose --profile "$NEXT" up -d

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
    docker compose --profile "$NEXT" down 2>/dev/null || true
    exit 1
fi

log "Switching Nginx upstream to port $NEXT_PORT..."
cat > "$UPSTREAM_CONF" <<EOF
upstream asterias_backend {
    server 127.0.0.1:$NEXT_PORT;
}
EOF
nginx -s reload
log "Nginx reloaded — traffic on $NEXT"

echo "$NEXT" > "$STATE_FILE"

log "Stopping old $CURRENT container..."
docker stop "asterias-$CURRENT"  2>/dev/null || true
docker compose --profile "$CURRENT" down 2>/dev/null || true
docker rmi "$IMAGE_NAME:$CURRENT" 2>/dev/null || true

log "=== Done — serving from $NEXT on port $NEXT_PORT ==="
