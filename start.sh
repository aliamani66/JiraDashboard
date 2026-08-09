#!/bin/bash

echo "==================================================="
echo "🚀 راه‌اندازی خودکار سامانه داشبورد عملیات R&D"
echo "==================================================="
echo ""

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "1. نصب و بررسی Backend..."
cd backend
if [ ! -d "node_modules" ]; then
    echo "در حال نصب پکیج‌های backend..."
    npm install
fi

if [ ! -f "database.sqlite" ]; then
    echo "در حال ساخت دیتابیس اولیه..."
    node src/seed.js
fi

echo "در حال اجرای سرور backend روی پورت 3001..."
node src/app.js &
BACKEND_PID=$!

cd ..

echo "2. نصب و بررسی Frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "در حال نصب پکیج‌های frontend..."
    npm install
fi

echo "در حال اجرای فرانت‌اند Vite روی پورت 5173..."
npx vite --host &
FRONTEND_PID=$!

echo ""
echo "==================================================="
echo "✅ سامانه با موفقیت راه‌اندازی گردید!"
echo "🌐 آدرس داشبورد: http://localhost:5173"
echo "🔑 نام کاربری مدیر: admin  |  کلمه عبور: admin123"
echo "==================================================="
echo ""

wait $BACKEND_PID $FRONTEND_PID
