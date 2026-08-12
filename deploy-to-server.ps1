# ======================================================
# Automated Server Deployment Script (Jira Dashboard)
# ======================================================
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (Test-Path "JiraDashboard") { Set-Location "JiraDashboard" }
if (Test-Path "ops-showcase-dashboard") { Set-Location "ops-showcase-dashboard" }

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Automated Server Deployment Script (Jira Dashboard)" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Git pull
Write-Host "[1/4] Pulling latest code changes from Git repository..." -ForegroundColor Yellow
git pull origin main

# 2. Compress clean archive using POSIX tar.gz
Write-Host ""
Write-Host "[2/4] Creating clean tar.gz deployment package (JiraDashboard.tar.gz)..." -ForegroundColor Yellow
if (Test-Path "JiraDashboard.tar.gz") { Remove-Item "JiraDashboard.tar.gz" -Force }
if (Test-Path "JiraDashboard.zip") { Remove-Item "JiraDashboard.zip" -Force }

tar -czf JiraDashboard.tar.gz --exclude="node_modules" --exclude="frontend/node_modules" --exclude="backend/node_modules" --exclude=".git" --exclude="backend/database.sqlite" --exclude="frontend/dist" --exclude=".vscode" --exclude="deploy" --exclude="*.tar.gz" --exclude="*.zip" .

if (-not (Test-Path "JiraDashboard.tar.gz")) {
    Write-Host "[ERROR] Failed to create JiraDashboard.tar.gz archive!" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Created JiraDashboard.tar.gz successfully." -ForegroundColor Green

# 3. Server target
$serverSSH = "root@10.100.8.130"

# 4. SCP transfer
Write-Host ""
Write-Host "[3/4] Transferring package via SCP to $serverSSH..." -ForegroundColor Yellow
scp JiraDashboard.tar.gz "${serverSSH}:/tmp/JiraDashboard.tar.gz"

# 5. Remote Un-tar & Docker Build
Write-Host ""
Write-Host "[4/4] Extracting package and deploying Docker Compose at /appserver/amani/JiraDashboard..." -ForegroundColor Yellow
$remoteCmd = "mkdir -p /appserver/amani/JiraDashboard && tar -xzf /tmp/JiraDashboard.tar.gz -C /appserver/amani/JiraDashboard && cd /appserver/amani/JiraDashboard && docker compose down && (docker compose up -d --build || docker-compose up -d --build)"
ssh $serverSSH $remoteCmd

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "[SUCCESS] Deployment completed successfully!" -ForegroundColor Green
Write-Host "Server Target: /appserver/amani/JiraDashboard" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green

