# ======================================================
# 🚀 Automated Server Deployment Script (Jira Dashboard)
# ======================================================
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (Test-Path "JiraDashboard") { Set-Location "JiraDashboard" }
if (Test-Path "ops-showcase-dashboard") { Set-Location "ops-showcase-dashboard" }

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "🚀 Automated Server Deployment Script (Jira Dashboard)" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Git pull
Write-Host "[1/4] Pulling latest code changes from Git repository..." -ForegroundColor Yellow
git pull origin main

# 2. Compress clean archive
Write-Host ""
Write-Host "[2/4] Creating clean deployment package (JiraDashboard.zip)..." -ForegroundColor Yellow
if (Test-Path "JiraDashboard.zip") { Remove-Item "JiraDashboard.zip" -Force }

$excludeList = @("node_modules", ".git", "database.sqlite", "dist", ".vscode", "deploy", "JiraDashboard.zip")
$filesToZip = Get-ChildItem -Path . | Where-Object { $excludeList -notcontains $_.Name }

Compress-Archive -Path $filesToZip.FullName -DestinationPath "JiraDashboard.zip" -Force
Write-Host "✅ Created JiraDashboard.zip successfully." -ForegroundColor Green

# 3. Server target
$serverSSH = "root@10.100.8.130"

# 4. SCP transfer
Write-Host ""
Write-Host "[3/4] Transferring package via SCP to $serverSSH..." -ForegroundColor Yellow
scp JiraDashboard.zip "${serverSSH}:/tmp/JiraDashboard.zip"

# 5. Remote Unzip & Docker Build
Write-Host ""
Write-Host "[4/4] Extracting package and deploying Docker Compose at /appserver/amani/JiraDashboard..." -ForegroundColor Yellow
$remoteCmd = "mkdir -p /appserver/amani/JiraDashboard && unzip -q -o /tmp/JiraDashboard.zip -d /appserver/amani/JiraDashboard && cd /appserver/amani/JiraDashboard && docker compose down && (docker compose up -d --build || docker-compose up -d --build)"
ssh $serverSSH $remoteCmd

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "✅ SUCCESS: Deployment completed successfully!" -ForegroundColor Green
Write-Host "📂 Server Target: /appserver/amani/JiraDashboard" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
