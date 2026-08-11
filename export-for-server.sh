#!/bin/bash
set -e

echo "======================================================"
echo "  ساخت و Export ایمیج‌های Docker (بدون Nginx) برای سرور"
echo "======================================================"
echo ""

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

mkdir -p deploy

echo "[1/4] در حال Build کردن ایمیج‌های Backend و Frontend..."
docker compose build backend frontend

echo "[2/4] Export کردن ایمیج Backend..."
docker save jira-dashboard-backend:latest | gzip > deploy/backend-image.tar.gz

echo "[3/4] Export کردن ایمیج Frontend..."
docker save jira-dashboard-frontend:latest | gzip > deploy/frontend-image.tar.gz

echo "[4/4] کپی فایل‌های کانفیگ..."
cp docker-compose.offline.yml deploy/docker-compose.yml
cp backend.env.template deploy/backend.env

echo ""
echo "======================================================"
echo " فایل‌های آماده برای انتقال در پوشه deploy/ قرار دارند:"
echo "   - backend-image.tar.gz"
echo "   - frontend-image.tar.gz"
echo "   - docker-compose.yml"
echo "   - backend.env"
echo ""
echo " دستورات اجرا روی سرور لینوکس:"
echo "   cd deploy"
echo "   docker load -i backend-image.tar.gz"
echo "   docker load -i frontend-image.tar.gz"
echo "   docker compose up -d"
echo "======================================================"
