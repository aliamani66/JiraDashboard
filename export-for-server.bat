@echo off
chcp 65001 > nul
echo ======================================================
echo   ساخت و Export ایمیج‌های Docker برای انتقال به سرور
echo ======================================================
echo.

cd /d "%~dp0"

echo [1/4] در حال Build کردن ایمیج‌های Docker...
docker compose build
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

echo [4/4] Export کردن ایمیج Nginx Proxy...
docker save jira-nginx-proxy:latest | gzip > deploy\nginx-image.tar.gz
echo [4/4] nginx-image.tar.gz ساخته شد.
echo.

echo [5/5] کپی فایل‌های مورد نیاز...
copy docker-compose.offline.yml deploy\docker-compose.yml
copy backend.env.template deploy\backend.env
echo [5/5] انجام شد.

echo.
echo ======================================================
echo  فایل‌های آماده برای انتقال در پوشه deploy/ قرار دارند:
echo   - backend-image.tar.gz
echo   - frontend-image.tar.gz
echo   - nginx-image.tar.gz
echo   - docker-compose.yml
echo   - backend.env  (قبل از انتقال ویرایش کنید!)
echo.
echo  دستور اجرا روی سرور:
echo    docker load -i backend-image.tar.gz
echo    docker load -i frontend-image.tar.gz
echo    docker load -i nginx-image.tar.gz
echo    docker compose up -d
echo ======================================================
pause
