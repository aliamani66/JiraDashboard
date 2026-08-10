const fs = require('fs');
const path = require('path');
const { initDb, getDb } = require('./db/database');

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

  const capabilityMap = {
    'dev': '🚀 توسعه نرم‌افزار و قابلیت‌های جدید سرویس',
    'infrastructure': '🌐 ارتقاء زیرساخت و پایداری کلاستر کوبرنتیز',
    'security': '🔐 تست‌های امنیتی SAST/Trivy و مدیریت اسرار Vault',
    'monitoring': '📊 مانیتورینگ آنی Prometheus/Grafana و هشدارهای پیشگیرانه',
    'ai': '🤖 مدل‌های هوش مصنوعی و پردازش داده‌ها',
    'database': '🗄️ پایداری دیتابیس PostgreSQL HA و ذخیره‌ساز Ceph',
    'testing': '🧪 ارزیابی کیفیت و تست‌های نفوذپذیری',
    'support': '🛠️ پشتیبانی عملیاتی و نگهداری سرویس‌ها',
    'meeting': '📅 هماهنگی‌های فصلی و نقشه راه محصول'
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

  let htmlRows = '';
  let sprintSectionsHTML = '';

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

    htmlRows += `
      <tr>
        <td><strong>🔥 ${sKey}</strong></td>
        <td><span class="badge badge-task">${total} تسک</span></td>
        <td><span class="badge badge-done">✅ ${done}</span></td>
        <td><span class="badge badge-active">⚡ ${active}</span></td>
        <td><span class="badge badge-waiting">⏳ ${waiting}</span></td>
        <td><span class="badge badge-todo">📋 ${todo}</span></td>
        <td>${spent}h / ${est}h</td>
        <td>
          <div class="progress-wrap">
            <div class="progress-fill" style="width: ${prog}%"></div>
          </div>
          <strong>%${prog}</strong>
        </td>
      </tr>
    `;

    // Detailed Section for each Sprint
    let doneTasksHTML = '';
    const doneTasks = sTasks.filter(t => t.status === 'Done' || t.status === 'done');
    for (const t of doneTasks) {
      const tEst = t.estimate_hours || 0;
      const tSpent = t.spent_hours || 0;
      const tProg = tEst > 0 ? Math.min(100, Math.round((tSpent / tEst) * 100)) : 100;
      const capLabel = capabilityMap[t.component] || t.project_capabilities || 'افزایش پایداری عملیات';

      doneTasksHTML += `
        <tr>
          <td><code class="task-code">${t.id}</code></td>
          <td><strong>${t.title}</strong><br><small style="color:#94A3B8;">📝 ${t.description || ''}</small></td>
          <td>${t.project_id}: ${t.project_title}</td>
          <td>👤 ${t.assignee || 'تیم R&D'}</td>
          <td>${tSpent}h / ${tEst}h</td>
          <td><span class="badge badge-done">%${tProg}</span></td>
          <td><span class="cap-tag">${capLabel}</span></td>
        </tr>
      `;
    }

    sprintSectionsHTML += `
      <div class="sprint-card">
        <div class="sprint-header">
          <h2>🔥 دستاوردها و قابلیت‌های افزوده‌شده در ${sKey}</h2>
          <span class="sprint-badge">${done} تسک انجام‌شده از ${total} تسک (%${prog} پیشرفت)</span>
        </div>

        ${doneTasks.length > 0 ? `
          <table class="data-table">
            <thead>
              <tr>
                <th>کد تسک</th>
                <th>عنوان تسک و توضیحات</th>
                <th>پروژه مربوطه</th>
                <th>مسئول اجرای تسک</th>
                <th>کارکرد / تخمین</th>
                <th>پیشرفت</th>
                <th>قابلیت افزوده شده به سیستم عملیات</th>
              </tr>
            </thead>
            <tbody>
              ${doneTasksHTML}
            </tbody>
          </table>
        ` : `<p style="color:#94A3B8;">در این اسپرینت تسکی در وضعیت Done ثبت نشده است.</p>`}
      </div>
    `;
  }

  const htmlDocument = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>گزارش جامع دستاوردها و خروجی اسپرینت‌های تیم عملیات R&D</title>
  <style>
    @import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css');
    body {
      background: #0B0F19;
      color: #F8FAFC;
      font-family: 'Vazirmatn', sans-serif;
      margin: 0;
      padding: 2rem;
      direction: rtl;
    }
    .header-banner {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9));
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      border-top: 4px solid #38BDF8;
    }
    h1 { margin: 0 0 0.5rem; color: #FFFFFF; font-size: 1.8rem; }
    .subtitle { color: #94A3B8; font-size: 0.95rem; margin: 0; }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    .kpi-box {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 1.2rem;
      text-align: center;
    }
    .kpi-box .val { font-size: 1.8rem; font-weight: 800; color: #38BDF8; margin-top: 0.2rem; }
    .kpi-box .lbl { font-size: 0.85rem; color: #94A3B8; }
    .sprint-card {
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .sprint-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .sprint-header h2 { margin: 0; font-size: 1.25rem; color: #F97316; }
    .sprint-badge {
      background: rgba(249, 115, 22, 0.15);
      color: #F97316;
      border: 1px solid rgba(249, 115, 22, 0.35);
      padding: 0.3rem 0.8rem;
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
      padding: 0.8rem 1rem;
      text-align: right;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }
    .data-table th {
      background: rgba(15, 23, 42, 0.8);
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
    .cap-tag {
      background: rgba(16, 185, 129, 0.15);
      color: #34D399;
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 0.25rem 0.6rem;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
    }
    .badge {
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: bold;
    }
    .badge-done { background: rgba(16, 185, 129, 0.2); color: #34D399; }
    .badge-active { background: rgba(59, 130, 246, 0.2); color: #60A5FA; }
    .badge-waiting { background: rgba(249, 115, 22, 0.2); color: #F97316; }
    .badge-todo { background: rgba(192, 132, 252, 0.2); color: #C084FC; }
    .progress-wrap {
      width: 80px;
      height: 6px;
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
    <h1>🚀 گزارش خروجی اسپرینت‌ها و قابلیت‌های افزوده شده به سیستم عملیات</h1>
    <p class="subtitle">تحلیل تجمیعی دستاوردهای عملیاتی، قابلیت‌های کلاستر و درصد پیشرفت تسک‌های R&D | تاریخ تنظیم: ۲۰ مرداد ۱۴۰۵</p>
  </div>

  <div class="kpi-row">
    <div class="kpi-box">
      <div class="lbl">مجموع کل تسک‌های اسپرینت</div>
      <div class="val">${totalAllTasks} تسک</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">تسک‌های انجام‌شده (Done)</div>
      <div class="val" style="color: #34D399;">${totalAllDone} تسک</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">مجموع ساعات کارکرد ثبت‌شده</div>
      <div class="val" style="color: #F97316;">${totalAllSpent}h / ${totalAllEst}h</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">درصد پیشرفت کل اسپرینت‌ها</div>
      <div class="val" style="color: #C084FC;">%${overallProg}</div>
    </div>
  </div>

  <div class="sprint-card">
    <h2>📊 جدول خلاصه‌ مدیریتی اسپرینت‌ها</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>اسپرینت</th>
          <th>کل تسک‌ها</th>
          <th>انجام‌شده</th>
          <th>در حال انجام</th>
          <th>منتظر</th>
          <th>برای انجام</th>
          <th>کارکرد / تخمین</th>
          <th>درصد پیشرفت</th>
        </tr>
      </thead>
      <tbody>
        ${htmlRows}
      </tbody>
    </table>
  </div>

  ${sprintSectionsHTML}

</body>
</html>
`;

  const artifactDir = path.join('C:', 'Users', 'USER', '.gemini', 'antigravity', 'brain', 'e1b06dcf-1ee8-4b82-9cd1-c638ecc67cdb');
  const htmlFilePath = path.join(artifactDir, 'sprint_deliverables_report.html');
  fs.writeFileSync(htmlFilePath, htmlDocument, 'utf-8');
  console.log(`✅ Artifact HTML Report created successfully at: ${htmlFilePath}`);
}

generateHTMLReport().catch(console.error);
