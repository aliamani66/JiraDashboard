# 📘 مستندات جامع سامانه داشبورد عملیات R&D (Jira Operations Showcase Dashboard)

این سند شامل راهنمای جامع معماری، نصب و راه‌اندازی ۱ کلیکی، نحوه اتصال به Jira/Confluence و **مستندات تفصیلی بخش تنظیمات و نگاشت داده‌ها** می‌باشد.

---

## 📑 فهرست مطالب

۱. [معماری و ویژگی‌های کلی سامانه](#1-معماری-و-ویژگی‌های-کلی-سامانه)  
۲. [راهنمای نصب و راه‌اندازی ۱ کلیکی](#2-راهنمای-نصب-و-راه‌اندازی-۱-کلیکی)  
۳. [مستندات کامل بخش تنظیمات و پایش جیرا (/jira-settings)](#3-مستندات-کامل-بخش-تنظیمات-و-پایش-جیرا)  
۴. [راهنمای کاربری و معرفی بخش‌های مختلف داشبورد](#4-راهنمای-کاربری-و-معرفی-بخش‌های-مختلف-داشبورد)  
۵. [پیکربندی کامل فایل .env](#5-پیکربندی-کامل-فایل-env)  

---

## 1. معماری و ویژگی‌های کلی سامانه

سامانه ویترین عملیاتی R&D یک داشبورد مدرن، زیبا و دارک‌مود بر پایه معماری لایه‌ای زیر می‌باشد:

- **فرانت‌اند (Frontend):** توسعه داده‌شده با React 18، Vite، Framer Motion، Lucide React، Recharts و پشتیبانی کامل از RTL/فارسی.
- **بک‌اند (Backend):** سرویس‌دهنده Node.js / Express با معماری RESTful API.
- **دیتابیس (Database):** دیتابیس سبک و متمرکز SQLite 3 (`database.sqlite`) که نقش لایه بافر و کش داده‌های همگام‌شده را ایفا می‌کند.
- **احراز هویت و دسترسی (Auth & ACL):** سیستم احراز هویت توکن‌محور JWT همراه با رمزنگاری bcryptjs و جدول کنترل دسترسی منومحور (Permission-based ACL).

---

## 2. راهنمای نصب و راه‌اندازی ۱ کلیکی

### 🔹 در ویندوز (Windows)
کافیست در ریشه پروژه روی فایل **`start.bat`** دابل‌کلیک نمایید. اسکریپت به صورت خودکار:
۱. وابستگی‌های بک‌اند و فرانت‌اند (`npm install`) را بررسی و نصب می‌کند.
۲. دیتابیس اولیه را ایجاد می‌نماید.
۳. بک‌اند (پورت ۳۰۰۱) و فرانت‌اند (پورت ۵۱۷۳) را اجرا می‌کند.
۴. مرورگر را روی آدرس **`http://localhost:5173`** باز می‌کند.

### 🔹 در لینوکس / مک (Linux / Mac)
```bash
chmod +x start.sh
./start.sh
```

### 🔑 حساب‌های کاربری پیش‌فرض سیستم:
- **مدیر ارشد سیستم (Admin):**  
  نام کاربری: `admin` | کلمه عبور: `admin123`
- **کاربر تستی (محدود به تسک‌های منتظر):**  
  نام کاربری: `waiting_user` | کلمه عبور: `123456`

---

## 3. مستندات کامل بخش تنظیمات و پایش جیرا (`/jira-settings`)

این بخش مهم‌ترین مرکز کنترل سامانه است که به شما امکان متصل کردن هر نوع جیرایی (Cloud / Server / Data Center) را بدون نیاز به تغییر کد می‌دهد.

### ⚙️ اولویت تنظیمات:
تنظیمات سیستم در فایل **`backend/.env`** نگهداری می‌شوند. هر تغییری که در پنل وب ثبت و ذخیره کنید، **مستقیماً داخل فایل `.env` بک‌اند نوشته می‌شود.**

---

### 🌐 ۱. اتصال به Jira (Connection Settings)

| نام فیلد در UI | کلید در فایل `.env` | توضیحات و نحوه دریافت |
|-----------------|---------------------|----------------------|
| **آدرس پایه Jira** | `JIRA_BASE_URL` | آدرس دامنه جیرای شما. مثال Cloud: `https://company.atlassian.net` — مثال Server: `https://jira.company.com` |
| **نام کاربری / ایمیل** | `JIRA_USERNAME` | ایمیل حساب Atlassian در نسخه Cloud (مثال: `user@company.com`) یا نام کاربری لاگین در نسخه Server. |
| **API Token / کلمه عبور** | `JIRA_TOKEN` | در Jira Cloud: توکن API تولید شده از مسیر `id.atlassian.com/manage-profile/security/api-tokens`. در Jira Server: کلمه عبور یا Personal Access Token. |
| **کلید پروژه اصلی** | `JIRA_PROJECT_KEY` | شناسه ۳ یا ۴ حرفی پروژه اصلی در جیرا (مثال: `ORD` یا `OPS`). |
| **فاصله سینک (دقیقه)** | `SYNC_INTERVAL_MINUTES` | بازه زمان‌بندی همگام‌سازی خودکار بک‌اند در پس‌زمینه (پیش‌فرض: `60` دقیقه). |

---

### 🖥️ ۲. نسخه و مسیرهای API جیرا (API Version & Endpoints)

| نام فیلد در UI | کلید در فایل `.env` | مقادیر معتبر | توضیحات |
|-----------------|---------------------|--------------|----------|
| **نوع و نسخه Jira API** | `JIRA_API_VERSION` | `auto` , `v3` , `v2` | در حالت `auto` سیستم ابتدا نسخه REST API v3 جیرای کلاد را تست کرده و در صورت دریافت error 404 خودکار سوئیچ به API v2 جیرای سرور می‌کند. |
| **Endpoint جستجو** | `JIRA_SEARCH_ENDPOINT` | `/rest/api/3/search/jql` | مسیر متد اجرای پرس‌وجوهای JQL در جیرا. |
| **Endpoint پروژه** | `JIRA_PROJECT_ENDPOINT` | `/rest/api/3/project` | مسیر متد دریافت مشخصات پروژه در جیرا. |

---

### 💾 ۳. تنظیمات سرور و دیتابیس (Server & DB Management)

- **پورت سرور (`PORT`):** پورت سرویس بک‌اند (پیش‌فرض: `3001`).
- **کلید امنیتی (`JWT_SECRET`):** عبارت رمزی جهت امضای توکن‌های نشست کاربران.
- **وضعیت دیتابیس:** نمایش وضعیت فایل `database.sqlite`.
- **دکمه `🔄 همگام‌سازی و بازسازی دیتابیس از Jira Cloud`:**  
  با زدن این دکمه، دیتابیس محلی پاکسازی شده و تمام پروژه‌ها و تسک‌ها زنده و ۱۰۰٪ بر اساس داده‌های موجود در Jira Cloud بازسازی می‌شوند.

---

### 📚 ۴. اتصال به Confluence (Confluence Settings)

| نام فیلد در UI | کلید در فایل `.env` | توضیحات |
|-----------------|---------------------|----------|
| **آدرس Base Confluence** | `CONFLUENCE_BASE_URL` | آدرس پایگاه مستندات سازمان (مثال: `https://company.atlassian.net/wiki`). |
| **ایمیل / نام کاربری** | `CONFLUENCE_USERNAME` | ایمیل حساب دسترسی به کانفلوئنس. |
| **کلید پیش‌فرض Space** | `CONFLUENCE_DEFAULT_SPACE` | کلید فضای کاری مستندات در کانفلوئنس (مثال: `OPS` یا `TECH`). |

---

### ⏳ ۵. وضعیت‌های منتظر (Waiting Status List)

وضعیت‌هایی از تسک در جیرا که نشان‌دهنده معطل ماندن کار روی سایر تیم‌ها هستند.
- **کلید `.env`:** `JIRA_WAITING_STATUSES`
- **مقادیر پیش‌فرض:** `OnHolding, Waiting, Blocked, On Hold`
- **نحوه ورود در UI:** وارد کردن عنوان وضعیت و فشردن دکمه Enter جهت تبدیل به تگ.

---

### 🟢 ۶. نگاشت وضعیت‌های جیرا به داشبورد (Status Mapping)

در جدول **Status Mapping**، تمام وضعیت‌های اولیه در جیرا به وضعیت‌های استاندارد یا سفارشی داشبورد تبدیل می‌شوند:

```
[نام وضعیت در Jira] ───► [نام وضعیت در داشبورد]
   'Closed'          ───►    'Done' (انجام شده)
   'In Development'  ───►    'In Progress' (در حال انجام)
   'Hold by Infra'   ───►    'Waiting' (در انتظار)
   'Code Review'     ───►    'In Review' (وضعیت سفارشی جدید)
```

> ✏️ **ایجاد وضعیت سفارشی جدید:** در انتهای جدول می‌توانید گزینه `✏️ + ایجاد وضعیت سفارشی جدید...` را انتخاب کنید و نام دلخواهی مانند `در حال تست` یا `در حال بررسی` تایپ کنید.

---

### 🏷️ ۷. فیلدهای کاستوم جیرا (Custom Fields Mapping)

جیرا برای فیلدهای اختصاصی شناسه `customfield_XXXXX` تولید می‌کند.

#### 🔍 نحوه پیدا کردن شناسه‌های کاستوم‌فیلد:
۱. روی دکمه **`🔍 پایش زنده API`** در بالای همین صفحه کلیک کنید.
۲. در انتهای گزارش، لیست تمام `customfield_XXXXX`های فعال رو تسک‌های جیرایتان نمایش داده می‌شود.

| نام فیلد | کلید در فایل `.env` | نحوه مقداردهی |
|----------|---------------------|----------------|
| **فیلد Sprint** | `JIRA_SPRINT_FIELD` | شناسه فیلد اسپرینت در جیرا (پیش‌فرض: `customfield_10020`). |
| **فیلد تیم منتظر** | `JIRA_WAITING_TEAM_FIELD` | شناسه فیلد کاستوم تیم معطل‌کننده (مثال: `customfield_10035`). |
| **فیلد دلیل انتظار** | `JIRA_WAITING_REASON_FIELD` | شناسه فیلد کاستوم علت انتظار (مثال: `customfield_10036`). |
| **فیلد لینک Confluence** | `JIRA_CONFLUENCE_LINK_FIELD` | شناسه فیلد لینک مستقیم مستندات (مثال: `customfield_10040`). |

---

### 📅 ۸. نگاشت فیلدهای تاریخ (Date Mapping)

- `JIRA_EPIC_START_DATE_FIELD`: فیلد تاریخ شروع اپیک (پیش‌فرض: `created`).
- `JIRA_EPIC_DUE_DATE_FIELD`: فیلد تاریخ سررسید اپیک (پیش‌فرض: `duedate`).
- `JIRA_TASK_START_DATE_FIELD`: فیلد تاریخ شروع تسک.
- `JIRA_TASK_DUE_DATE_FIELD`: فیلد تاریخ سررسید تسک (پیش‌فرض: `duedate`).

---

### 🏷️ ۹. پیشوند برچسب‌ها (Label Prefixes)

اگر از برچسب‌های تسک در جیرا استفاده می‌کنید، سیستم پیشوندهای زیر را می‌شناسد:
- `JIRA_WAIT_TEAM_PREFIX`: پیشوند تیم منتظر (پیش‌فرض: `wait:` ➔ برچسب: `wait:infra-team`).
- `JIRA_WAIT_REASON_PREFIX`: پیشوند دلیل انتظار (پیش‌فرض: `reason:` ➔ برچسب: `reason:approval`).
- `JIRA_CAPABILITY_PREFIX`: پیشوند قابلیت عملیاتی (پیش‌فرض: `cap:` ➔ برچسب: `cap:monitoring`).

---

## 4. راهنمای کاربری و معرفی بخش‌های مختلف داشبورد

### 🌐 ۱. داشبورد اصلی (`/`)
- **کارت پروژه‌ها (Equal-Height Grid):** پروژه‌ها با کارت‌های هم‌اندازه، درصد پیشرفت، فیلتر تب‌های وضعیت (`همه پروژه‌ها` | `در حال اجرا` | `انجام‌شده`) نمایش داده می‌شوند.
- **میانگین پیشرفت کل:** محاسبه میانگین ریاضی پیشرفت کل پروژه‌ها. با کلیک روی آن وارد صفحه تایم‌لاین پیشرفت کل می‌شوید.
- **فیلتر کامپوننت‌ها:** دکمه‌های فیلتر سریع بر اساس فعالیت‌های مختلف توسعه.

### 📋 ۲. صفحه جزئیات پروژه (`/project/:id`)
- **بج‌های قابلیت‌ها:** نمایش قابلیت‌های عملیاتی پروژه با لینک به Confluence.
- **تفکیک پویا کامپوننت‌ها (Component Breakdown):** محاسبه درصد و ساعات مصرفی تمام کامپوننت‌ها با سقف ارتفاع ثابت ۱۷۰ پیکسل و اسکرول داخلی.
- **گانت چارت چابک (Gantt Chart):** زمان‌بندی تسک‌ها با خط امروز (Today line)، لینک‌های مستقیم قابل کلیک به Jira Cloud (`ORD-X`) و راهنمای Hover.
- **بخش اسپرینت‌ها (Sprint Section):**
  - **آمار تسک‌های مانده:** نمایش تعداد دقیق تسک‌های باقی‌مانده و انجام‌نشده در اسپرینت جاری (`⚡ ۴ تسک مانده`).
  - **تفکیک بار کاری اعضا:** کارت‌های کوچک شامل نام هر عضو تیم و تعداد تسک‌های مانده‌اش با **فیلتر کلیکی روی اعضا**.

### 📈 ۳. تایم‌لاین پیشرفت کل (`/overall-timeline`)
- نمودار سرعت توسعه (Velocity Curve) چند پروژه‌ای و جدول مقایسه‌ای پیشرفت و بازه زمانی پروژه‌ها.

### ⏳ ۴. تسک‌های منتظر (`/waiting-tasks`)
- لیست تمام تسک‌هایی که معطل تیم‌های دیگر هستند به تفکیک تیم منتظر و دلیل انتظار.

### 👥 ۵. مدیریت کاربران و دسترسی‌ها (`/user-management`)
- تعریف کاربر جدید، تغییر کلمه عبور، تعیین نقش (`admin` / `viewer`) و **تخصیص دسترسی‌های تفکیک‌شده منوهای سمت راست**.

---

## 5. پیکربندی کامل فایل `.env`

```env
# Server Config
PORT=3001
JWT_SECRET=ops-rd-secret-key-2026
SYNC_INTERVAL_MINUTES=60

# Jira Connection
JIRA_BASE_URL=https://aliamani6.atlassian.net
JIRA_USERNAME=aliamani66@gmail.com
JIRA_TOKEN=ATATT3xFfGF0RH_iF1oxCBw-0VCd_RE0eElRQk5sieUcx8zIFtFcgnQ7NE6IKC7vLIaDlQzxXHaq_HhDkdP4wShzcSG3VDx7PyRQiJihux0DA81SHnqgjY1naYlIUkXx3flrJirX0OtITzNty4oQAJ_aCeTWjAu3JC8OPcnYtNhkzQzdG4-xNgg=4444DE56
JIRA_PROJECT_KEY=ORD

# API Endpoints
JIRA_API_VERSION=auto
JIRA_SEARCH_ENDPOINT=/rest/api/3/search/jql
JIRA_PROJECT_ENDPOINT=/rest/api/3/project

# Statuses & Labels
JIRA_WAITING_STATUSES=OnHolding,Waiting,Blocked,On Hold
JIRA_WAIT_TEAM_PREFIX=wait:
JIRA_WAIT_REASON_PREFIX=reason:
JIRA_CAPABILITY_PREFIX=cap:

# Custom Fields
JIRA_SPRINT_FIELD=customfield_10020
JIRA_WAITING_TEAM_FIELD=customfield_10035
JIRA_WAITING_REASON_FIELD=customfield_10036
JIRA_CONFLUENCE_LINK_FIELD=customfield_10040

# Confluence Connection
CONFLUENCE_BASE_URL=https://aliamani6.atlassian.net/wiki
CONFLUENCE_USERNAME=aliamani66@gmail.com
CONFLUENCE_TOKEN=ATATT3xFfGF0RH_iF1oxCBw-0VCd_RE0eElRQk5sieUcx8zIFtFcgnQ7NE6IKC7vLIaDlQzxXHaq_HhDkdP4wShzcSG3VDx7PyRQiJihux0DA81SHnqgjY1naYlIUkXx3flrJirX0OtITzNty4oQAJ_aCeTWjAu3JC8OPcnYtNhkzQzdG4-xNgg=4444DE56
CONFLUENCE_DEFAULT_SPACE=OPS
```
