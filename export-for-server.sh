#!/bin/bash
set -e

echo "======================================================"
echo "  ساخت و Export ایمیج‌های Docker برای سرور لینوکس"
echo "======================================================"
echo ""

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

mkdir -p deploy

echo "[1/5] در حال Build کردن ایمیج‌های Docker..."
docker compose build

echo "[2/5] Export کردن ایمیج Backend..."
docker save jira-dashboard-backend:latest | gzip > deploy/backend-image.tar.gz

echo "[3/5] Export کردن ایمیج Frontend..."
docker save jira-dashboard-frontend:latest | gzip > deploy/frontend-image.tar.gz

echo "[4/5] Export کردن ایمیج Nginx Proxy..."
docker save jira-nginx-proxy:latest | gzip > deploy/nginx-image.tar.gz

echo "[5/5] کپی فایل‌های کانفیگ..."
cp docker-compose.offline.yml deploy/docker-compose.yml
cp backend.env.template deploy/backend.env

echo ""
echo "======================================================"
echo " فایل‌های آماده برای انتقال در پوشه deploy/ قرار دارند:"
echo "   - backend-image.tar.gz"
echo "   - frontend-image.tar.gz"
echo "   - nginx-image.tar.gz"
echo "   - docker-compose.yml"
echo "   - backend.env"
echo ""
echo " دستورات اجرا روی سرور لینوکس:"
echo "   cd deploy"
echo "   docker load -i backend-image.tar.gz"
echo "   docker load -i frontend-image.tar.gz"
echo "   docker load -i nginx-image.tar.gz"
echo "   docker compose up -d"
echo "======================================================"
