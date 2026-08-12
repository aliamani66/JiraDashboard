@echo off
chcp 65001 > nul
echo ===================================================
echo 🚀 راه اندازی خودکار سامانه داشبورد عملیات R&D
echo ===================================================
echo.

cd /d "%~dp0"

echo 1. بررسی و نصب پیش‌نیازهای Backend...
cd backend
if not exist "node_modules" call npm install
if not exist "database.sqlite" call node src/seed.js

echo.
echo 2. اجرای سرور Backend روی پورت 3001...
start "Backend Server (Port 3001)" cmd /k "node src/app.js"

cd "%~dp0"

echo.
echo 3. بررسی و نصب پیش‌نیازهای Frontend...
cd frontend
if not exist "node_modules" call npm install

echo.
echo 4. اجرای فرانت‌اند Vite روی پورت 5173...
start "Frontend Server (Port 5173)" cmd /k "npm run dev"

cd "%~dp0"

echo.
echo ===================================================
echo ✅ سامانه با موفقیت راه‌اندازی گردید!
echo 🌐 آدرس داشبورد: http://localhost:5173
echo 🔑 نام کاربری مدیر: admin  |  کلمه عبور: admin123
echo ===================================================
echo.

timeout /t 3 > nul
start http://localhost:5173
