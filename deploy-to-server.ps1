# ======================================================
# 🚀 اسکریپت پاورشل خودکار دیپلوی داشبورد روی سرور
# ======================================================
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "🚀 اسکریپت خودکار دیپلوی داشبورد روی سرور لینوکس" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Git pull
Write-Host "1. در حال دریافت آخرین تغییرات از Git (git pull)..." -ForegroundColor Yellow
git pull origin main

# 2. Compress clean archive
Write-Host ""
Write-Host "2. در حال ساخت فایل فشرده پروژه (JiraDashboard.zip)..." -ForegroundColor Yellow
if (Test-Path "JiraDashboard.zip") { Remove-Item "JiraDashboard.zip" -Force }

$excludeList = @("node_modules", ".git", "database.sqlite", "dist", ".vscode", "deploy", "JiraDashboard.zip")
$filesToZip = Get-ChildItem -Path . | Where-Object { $excludeList -notcontains $_.Name }

Compress-Archive -Path $filesToZip.FullName -DestinationPath "JiraDashboard.zip" -Force
Write-Host "✅ فایل JiraDashboard.zip با موفقیت ساخته شد." -ForegroundColor Green

# 3. Server info
Write-Host ""
$serverSSH = Read-Host "لطفاً کاربر و آدرس IP سرور را وارد کنید [پیش‌فرض: root@10.100.8.130]"
if ([string]::IsNullOrWhiteSpace($serverSSH)) {
    $serverSSH = "root@10.100.8.130"
}

# 4. SCP transfer
Write-Host ""
Write-Host "3. در حال ارسال فایل با SCP به سرور ($serverSSH)..." -ForegroundColor Yellow
scp JiraDashboard.zip "${serverSSH}:/tmp/JiraDashboard.zip"

# 5. Remote Unzip & Docker Build
Write-Host ""
Write-Host "4. در حال استخراج و اجرای Docker Compose در مسیر /app/appserver/amani/JiraDashboard ..." -ForegroundColor Yellow
$remoteCmd = "mkdir -p /app/appserver/amani/JiraDashboard && unzip -o /tmp/JiraDashboard.zip -d /app/appserver/amani/JiraDashboard && cd /app/appserver/amani/JiraDashboard && (docker compose up -d --build || docker-compose up -d --build)"
ssh $serverSSH $remoteCmd

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "✅ پروژه با موفقیت روی سرور دیپلوی شد!" -ForegroundColor Green
Write-Host "📂 مسیر سرور: /app/appserver/amani/JiraDashboard" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
