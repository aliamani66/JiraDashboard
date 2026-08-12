@echo off
chcp 65001 > nul
echo ======================================================
echo 🚀 Automated Server Deployment Script (Jira Dashboard)
echo ======================================================
echo.

cd /d "%~dp0"
if exist "JiraDashboard" cd JiraDashboard
if exist "ops-showcase-dashboard" cd ops-showcase-dashboard

echo [1/4] Pulling latest changes from Git repository...
git pull origin main

echo.
echo [2/4] Creating clean deployment package (JiraDashboard.zip)...
powershell -Command "if (Test-Path 'JiraDashboard.zip') { Remove-Item 'JiraDashboard.zip' -Force }; $files = Get-ChildItem -Path . | Where-Object { @('node_modules','.git','database.sqlite','dist','.vscode','deploy','JiraDashboard.zip') -notcontains $_.Name }; Compress-Archive -Path $files.FullName -DestinationPath 'JiraDashboard.zip' -Force"

if not exist "JiraDashboard.zip" (
    echo ❌ ERROR: Failed to create JiraDashboard.zip archive!
    pause
    exit /b 1
)

echo ✅ Created JiraDashboard.zip successfully.
echo.

set SERVER_SSH=root@10.100.8.130
echo [3/4] Uploading JiraDashboard.zip via SCP to %SERVER_SSH%...
scp JiraDashboard.zip %SERVER_SSH%:/tmp/JiraDashboard.zip

if errorlevel 1 (
    echo ❌ ERROR: SCP file transfer failed!
    pause
    exit /b 1
)

echo.
echo [4/4] Extracting archive and executing Docker Compose on server...
ssh %SERVER_SSH% "mkdir -p /appserver/amani/JiraDashboard && unzip -o /tmp/JiraDashboard.zip -d /appserver/amani/JiraDashboard && cd /appserver/amani/JiraDashboard && docker compose down && (docker compose up -d --build || docker-compose up -d --build)"

if errorlevel 1 (
    echo ❌ ERROR: Remote SSH command execution failed!
    pause
    exit /b 1
)

echo.
echo ======================================================
echo ✅ SUCCESS: Deployment completed successfully!
echo 📂 Server Target: /appserver/amani/JiraDashboard
echo ======================================================
echo.
pause
