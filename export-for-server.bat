@echo off
chcp 65001 > nul
echo ======================================================
echo   ساخت و Export ایمیج‌های Docker (بدون Nginx) برای سرور
echo ======================================================
echo.

cd /d "%~dp0"

echo [1/4] در حال Build کردن ایمیج‌های Backend و Frontend...
docker compose build backend frontend
if errorlevel 1 (
    echo خطا: Build با خطا مواجه شد!
    pause
    exit /b 1
)
echo [1/4] Build با موفقیت انجام شد.
echo.

echo [2/4] Export کردن ایمیج Backend...
docker save jira-dashboard-backend:latest | gzip > deploy\backend-image.tar.gz
echo [2/4] backend-image.tar.gz ساخته شد.
echo.

echo [3/4] Export کردن ایمیج Frontend...
docker save jira-dashboard-frontend:latest | gzip > deploy\frontend-image.tar.gz
echo [3/4] frontend-image.tar.gz ساخته شد.
echo.

echo [4/4] کپی فایل‌های کانفیگ (نسخه بدون Nginx)...
copy docker-compose.offline.yml deploy\docker-compose.yml
copy backend.env.template deploy\backend.env
echo [4/4] انجام شد.

echo.
echo ======================================================
echo  فایل‌های آماده برای انتقال در پوشه deploy/ قرار دارند:
echo   - backend-image.tar.gz
echo   - frontend-image.tar.gz
echo   - docker-compose.yml
echo   - backend.env  (قبل از اجرای docker compose ویرایش کنید)
echo.
echo  دستورات اجرا روی سرور لینوکس:
echo    docker load -i backend-image.tar.gz
echo    docker load -i frontend-image.tar.gz
echo    docker compose up -d
echo ======================================================
pause
