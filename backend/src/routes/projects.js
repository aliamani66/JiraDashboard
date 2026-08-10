const express = require('express');
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth');
const mapping = require('../jiraMapping');

const router = express.Router();
router.use(authenticate);

// Helper: extract quarter labels (e.g. 1405Q1, 1404Q3) from a JSON labels string
function extractQuarterLabels(labelsJson) {
  try {
    const arr = JSON.parse(labelsJson || '[]');
    return arr.filter(l => /^\d{4}Q[1-4]$/i.test(l)).map(l => l.toUpperCase());
  } catch {
    return [];
  }
}

// List all projects with summary stats
router.get('/projects', (req, res) => {
  try {
    const db = getDb();
    const projects = db.prepare(`
      SELECT p.*,
        IFNULL((SELECT SUM(estimate_hours) FROM tasks WHERE project_id = p.id AND (is_subtask IS NULL OR is_subtask = 0)), 0) as total_estimate_hours,
        IFNULL((SELECT SUM(spent_hours) FROM tasks WHERE project_id = p.id AND (is_subtask IS NULL OR is_subtask = 0)), 0) as total_spent_hours
      FROM projects p
    `).all();

    for (const p of projects) {
      // Component map
      const compRows = db.prepare(`
        SELECT component, COUNT(*) as count 
        FROM tasks 
        WHERE project_id = ? 
        GROUP BY component
      `).all(p.id);
      
      const compObj = {};
      for (const row of compRows) {
        if (row.component) compObj[row.component] = row.count;
      }
      p.components_map = compObj;

      // Task status breakdown map (done, active, waiting, todo)
      const statusRows = db.prepare(`
        SELECT status, is_waiting, COUNT(*) as count 
        FROM tasks 
        WHERE project_id = ? 
        GROUP BY status, is_waiting
      `).all(p.id);

      const statusMap = { done: 0, active: 0, waiting: 0, todo: 0 };
      for (const row of statusRows) {
        const s = (row.status || '').toLowerCase();
        if (row.is_waiting === 1 || s === 'waiting' || s === 'onholding' || s === 'on hold') {
          statusMap.waiting += row.count;
        } else if (s === 'done' || s === 'completed' || s === 'resolved') {
          statusMap.done += row.count;
        } else if (s === 'in progress' || s === 'in_progress' || s === 'active' || s === 'in review' || s === 'testing') {
          statusMap.active += row.count;
        } else {
          statusMap.todo += row.count;
        }
      }
      p.status_map = statusMap;

      // Quarter labels — collect unique quarters from all tasks of this project
      const labelRows = db.prepare(`SELECT labels FROM tasks WHERE project_id = ?`).all(p.id);
      const quarterSet = new Set();
      for (const row of labelRows) {
        extractQuarterLabels(row.labels).forEach(q => quarterSet.add(q));
      }
      p.quarters = Array.from(quarterSet).sort();

      // Calculate progress dynamically based on Time Logged vs Estimate Hours
      const est = p.total_estimate_hours || 0;
      const spent = p.total_spent_hours || 0;
      if (est > 0) {
        p.progress = Math.min(100, Math.round((spent / est) * 100));
      } else if (p.total_tasks > 0) {
        p.progress = Math.round(((p.completed_tasks || 0) / p.total_tasks) * 100);
      } else {
        p.progress = 0;
      }
    }

    res.json({
      projects,
      featuredComponents: mapping.featuredComponents || ['learning', 'meeting', 'support']
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// All unique quarter labels across all projects
router.get('/quarters', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT DISTINCT labels FROM tasks WHERE labels IS NOT NULL AND labels != '[]'`).all();
    const quarterSet = new Set();
    for (const row of rows) {
      extractQuarterLabels(row.labels).forEach(q => quarterSet.add(q));
    }
    const quarters = Array.from(quarterSet).sort();
    res.json({ quarters });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quarters' });
  }
});

// Overall stats
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const totalProjects = db.prepare("SELECT COUNT(*) as count FROM projects").get().count;
    const activeProjects = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status != 'Done'").get().count;
    const completedProjects = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'Done'").get().count;
    const totalTasks = db.prepare("SELECT SUM(total_tasks) as count FROM projects").get().count || 0;
    const waitingTasks = db.prepare("SELECT SUM(waiting_tasks) as count FROM projects").get().count || 0;
    
    let avgProgressRow = db.prepare("SELECT AVG(progress) as avg FROM projects").get();
    let avgProgress = avgProgressRow && avgProgressRow.avg ? avgProgressRow.avg : 0;

    res.json({
      totalProjects,
      activeProjects,
      completedProjects,
      totalTasks,
      waitingTasks,
      avgProgress: Math.round(avgProgress)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Project detail with tasks
router.get('/projects/:id', (req, res) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC, id ASC').all(req.params.id);
    project.tasks = tasks;
    project.waitingTasks = tasks.filter(t => t.is_waiting === 1 || t.status === 'OnHolding' || t.status === 'Waiting');
    
    const quarterSet = new Set();
    const statusMap = { done: 0, active: 0, waiting: 0, todo: 0 };

    for (const t of tasks) {
      extractQuarterLabels(t.labels).forEach(q => quarterSet.add(q));

      const s = (t.status || '').toLowerCase();
      if (t.is_waiting === 1 || s === 'waiting' || s === 'onholding' || s === 'on hold') {
        statusMap.waiting++;
      } else if (s === 'done' || s === 'completed' || s === 'resolved') {
        statusMap.done++;
      } else if (s === 'in progress' || s === 'in_progress' || s === 'active' || s === 'in review' || s === 'testing') {
        statusMap.active++;
      } else {
        statusMap.todo++;
      }
    }
    project.quarters = Array.from(quarterSet).sort();
    project.status_map = statusMap;
    
    // Calculate progress based on Spent vs Estimate Hours
    const est = project.total_estimate_hours || 0;
    const spent = project.total_spent_hours || 0;
    if (est > 0) {
      project.progress = Math.min(100, Math.round((spent / est) * 100));
    } else if (project.total_tasks > 0) {
      project.progress = Math.round(((project.completed_tasks || 0) / project.total_tasks) * 100);
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.get('/projects/:id/gantt', (req, res) => {
  try {
    const db = getDb();
    const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC, id ASC').all(req.params.id);
    
    const formatted = tasks.map(t => {
      const est = t.estimate_hours || 0;
      const spent = t.spent_hours || 0;
      const prog = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : (t.status === 'Done' ? 100 : 0);
      
      return {
        id: t.id,
        name: t.title,
        title: t.title,
        start: t.start_date || '2026-07-15',
        end: t.due_date || '2026-08-30',
        start_date: t.start_date || '2026-07-15',
        due_date: t.due_date || '2026-08-30',
        progress: prog,
        status: t.status,
        is_waiting: t.is_waiting,
        is_blocked: t.is_waiting,
        estimate_hours: est,
        spent_hours: spent,
        assignee: t.assignee,
        sprint_name: t.sprint_name,
        waiting_for_team: t.waiting_for_team
      };
    });
    
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch gantt data' });
  }
});

// Waiting/Blocked tasks for a specific project
router.get('/projects/:id/blocked', (req, res) => {
  try {
    const db = getDb();
    const tasks = db.prepare("SELECT * FROM tasks WHERE project_id = ? AND (is_waiting = 1 OR status = 'OnHolding' OR status = 'Waiting') ORDER BY sort_order ASC, id ASC").all(req.params.id);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch waiting tasks for project' });
  }
});

// Waiting tasks across all projects (grouped by external team / OPM dependency)
router.get('/waiting-tasks', (req, res) => {
  try {
    const db = getDb();
    const tasks = db.prepare("SELECT t.*, p.title as projectTitle FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.is_waiting = 1 OR t.status = 'OnHolding' OR t.status = 'Waiting' ORDER BY t.project_id ASC").all();
    
    const byTeamMap = new Map();
    let totalWaiting = 0;
    
    for (const t of tasks) {
      totalWaiting++;
      const teamGroupKey = t.waiting_for_team || 'پروژه صنعتی OPM';
      
      if (!byTeamMap.has(teamGroupKey)) {
        byTeamMap.set(teamGroupKey, {
          projectId: 'OPM',
          projectTitle: `وابستگی به ${teamGroupKey}`,
          tasks: []
        });
      }
      
      const taskResponse = { ...t };
      delete taskResponse.projectTitle;
      
      byTeamMap.get(teamGroupKey).tasks.push(taskResponse);
    }
    
    res.json({
      totalWaiting,
      byProject: Array.from(byTeamMap.values())
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch waiting tasks' });
  }
});

// Standalone Clean HTML Report Endpoint for Sprints Export (PDF Printable)
router.get('/reports/sprints-html', (req, res) => {
  try {
    const db = getDb();
    const tasks = db.prepare(`
      SELECT t.*, p.title as project_title, p.capabilities as project_capabilities, p.category as project_category
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      ORDER BY t.sprint_name ASC, t.project_id ASC, t.id ASC
    `).all();

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

      let doneTasksHTML = '';
      for (const t of sTasks) {
        const tEst = t.estimate_hours || 0;
        const tSpent = t.spent_hours || 0;
        const tProg = tEst > 0 ? Math.min(100, Math.round((tSpent / tEst) * 100)) : (t.status === 'Done' ? 100 : 0);
        const opDesc = taskOperationalMap[t.id] || t.description || `توسعه و ارتقاء پایداری ماژول ${t.component || 'عملیاتی'}`;
        const compName = componentLabels[t.component] || t.component || 'عملیات';

        let statusBadgeHTML = '<span class="badge badge-todo">📋 برای انجام</span>';
        if (t.status === 'Done' || t.status === 'done') statusBadgeHTML = '<span class="badge badge-done">✅ تکمیل شده</span>';
        else if (t.status === 'In Progress' || t.status === 'in_progress') statusBadgeHTML = '<span class="badge badge-active">⚡ در حال انجام</span>';
        else if (t.is_waiting) statusBadgeHTML = `<span class="badge badge-waiting">⏳ منتظر (${t.waiting_for_team || 'تیم خارجی'})</span>`;

        doneTasksHTML += `
          <tr>
            <td><code class="task-code">${t.id}</code></td>
            <td>
              <strong>${t.title}</strong>
              <div style="font-size:0.82rem; color:#475569; margin-top:3px; line-height:1.4;">
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
            <h2>🔥 خروجی و دستاوردهای عملیاتی ${sKey}</h2>
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
  <title>گزارش خروجی اسپرینت‌ها و قابلیت‌های عملیاتی پلتفرم R&D</title>
  <style>
    @import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css');
    body {
      background: #FFFFFF;
      color: #0F172A;
      font-family: 'Vazirmatn', sans-serif;
      margin: 0;
      padding: 2rem;
      direction: rtl;
      line-height: 1.6;
    }
    .no-print-bar {
      background: #0F172A;
      color: #FFFFFF;
      padding: 0.8rem 1.5rem;
      border-radius: 12px;
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .no-print-btn {
      background: #0EA5E9;
      color: #FFFFFF;
      border: none;
      padding: 0.5rem 1.2rem;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: bold;
      cursor: pointer;
      font-family: inherit;
    }
    .header-banner {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      padding: 1.8rem;
      margin-bottom: 1.5rem;
      border-top: 4px solid #0EA5E9;
    }
    h1 { margin: 0 0 0.5rem; color: #0F172A; font-size: 1.7rem; font-weight: 800; }
    .subtitle { color: #64748B; font-size: 0.92rem; margin: 0; }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .kpi-box {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      padding: 1.1rem;
      text-align: center;
    }
    .kpi-box .val { font-size: 1.75rem; font-weight: 800; color: #0EA5E9; margin-top: 0.2rem; }
    .kpi-box .lbl { font-size: 0.84rem; color: #64748B; font-weight: 600; }
    .sprint-card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      padding: 1.4rem;
      margin-bottom: 1.5rem;
      page-break-inside: avoid;
    }
    .sprint-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.65rem;
      border-bottom: 1px solid #E2E8F0;
    }
    .sprint-header h2 { margin: 0; font-size: 1.2rem; color: #EA580C; font-weight: 800; }
    .sprint-badge {
      background: rgba(234, 88, 12, 0.1);
      color: #C2410C;
      border: 1px solid rgba(234, 88, 12, 0.3);
      padding: 0.3rem 0.85rem;
      border-radius: 10px;
      font-size: 0.82rem;
      font-weight: 700;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.5rem;
      font-size: 0.86rem;
    }
    .data-table th, .data-table td {
      padding: 0.75rem 0.85rem;
      text-align: right;
      border-bottom: 1px solid #E2E8F0;
    }
    .data-table th {
      background: #F1F5F9;
      color: #334155;
      font-weight: 700;
    }
    .task-code {
      background: #E0F2FE;
      color: #0284C7;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-family: monospace;
      font-weight: bold;
    }
    .proj-tag {
      font-size: 0.78rem;
      color: #334155;
      background: #F1F5F9;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
    }
    .cap-tag {
      background: #DCFCE7;
      color: #15803D;
      border: 1px solid #86EFAC;
      padding: 0.2rem 0.5rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 700;
    }
    .badge {
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      display: inline-block;
    }
    .badge-done { background: #DCFCE7; color: #15803D; border: 1px solid #86EFAC; }
    .badge-active { background: #DBEAFE; color: #1D4ED8; border: 1px solid #93C5FD; }
    .badge-waiting { background: #FFEDD5; color: #C2410C; border: 1px solid #FDBA74; }
    .badge-todo { background: #F3E8FF; color: #7E22CE; border: 1px solid #D8B4FE; }
    .badge-task { background: #F1F5F9; color: #334155; }
    .progress-wrap {
      width: 65px;
      height: 6px;
      background: #E2E8F0;
      border-radius: 4px;
      display: inline-block;
      vertical-align: middle;
      margin-left: 0.4rem;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #0284C7, #16A34A);
    }
    @media print {
      .no-print-bar { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <span>💡 پیش‌نمایش خروجی گزارش رسمی اسپرینت‌های تیم R&D</span>
    <button className="no-print-btn" onclick="window.print()">🖨️ دانلود و ذخیره به عنوان PDF</button>
  </div>

  <div class="header-banner">
    <h1>🚀 گزارش خروجی اسپرینت‌ها و قابلیت‌های عملیاتی پلتفرم R&D</h1>
    <p class="subtitle">گزارش تحلیلی دستاوردهای عملیاتی، قابلیت‌های افزوده شده و پیشرفت اسپرینت‌ها | تاریخ تنظیم: ۲۰ مرداد ۱۴۰۵</p>
  </div>

  <div class="kpi-row">
    <div class="kpi-box">
      <div class="lbl">مجموع کل تسک‌ها</div>
      <div class="val">${totalAllTasks} تسک</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">تسک‌های انجام‌شده (Done)</div>
      <div class="val" style="color: #16A34A;">${totalAllDone} تسک</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">مجموع کارکرد ثبت‌شده</div>
      <div class="val" style="color: #EA580C;">${totalAllSpent}h / ${totalAllEst}h</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">پیشرفت کل اسپرینت‌ها</div>
      <div class="val" style="color: #7E22CE;">%${overallProg}</div>
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

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlDocument);
  } catch (err) {
    res.status(500).send('Error generating report: ' + err.message);
  }
});

module.exports = router;
