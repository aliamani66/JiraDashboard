@echo off
chcp 65001 > nul
echo ======================================================
echo 🚀 اسکریپت خودکار دیپلوی داشبورد روی سرور لینوکس
echo ======================================================
echo.

cd /d "%~dp0"

echo 1. در حال دریافت آخرین تغییرات از Git (git pull)...
git pull origin main

echo.
echo 2. در حال ساخت فایل فشرده پروژه (JiraDashboard.zip)...
powershell -Command "if (Test-Path 'JiraDashboard.zip') { Remove-Item 'JiraDashboard.zip' -Force }; $files = Get-ChildItem -Path . | Where-Object { @('node_modules','.git','database.sqlite','dist','.vscode','deploy','JiraDashboard.zip') -notcontains $_.Name }; Compress-Archive -Path $files.FullName -DestinationPath 'JiraDashboard.zip' -Force"

if not exist "JiraDashboard.zip" (
    echo ❌ خطا در ساخت فایل زیپ!
    pause
    exit /b 1
)

echo ✅ فایل JiraDashboard.zip با موفقیت ساخته شد.
echo.

set /p SERVER_SSH="لطفاً کاربر و آدرس IP سرور را وارد کنید [پیش‌فرض: root@10.100.8.130]: "
if "%SERVER_SSH%"=="" set SERVER_SSH=root@10.100.8.130

echo.
echo 3. در حال انتقال فایل با SCP به سرور (%SERVER_SSH%)...
scp JiraDashboard.zip %SERVER_SSH%:/tmp/JiraDashboard.zip

if errorlevel 1 (
    echo ❌ خطا در ارسال فایل با SCP به سرور!
    pause
    exit /b 1
)

echo.
echo 4. در حال استخراج و اجرای Docker Compose در مسیر /appserver/amani/JiraDashboard ...
ssh %SERVER_SSH% "mkdir -p /appserver/amani/JiraDashboard && unzip -o /tmp/JiraDashboard.zip -d /appserver/amani/JiraDashboard && cd /appserver/amani/JiraDashboard && docker compose down && (docker compose up -d --build || docker-compose up -d --build)"

if errorlevel 1 (
    echo ❌ خطا در اجرای دستورات روی سرور!
    pause
    exit /b 1
)

echo.
echo ======================================================
echo ✅ پروژه‌ با موفقیت روی سرور دیپلوی گردید!
echo 📂 مسیر سرور: /appserver/amani/JiraDashboard
echo ======================================================
echo.
pause
