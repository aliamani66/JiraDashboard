# Ops R&D Showcase Dashboard (Jira Operations Dashboard)

یک سامانه ویترین عملیاتی و مدیریت پروژه R&D با قابلیت اتکای کامل و سینک زنده به **Jira Cloud / Jira Data Center** و **Confluence**.

![Dashboard Overview](https://img.shields.io/badge/Jira-Cloud%20%26%20Server-0052CC?logo=jira&logoColor=white)
![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)

---

## 🌟 امکانات اصلی

- 🌐 **داشبورد اصلی پروژه‌ها:** ویترین پروژه‌های فعال و انجام‌شده با کارت‌های هم‌اندازه، درصد پیشرفت، فیلتر سریع کامپوننت‌ها و تب‌های وضعیت.
- 📊 **گانت چارت چابک (Gantt Chart):** نمایش زمان‌بندی تسک‌ها با لینک مستقیم به Jira Cloud، نشانگر خط امروز (Today line) و فیلترهای پیشرفته.
- 📈 **تایم‌لاین پیشرفت کل (`/overall-timeline`):** نمودار چندپروژه‌ای سرعت توسعه (Velocity Curve) و میانگین واقعی پیشرفت کل پروژه‌ها.
- ⏳ **مدیریت تسک‌های منتظر (`/waiting-tasks`):** تفکیک تسک‌هایی که منتظر تیم‌های دیگر هستند بر اساس `is_waiting` و برچسب‌های `wait:`.
- ⚙️ **تنظیمات و پایش زنده ساختار Jira API (`/jira-settings`):** پنل کامل مدیریت اتصال، نگاشت وضعیت‌ها (Status Mapping)، کاستوم‌فیلدها و تست عارضه‌یابی زنده API.
- 👥 **مدیریت کاربران و دسترسی‌ها (`/user-management`):** تعریف کاربران، نقش‌ها و تخصیص سطح دسترسی به تک‌تک منوهای جانبی.

---

## 🛠️ تکنولوژی‌ها

- **Frontend:** React 18, Vite, Framer Motion, Lucide React, Recharts, React Router v6.
- **Backend:** Node.js, Express, SQLite (sql.js / sqlite3), Axios, JWT, bcryptjs, node-cron.

---

## 🚀 راه اندازی سریع (Quick Start)

### ۱. کلون پروژه
```bash
git clone https://github.com/aliamani66/JiraDashboard.git
cd JiraDashboard
```

### ۲. نصب و راه‌اندازی بک‌اند
```bash
cd backend
npm install
node src/seed.js # ساخت و مقداردهی اولیه دیتابیس
node src/app.js  # اجرا روی پورت 3001
```

### ۳. نصب و راه‌اندازی فرانت‌اند
```bash
cd ../frontend
npm install
npm run dev      # اجرا روی پورت 5173
```

---

## 🔑 اطلاعات ورود پیش‌فرض

- **مدیر سیستم (Admin):**
  - **نام کاربری:** `admin`
  - **کلمه عبور:** `admin123`
- **کاربر تستی (فقط تسک‌های منتظر):**
  - **نام کاربری:** `waiting_user`
  - **کلمه عبور:** `123456`
