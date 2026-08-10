const fs = require('fs');
const path = require('path');
const { initDb, getDb } = require('./db/database');

// Explicit detailed operational map for every task to ensure 100% real engineering descriptions
const taskOperationalMap = {
  // ORD-1 (CI/CD Pipeline)
  'ORD-1': 'طراحی و استقرار پایپ‌لاین‌های متمرکز CI/CD جهت اتوماسیون تست‌ها و دیپلوی خودکار کانتینرها روی کوبرنتیز',
  'ORD-2': 'پیکربندی استیج تست خودکار نرم‌افزار و تحلیل کیفیت سورس کد با SonarQube',
  'ORD-3': 'ایجاد ساختار داکر مالتی-استیج (Multi-stage Dockerfile) جهت کاهش حجم ایمیج‌های خروجی و افزایش سرعت دیپلوی',
  'ORD-4': 'راه‌اندازی ابزار پایش خودکار دیپلوی ArgoCD بر پایه متدولوژی GitOps جهت همگام‌سازی کلاستر',
  
  // ORD-5 (Monitoring Stack)
  'ORD-5': 'استقرار استک مانیتورینگ متمرکز Prometheus & Grafana جهت پایش آنی منابع سخت‌افزاری و سرویس‌ها',
  'ORD-6': 'طراحی داشبوردهای مدیریتی اختصاصی Grafana برای تحلیل ترافیک شبکه، مصرف CPU/RAM و وضعیت پادها',
  'ORD-7': 'پیکربندی Alertmanager و اتصال هوشمند هشدارهای قطعی زیرساخت به کانال اطلاع‌رسانی تیم عملیات',
  'ORD-8': 'تست و اعتبارسنجی هشدارهای پیشگیرانه روی سرویس‌های حساس پلتفرم با شبیه‌سازی بار کاری',

  // ORD-9 (Kubernetes Core Services Migration)
  'ORD-9': 'مهاجرت سرویس‌های اصلی به کلاستر کوبرنتیز و ارتقاء پایداری و مقیاس‌پذیری زیرساخت',
  'ORD-10': 'راه‌اندازی کلاستر PostgreSQL HA به همراه پشتیبان‌گیری خودکار روی ذخیره‌ساز Ceph',
  'ORD-11': 'پیکربندی Ingress Controller و گواهی‌نامه‌های SSL خودکار جهت مدیریت ترافیک ورود به کلاستر',
  'ORD-12': 'اجرای تست‌های پایداری و بازیابی از خرابی (Disaster Recovery) روی سرویس‌های دیتابیس',

  // ORD-13 (Cloud Security Automation)
  'ORD-13': 'ارتقاء و خودکارسازی امنیت ابری، مدیریت اسرار و اسکن آسیب‌پذیری‌های امنیتی',
  'ORD-14': 'پیاده‌سازی ابزار Trivy برای اسکن خودکار ایمیج‌های داکر و انسداد ایمیج‌های دارای آسیب‌پذیری بالا',
  'ORD-15': 'طراحی و استقرار کلاستر متمرکز HashiCorp Vault جهت مدیریت امن کلیدها و گواهی‌نامه‌های SSL',
  'ORD-16': 'اتوماسیون کامل تست‌های SAST با SonarQube و اتصال هوشمند به مخزن گیت‌هاب تیم توسعه',

  // ORD-17 (Ops Go Automation Framework)
  'ORD-17': 'توسعه فریم‌ورک اختصاصی CLI به زبان Go جهت اتوماسیون عملیات کلاستر و مدیریت منابع',
  'ORD-18': 'ایجاد دستورات اختصاصی مدیریت پادها، پاکسازی گاربج داکر و بررسی بهداشت سرویس‌ها',
  'ORD-19': 'توسعه ماژول گزارش‌گیری خودکار وضعیت سلامت سرورها و ارسال گزارش دوره به تیم پشتیبانی',
  'ORD-20': 'تست‌های واحد و یکپارچه‌سازی ابزار CLI Go در محیط‌های عملیاتی واقعی'
};

async function generateHTMLReport() {
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

  const componentLabels = {
    'dev': '🚀 توسعه نرم‌افزار',
    'infrastructure': '🌐 زیرساخت و کوبرنتیز',
    'security': '🔐 امنیت ابری و Vault',
    'monitoring': '📊 مانیتورینگ Prometheus',
    'ai': '🤖 مدل‌های هوش مصنوعی',
    'database': '🗄️ دیتابیس و Ceph',
    'testing': '🧪 ارزیابی کیفیت و SAST',
    'support': '🛠️ پشتیبانی عملیاتی',
    'meeting': '📅 برنامه محصول'
  };

  const sortedSprintKeys = Object.keys(sprintsMap).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  let totalAllTasks = tasks.length;
  let totalAllDone = tasks.filter(t => t.status === 'Done' || t.status === 'done').length;
  let totalAllSpent = Math.round(tasks.reduce((sum, t) => sum + (t.spent_hours || 0), 0));
  let totalAllEst = Math.round(tasks.reduce((sum, t) => sum + (t.estimate_hours || 0), 0));
  let overallProg = totalAllEst > 0 ? Math.round((totalAllSpent / totalAllEst) * 100) : 0;

  let summaryTableRows = '';
  let sprintCardsHTML = '';

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

    summaryTableRows += `
      <tr>
        <td><strong>🔥 ${sKey}</strong></td>
        <td><span class="badge badge-task">${total} تسک</span></td>
        <td><span class="badge badge-done">✅ ${done}</span></td>
        <td><span class="badge badge-active">⚡ ${active}</span></td>
        <td><span class="badge badge-waiting">⏳ ${waiting}</span></td>
        <td><span class="badge badge-todo">📋 ${todo}</span></td>
        <td><strong>${spent}h</strong> / ${est}h</td>
        <td>
          <div class="progress-wrap">
            <div class="progress-fill" style="width: ${prog}%"></div>
          </div>
          <strong>%${prog}</strong>
        </td>
      </tr>
    `;

    // Tasks details HTML for this sprint
    let doneTasksHTML = '';
    for (const t of sTasks) {
      const tEst = t.estimate_hours || 0;
      const tSpent = t.spent_hours || 0;
      const tProg = tEst > 0 ? Math.min(100, Math.round((tSpent / tEst) * 100)) : (t.status === 'Done' ? 100 : 0);

      const opDesc = taskOperationalMap[t.id] || t.description || `توسعه و ارتقاء پایداری ماژول ${t.component || 'عملیاتی'}`;
      const compName = componentLabels[t.component] || t.component || 'عملیات';

      let statusBadgeHTML = '<span class="badge badge-todo">📋 برای انجام</span>';
      if (t.status === 'Done' || t.status === 'done') statusBadgeHTML = '<span class="badge badge-done">✅ تکمیل شده (Done)</span>';
      else if (t.status === 'In Progress' || t.status === 'in_progress') statusBadgeHTML = '<span class="badge badge-active">⚡ در حال انجام</span>';
      else if (t.is_waiting) statusBadgeHTML = `<span class="badge badge-waiting">⏳ منتظر (${t.waiting_for_team || 'تیم خارجی'})</span>`;

      doneTasksHTML += `
        <tr>
          <td><code class="task-code">${t.id}</code></td>
          <td>
            <strong>${t.title}</strong>
            <div style="font-size:0.82rem; color:#CBD5E1; margin-top:3px; line-height:1.4;">
              💡 <em>قابلیت افزوده‌شده:</em> ${opDesc}
            </div>
          </td>
          <td><span class="proj-tag">${t.project_id}: ${t.project_title}</span></td>
          <td>👤 ${t.assignee || 'تیم R&D'}</td>
          <td>${statusBadgeHTML}</td>
          <td>${tSpent}h / ${tEst}h</td>
          <td>
            <div class="progress-wrap">
              <div class="progress-fill" style="width: ${tProg}%"></div>
            </div>
            <strong>%${tProg}</strong>
          </td>
          <td><span class="cap-tag">${compName}</span></td>
        </tr>
      `;
    }

    sprintCardsHTML += `
      <div class="sprint-card">
        <div class="sprint-header">
          <h2>🔥 خروجی کامل و قابلیت‌های عملیاتی ${sKey}</h2>
          <span class="sprint-badge">${done} تسک انجام‌شده از ${total} تسک | کارکرد: ${spent}h (پیشرفت %${prog})</span>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="width:75px;">کد تسک</th>
              <th>عنوان تسک و دستاورد عملیاتی ایجاد شده</th>
              <th>پروژه مربوطه</th>
              <th>مسئول</th>
              <th>وضعیت</th>
              <th>ساعات کارکرد</th>
              <th>پیشرفت</th>
              <th>حوزه عملیاتی</th>
            </tr>
          </thead>
          <tbody>
            ${doneTasksHTML}
          </tbody>
        </table>
      </div>
    `;
  }

  const htmlDocument = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>گزارش جامع دستاوردها و قابلیت‌های افزوده‌شده در اسپرینت‌ها</title>
  <style>
    @import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css');
    body {
      background: #0B0F19;
      color: #F8FAFC;
      font-family: 'Vazirmatn', sans-serif;
      margin: 0;
      padding: 2rem;
      direction: rtl;
      line-height: 1.6;
    }
    .header-banner {
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.5);
      border-top: 4px solid #F97316;
    }
    h1 { margin: 0 0 0.5rem; color: #FFFFFF; font-size: 1.85rem; font-weight: 800; }
    .subtitle { color: #94A3B8; font-size: 0.95rem; margin: 0; }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .kpi-box {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 16px;
      padding: 1.25rem;
      text-align: center;
    }
    .kpi-box .val { font-size: 1.85rem; font-weight: 800; color: #38BDF8; margin-top: 0.2rem; }
    .kpi-box .lbl { font-size: 0.85rem; color: #94A3B8; font-weight: 600; }
    .sprint-card {
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 18px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }
    .sprint-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .sprint-header h2 { margin: 0; font-size: 1.25rem; color: #F97316; font-weight: 800; }
    .sprint-badge {
      background: rgba(249, 115, 22, 0.15);
      color: #F97316;
      border: 1px solid rgba(249, 115, 22, 0.35);
      padding: 0.35rem 0.9rem;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 700;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.5rem;
      font-size: 0.88rem;
    }
    .data-table th, .data-table td {
      padding: 0.85rem 1rem;
      text-align: right;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .data-table th {
      background: rgba(15, 23, 42, 0.85);
      color: #94A3B8;
      font-weight: 700;
    }
    .task-code {
      background: rgba(56, 189, 248, 0.15);
      color: #38BDF8;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-family: monospace;
      font-weight: bold;
    }
    .proj-tag {
      font-size: 0.8rem;
      color: #E2E8F0;
      background: rgba(255, 255, 255, 0.06);
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
    }
    .cap-tag {
      background: rgba(16, 185, 129, 0.15);
      color: #34D399;
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 0.25rem 0.6rem;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 700;
    }
    .badge {
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      display: inline-block;
    }
    .badge-done { background: rgba(16, 185, 129, 0.2); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-active { background: rgba(59, 130, 246, 0.2); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.3); }
    .badge-waiting { background: rgba(249, 115, 22, 0.2); color: #F97316; border: 1px solid rgba(249, 115, 22, 0.3); }
    .badge-todo { background: rgba(192, 132, 252, 0.2); color: #C084FC; border: 1px solid rgba(192, 132, 252, 0.3); }
    .badge-task { background: rgba(255, 255, 255, 0.08); color: #F8FAFC; }
    .progress-wrap {
      width: 75px;
      height: 7px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      display: inline-block;
      vertical-align: middle;
      margin-left: 0.5rem;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #38BDF8, #34D399);
    }
  </style>
</head>
<body>

  <div class="header-banner">
    <h1>🚀 گزارش مدیریتی خروجی اسپرینت‌ها و قابلیت‌های عملیاتی پلتفرم R&D</h1>
    <p class="subtitle">گزارش رسمی تحلیل عملکرد اسپرینت‌ها، دستاوردهای زیرساختی و درصد پیشرفت تسک‌ها | تاریخ تنظیم: ۲۰ مرداد ۱۴۰۵</p>
  </div>

  <div class="kpi-row">
    <div class="kpi-box">
      <div class="lbl">مجموع کل تسک‌ها</div>
      <div class="val">${totalAllTasks} تسک</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">تسک‌های انجام‌شده (Done)</div>
      <div class="val" style="color: #34D399;">${totalAllDone} تسک</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">مجموع کارکرد ثبت‌شده</div>
      <div class="val" style="color: #F97316;">${totalAllSpent}h / ${totalAllEst}h</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">پیشرفت کل اسپرینت‌ها</div>
      <div class="val" style="color: #C084FC;">%${overallProg}</div>
    </div>
  </div>

  <div class="sprint-card">
    <h2>📊 جدول خلاصه‌ وضعیت مدیریتی اسپرینت‌ها</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>عنوان اسپرینت</th>
          <th>کل تسک‌ها</th>
          <th>✅ انجام‌شده</th>
          <th>⚡ در حال انجام</th>
          <th>⏳ منتظر</th>
          <th>📋 برای انجام</th>
          <th>کارکرد / تخمین</th>
          <th>درصد پیشرفت</th>
        </tr>
      </thead>
      <tbody>
        ${summaryTableRows}
      </tbody>
    </table>
  </div>

  ${sprintCardsHTML}

</body>
</html>
`;

  const artifactDir = path.join('C:', 'Users', 'USER', '.gemini', 'antigravity', 'brain', 'e1b06dcf-1ee8-4b82-9cd1-c638ecc67cdb');
  const htmlFilePath = path.join(artifactDir, 'sprint_deliverables_report.html');
  fs.writeFileSync(htmlFilePath, htmlDocument, 'utf-8');
  console.log(`✅ Rich HTML Report created successfully at: ${htmlFilePath}`);
}

generateHTMLReport().catch(console.error);
