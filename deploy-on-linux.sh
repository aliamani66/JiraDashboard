#!/usr/bin/env bash
# ==============================================================================
# Linux Direct Deployment Script for Jira Dashboard
# Runs git pull from GitHub, builds Docker images, and restarts containers.
# ==============================================================================

set -e

# Change to script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================================"
echo "🚀 Starting Linux Deployment (Jira Dashboard)"
echo "   Directory: $SCRIPT_DIR"
echo "======================================================"

# 1. Git pull latest code from GitHub
echo ""
echo "[1/3] 📥 Pulling latest changes from GitHub (main branch)..."
git fetch origin main
git reset --hard origin/main

# 2. Detect Docker Compose command
echo ""
echo "[2/3] 🐳 Detecting Docker Compose command..."
DC="docker compose"
if command -v docker-compose >/dev/null 2>&1; then
    DC="docker-compose"
elif docker compose version >/dev/null 2>&1; then
    DC="docker compose"
fi
echo "      Using: $DC"

# 3. Build & Restart Docker Compose services
echo ""
echo "[3/3] 🔨 Building and starting Docker containers..."
$DC down --remove-orphans || true
$DC build --no-cache
$DC up -d --force-recreate

echo ""
echo "======================================================"
echo "✅ Deployment completed successfully!"
echo "   Containers Status:"
echo "======================================================"
$DC ps
