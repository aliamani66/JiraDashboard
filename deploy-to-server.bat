@echo off
chcp 65001 > nul
echo ======================================================
echo Automated Server Deployment Script (Jira Dashboard)
echo ======================================================
echo.

cd /d "%~dp0"
if exist "JiraDashboard" cd JiraDashboard
if exist "ops-showcase-dashboard" cd ops-showcase-dashboard

echo [1/4] Syncing latest changes from Git repository...
git fetch origin main
git reset --hard origin/main

echo.
echo [2/4] Creating clean tar.gz deployment package (JiraDashboard.tar.gz)...
if exist "JiraDashboard.tar.gz" del /f /q JiraDashboard.tar.gz
if exist "JiraDashboard.zip" del /f /q JiraDashboard.zip

tar -czf JiraDashboard.tar.gz --exclude="node_modules" --exclude="frontend/node_modules" --exclude="backend/node_modules" --exclude=".git" --exclude="backend/database.sqlite" --exclude=".vscode" --exclude="deploy" --exclude="*.tar.gz" --exclude="*.zip" .

if not exist "JiraDashboard.tar.gz" (
    echo [ERROR] Failed to create JiraDashboard.tar.gz archive!
    pause
    exit /b 1
)

echo [OK] Created JiraDashboard.tar.gz successfully.
echo.

set SERVER_SSH=root@10.100.8.130
echo [3/4] Uploading JiraDashboard.tar.gz via SCP to %SERVER_SSH%...
scp JiraDashboard.tar.gz %SERVER_SSH%:/tmp/JiraDashboard.tar.gz

if errorlevel 1 (
    echo [ERROR] SCP file transfer failed!
    pause
    exit /b 1
)

echo.
echo [4/4] Extracting archive and executing Docker Compose on server...
ssh %SERVER_SSH% "export PATH=$PATH:/usr/local/bin:/usr/bin; DC='docker compose'; if command -v docker-compose >/dev/null 2>&1; then DC='docker-compose'; fi; if docker compose version >/dev/null 2>&1; then DC='docker compose'; fi; mkdir -p /appserver/amani/JiraDashboard && tar -xzf /tmp/JiraDashboard.tar.gz -C /appserver/amani/JiraDashboard && cd /appserver/amani/JiraDashboard && ($DC down || true) && $DC build --no-cache && $DC up -d --force-recreate"

if errorlevel 1 (
    echo [ERROR] Remote SSH command execution failed!
    pause
    exit /b 1
)

echo.
echo ======================================================
echo [SUCCESS] Deployment completed successfully!
echo Server Target: /appserver/amani/JiraDashboard
echo ======================================================
echo.
pause

