const fs = require('fs');
const path = require('path');
const { initDb, getDb } = require('./db/database');

const taskOperationalMap = {
  'ORD-1': 'طراحی و استقرار پایپ‌لاین‌های متمرکز CI/CD جهت اتوماسیون تست‌ها و دیپلوی خودکار کانتینرها روی کوبرنتیز',
  'ORD-2': 'پیکربندی استیج تست خودکار نرم‌افزار و تحلیل کیفیت سورس کد با SonarQube',
  'ORD-3': 'ایجاد ساختار داکر مالتی-استیج جهت کاهش حجم ایمیج‌های خروجی و افزایش سرعت دیپلوی',
  'ORD-4': 'راه‌اندازی ابزار پایش خودکار دیپلوی ArgoCD بر پایه متدولوژی GitOps جهت همگام‌سازی کلاستر',
  'ORD-5': 'استقرار استک مانیتورینگ متمرکز Prometheus & Grafana جهت پایش آنی منابع سخت‌افزاری و سرویس‌ها',
  'ORD-6': 'طراحی داشبوردهای مدیریتی اختصاصی Grafana برای تحلیل ترافیک شبکه، مصرف CPU/RAM و وضعیت پادها',
  'ORD-7': 'پیکربندی Alertmanager و اتصال هوشمند هشدارهای قطعی زیرساخت به کانال اطلاع‌رسانی تیم عملیات',
  'ORD-8': 'تست و اعتبارسنجی هشدارهای پیشگیرانه روی سرویس‌های حساس پلتفرم با شبیه‌سازی بار کاری',
  'ORD-9': 'مهاجرت سرویس‌های اصلی به کلاستر کوبرنتیز و ارتقاء پایداری و مقیاس‌پذیری زیرساخت',
  'ORD-10': 'راه‌اندازی کلاستر PostgreSQL HA به همراه پشتیبان‌گیری خودکار روی ذخیره‌ساز Ceph',
  'ORD-11': 'پیکربندی Ingress Controller و گواهی‌نامه‌های SSL خودکار جهت مدیریت ترافیک ورود به کلاستر',
  'ORD-12': 'اجرای تست‌های پایداری و بازیابی از خرابی (Disaster Recovery) روی سرویس‌های دیتابیس',
  'ORD-13': 'ارتقاء و خودکارسازی امنیت ابری، مدیریت اسرار و اسکن آسیب‌پذیری‌های امنیتی',
  'ORD-14': 'پیاده‌سازی ابزار Trivy برای اسکن خودکار ایمیج‌های داکر و انسداد ایمیج‌های دارای آسیب‌پذیری بالا',
  'ORD-15': 'طراحی و استقرار کلاستر متمرکز HashiCorp Vault جهت مدیریت امن کلیدها و گواهی‌نامه‌های SSL',
  'ORD-16': 'اتوماسیون کامل تست‌های SAST با SonarQube و اتصال هوشمند به مخزن گیت‌هاب تیم توسعه',
  'ORD-17': 'توسعه فریم‌ورک اختصاصی CLI به زبان Go جهت اتوماسیون عملیات کلاستر و مدیریت منابع',
  'ORD-18': 'ایجاد دستورات اختصاصی مدیریت پادها، پاکسازی گاربج داکر و بررسی بهداشت سرویس‌ها',
  'ORD-19': 'توسعه ماژول گزارش‌گیری خودکار وضعیت سلامت سرورها و ارسال گزارش دوره به تیم پشتیبانی',
  'ORD-20': 'تست‌های واحد و یکپارچه‌سازی ابزار CLI Go در محیط‌های عملیاتی واقعی'
};

async function generateReport() {
  await initDb();
  const db = getDb();

  const tasks = db.prepare(`
    SELECT t.*, p.title as project_title, p.capabilities as project_capabilities, p.category as project_category
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    ORDER BY t.sprint_name ASC, t.project_id ASC, t.id ASC
  `).all();

  const sprintsMap = {};
  for (const t of tasks) {
    const sName = t.sprint_name || 'Sprint 10';
    if (!sprintsMap[sName]) sprintsMap[sName] = [];
    sprintsMap[sName].push(t);
  }

  const sortedSprintKeys = Object.keys(sprintsMap).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  let mdContent = `# 🚀 گزارش مدیریتی دستاوردها و خروجی اسپرینت‌های تیم عملیات R&D

> **تاریخ تنظیم:** ۲۰ مرداد ۱۴۰۵  
> **مرجع اصلی:** سامانه داشبورد ویترین عملیات و کنترل پایداری پلتفرم R&D  
> **هدف:** ارائه گزارش رسمی از قابلیت‌های افزوده‌شده به سیستم، وضعیت تسک‌ها، کارکرد و درصد پیشرفت اسپرینت‌ها

---

## 📊 خلاصه مدیریتی و وضعیت کلی اسپرینت‌ها

| عنوان اسپرینت | کل تسک‌ها | ✅ انجام‌شده | ⚡ در حال انجام | ⏳ منتظر / آن‌هولد | 📋 برای انجام | کارکرد / تخمین (ساعت) | درصد پیشرفت |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
`;

  let totalAllTasks = tasks.length;
  let totalAllDone = tasks.filter(t => t.status === 'Done' || t.status === 'done').length;
  let totalAllSpent = Math.round(tasks.reduce((sum, t) => sum + (t.spent_hours || 0), 0));
  let totalAllEst = Math.round(tasks.reduce((sum, t) => sum + (t.estimate_hours || 0), 0));

  for (const sKey of sortedSprintKeys) {
    const sTasks = sprintsMap[sKey];
    const total = sTasks.length;
    const done = sTasks.filter(t => t.status === 'Done' || t.status === 'done').length;
    const active = sTasks.filter(t => t.status === 'In Progress' || t.status === 'in_progress').length;
    const waiting = sTasks.filter(t => t.is_waiting || t.status === 'Waiting' || t.status === 'OnHolding').length;
    const todo = total - (done + active + waiting);

    const spent = Math.round(sTasks.reduce((sum, t) => sum + (t.spent_hours || 0), 0));
    const est = Math.round(sTasks.reduce((sum, t) => sum + (t.estimate_hours || 0), 0));
    const prog = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : (total > 0 ? Math.round((done / total) * 100) : 0);

    mdContent += `| **${sKey}** | ${total} | **${done}** | ${active} | ${waiting} | ${todo} | ${spent}h / ${est}h | **%${prog}** |\n`;
  }

  const overallProg = totalAllEst > 0 ? Math.round((totalAllSpent / totalAllEst) * 100) : 0;
  mdContent += `| **مجموع کل** | **${totalAllTasks}** | **${totalAllDone}** | -- | -- | -- | **${totalAllSpent}h / ${totalAllEst}h** | **%${overallProg}** |\n\n`;

  mdContent += `---

## 🛠️ تفکیک خروجی‌های عملیاتی و دستاوردهای فنی اسپرینت‌ها

`;

  for (const sKey of sortedSprintKeys) {
    const sTasks = sprintsMap[sKey];
    const doneTasks = sTasks.filter(t => t.status === 'Done' || t.status === 'done');
    const otherTasks = sTasks.filter(t => !(t.status === 'Done' || t.status === 'done'));
    const sSpent = Math.round(sTasks.reduce((sum, t) => sum + (t.spent_hours || 0), 0));
    const sEst = Math.round(sTasks.reduce((sum, t) => sum + (t.estimate_hours || 0), 0));
    const sProg = sEst > 0 ? Math.min(100, Math.round((sSpent / sEst) * 100)) : 0;

    mdContent += `### 🎯 خروجی‌های **${sKey}** (کارکرد: ${sSpent}h از ${sEst}h - پیشرفت %${sProg})\n\n`;

    if (doneTasks.length > 0) {
      mdContent += `#### ✅ تسک‌های تکمیلی و قابلیت‌های عملیاتی ایجاد شده:\n\n`;
      mdContent += `| کد تسک | عنوان تسک | پروژه مربوطه | مسئول | کارکرد | پیشرفت | قابلیت و دستاورد عملیاتی اضافه شده به سیستم |\n`;
      mdContent += `| :--- | :--- | :--- | :--- | :---: | :---: | :--- |\n`;

      for (const t of doneTasks) {
        const est = t.estimate_hours || 0;
        const spent = t.spent_hours || 0;
        const timeProg = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : 100;
        const opDesc = taskOperationalMap[t.id] || t.description || `ارتقاء پایداری ماژول عملیاتی ${t.component || ''}`;

        mdContent += `| \`${t.id}\` | **${t.title}** | ${t.project_id}: ${t.project_title} | 👤 ${t.assignee || 'تیم R&D'} | ${spent}h / ${est}h | **%${timeProg}** | ✨ ${opDesc} |\n`;
      }
      mdContent += `\n`;
    }

    if (otherTasks.length > 0) {
      mdContent += `#### ⚡ تسک‌های در حال اجرا و منتظر در ${sKey}:\n\n`;
      mdContent += `| کد تسک | عنوان تسک | وضعیت | مسئول | کارکرد / تخمین | پیشرفت |\n`;
      mdContent += `| :--- | :--- | :--- | :--- | :---: | :---: |\n`;

      for (const t of otherTasks) {
        const est = t.estimate_hours || 0;
        const spent = t.spent_hours || 0;
        const timeProg = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : 0;
        const stBadge = t.is_waiting ? `⏳ منتظر (${t.waiting_for_team || 'تیم خارجی'})` : (t.status === 'In Progress' ? '⚡ در حال انجام' : '📋 برای انجام');

        mdContent += `| \`${t.id}\` | ${t.title} | ${stBadge} | 👤 ${t.assignee || 'تیم R&D'} | ${spent}h / ${est}h | %${timeProg} |\n`;
      }
      mdContent += `\n`;
    }

    mdContent += `---\n\n`;
  }

  const artifactDir = path.join('C:', 'Users', 'USER', '.gemini', 'antigravity', 'brain', 'e1b06dcf-1ee8-4b82-9cd1-c638ecc67cdb');
  const mdFilePath = path.join(artifactDir, 'sprint_deliverables_report.md');
  fs.writeFileSync(mdFilePath, mdContent, 'utf-8');
  console.log(`✅ Rich Markdown Report created successfully at: ${mdFilePath}`);
}

generateReport().catch(console.error);
