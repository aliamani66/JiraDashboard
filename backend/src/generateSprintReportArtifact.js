const fs = require('fs');
const path = require('path');
const { initDb, getDb } = require('./db/database');

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

  // Capability mapping per component/task type
  const capabilityMap = {
    'dev': 'توسعه نرم‌افزار و قابلیت‌های جدید سرویس',
    'infrastructure': 'ارتقاء زیرساخت و پایداری کلاستر کوبرنتیز',
    'security': 'تست‌های امنیتی SAST/Trivy و مدیریت اسرار Vault',
    'monitoring': 'مانیتورینگ آنی Prometheus/Grafana و هشدارهای پیشگیرانه',
    'ai': 'مدل‌های هوش مصنوعی و پردازش داده‌ها',
    'database': 'پایداری دیتابیس PostgreSQL HA و ذخیره‌ساز Ceph',
    'testing': 'ارزیابی کیفیت و تست‌های نفوذپذیری',
    'support': 'پشتیبانی عملیاتی و نگهداری سرویس‌ها',
    'meeting': 'هماهنگی‌های فصلی و نقشه راه محصول'
  };

  // Generate Markdown Artifact Content
  let mdContent = `# 🚀 گزارش جامع دستاوردها و خروجی اسپرینت‌های تیم عملیات R&D

> **تاریخ گزارش:** ۲۰ مرداد ۱۴۰۵  
> **مرجع سیستم:** سامانه داشبورد ویترین عملیات و کنترل پایداری R&D  
> **هدف:** بررسی تفکیکی دستاوردهای عملیاتی، قابلیت‌های افزوده‌شده به سیستم و درصد پیشرفت اسپرینت‌ها

---

## 📊 خلاصه مدیریتی و وضعیت کلی اسپرینت‌ها

| عنوان اسپرینت | کل تسک‌ها | ✅ انجام‌شده | ⚡ در حال انجام | ⏳ منتظر / آن‌هولد | 📋 برای انجام | کارکرد / تخمین (ساعت) | درصد پیشرفت |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
`;

  let totalAllTasks = 0;
  let totalAllDone = 0;
  let totalAllSpent = 0;
  let totalAllEst = 0;

  const sortedSprintKeys = Object.keys(sprintsMap).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

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

    totalAllTasks += total;
    totalAllDone += done;
    totalAllSpent += spent;
    totalAllEst += est;

    mdContent += `| **${sKey}** | ${total} | **${done}** | ${active} | ${waiting} | ${todo} | ${spent}h / ${est}h | **%${prog}** |\n`;
  }

  const overallProg = totalAllEst > 0 ? Math.round((totalAllSpent / totalAllEst) * 100) : 0;
  mdContent += `| **مجموع کل** | **${totalAllTasks}** | **${totalAllDone}** | -- | -- | -- | **${totalAllSpent}h / ${totalAllEst}h** | **%${overallProg}** |\n\n`;

  mdContent += `---

## 🛠️ تفکیک خروجی‌ها و قابلیت‌های اضافه شده به عملیات در هر اسپرینت

`;

  for (const sKey of sortedSprintKeys) {
    const sTasks = sprintsMap[sKey];
    const sDoneTasks = sTasks.filter(t => t.status === 'Done' || t.status === 'done');
    const sOtherTasks = sTasks.filter(t => !(t.status === 'Done' || t.status === 'done'));

    mdContent += `### 🎯 خروجی‌های **${sKey}**\n\n`;

    if (sDoneTasks.length > 0) {
      mdContent += `#### ✅ دستاوردها و قابلیت‌های تکمیل‌شده (Completed Deliverables):\n\n`;
      mdContent += `| کد تسک | عنوان تسک و قابلیت افزوده شده | پروژه مربوطه | مسئول | کارکرد | درصد پیشرفت | قابلیت ایجاد شده در عملیات |\n`;
      mdContent += `| :--- | :--- | :--- | :--- | :---: | :---: | :--- |\n`;

      for (const t of sDoneTasks) {
        const est = t.estimate_hours || 0;
        const spent = t.spent_hours || 0;
        const timeProg = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : 100;
        const capLabel = capabilityMap[t.component] || t.project_capabilities || 'توسعه پایداری سیستم';

        mdContent += `| \`${t.id}\` | **${t.title}** | ${t.project_id}: ${t.project_title} | 👤 ${t.assignee || 'تیم عملیات'} | ${spent}h / ${est}h | **%${timeProg}** | ✨ ${capLabel} |\n`;
      }
      mdContent += `\n`;
    }

    if (sOtherTasks.length > 0) {
      mdContent += `#### ⚡ تسک‌های در حال اجرا و برنامه‌ریزی‌شده در ${sKey}:\n\n`;
      mdContent += `| کد تسک | عنوان تسک | وضعیت فعلی | مسئول | کارکرد / تخمین | درصد پیشرفت |\n`;
      mdContent += `| :--- | :--- | :--- | :--- | :---: | :---: |\n`;

      for (const t of sOtherTasks) {
        const est = t.estimate_hours || 0;
        const spent = t.spent_hours || 0;
        const timeProg = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : 0;
        const stBadge = t.is_waiting ? `⏳ منتظر (${t.waiting_for_team || 'خارجی'})` : (t.status === 'In Progress' ? '⚡ در حال انجام' : '📋 برای انجام');

        mdContent += `| \`${t.id}\` | ${t.title} | ${stBadge} | 👤 ${t.assignee || 'تیم عملیات'} | ${spent}h / ${est}h | %${timeProg} |\n`;
      }
      mdContent += `\n`;
    }

    mdContent += `---\n\n`;
  }

  // Write artifact markdown file
  const artifactDir = path.join('C:', 'Users', 'USER', '.gemini', 'antigravity', 'brain', 'e1b06dcf-1ee8-4b82-9cd1-c638ecc67cdb');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const mdFilePath = path.join(artifactDir, 'sprint_deliverables_report.md');
  fs.writeFileSync(mdFilePath, mdContent, 'utf-8');
  console.log(`✅ Artifact Markdown Report created successfully at: ${mdFilePath}`);
}

generateReport().catch(console.error);
