#!/bin/bash
# One-time VPS setup script for asterias-backend
# Run on a fresh Ubuntu 24.04 VPS as root:
#   curl -sSL https://raw.githubusercontent.com/YOUR_ORG/asterias-backend/main/scripts/setup-vps.sh | bash
set -euo pipefail

REPO_URL="git@github.com:YOUR_ORG/asterias-backend.git"   # ← update this
REPO_DIR="/opt/asterias-backend"

echo "=== Installing Docker ==="
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "=== Cloning repo ==="
git clone "$REPO_URL" "$REPO_DIR"
cd "$REPO_DIR"

echo "=== Creating .env.production ==="
echo "Copy .env.production.example and fill in real values:"
cp .env.production.example .env.production
echo "  → Edit $REPO_DIR/.env.production before continuing."
read -rp "Press Enter once .env.production is ready..."

echo "=== Building initial blue image ==="
docker build -t asterias-backend:blue .

echo "=== Initialising active-color state ==="
echo "blue" > .active-color

echo "=== Starting Nginx + blue container ==="
docker compose --profile blue up -d

echo "=== Setup complete ==="
echo "Backend should be reachable at http://$(hostname -I | awk '{print $1}')"
echo "Nginx upstream: nginx/conf.d/upstream.conf → asterias-blue:5000"
