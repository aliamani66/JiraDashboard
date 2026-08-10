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

// Consolidated Sprint Review Endpoint (All Tasks Across All Projects Grouped by Sprint)
router.get('/all-sprints', (req, res) => {
  try {
    const db = getDb();
    const tasks = db.prepare(`
      SELECT t.*, p.title as project_title, p.category as project_category
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      ORDER BY t.sprint_name ASC, t.sort_order ASC, t.id ASC
    `).all();

    const sprintsMap = {};
    for (const t of tasks) {
      const sName = t.sprint_name || 'Sprint 10';
      if (!sprintsMap[sName]) {
        sprintsMap[sName] = {
          sprintName: sName,
          startDate: t.sprint_start_date,
          endDate: t.sprint_end_date,
          tasks: []
        };
      }
      sprintsMap[sName].tasks.push(t);
    }

    res.json({
      tasks,
      sprintsMap
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch all sprints data' });
  }
});

// Standalone Clean HTML Report Endpoint for Sprints Export (PDF Printable)
router.get('/reports/sprints-html', (req, res) => {
  try {
    const db = getDb();
    const targetSprint = req.query.sprint || 'all';

    let rawTasks = db.prepare(`
      SELECT t.*, p.title as project_title, p.capabilities as project_capabilities, p.category as project_category
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      ORDER BY t.sprint_name ASC, t.project_id ASC, t.id ASC
    `).all();

    if (targetSprint !== 'all') {
      rawTasks = rawTasks.filter(t => (t.sprint_name || 'Sprint 10') === targetSprint);
    }

    const tasks = rawTasks;

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

    // 🌟 Aggregate Capabilities & Workload Progress by Operational Domain
    const domainMap = {};
    for (const t of tasks) {
      const compKey = t.component || 'infrastructure';
      const compName = componentLabels[compKey] || compKey || 'زیرساخت و عملیات';
      if (!domainMap[compKey]) {
        domainMap[compKey] = {
          name: compName,
          tasksCount: 0,
          doneCount: 0,
          spentHours: 0,
          estHours: 0,
          capabilities: []
        };
      }
      domainMap[compKey].tasksCount += 1;
      if (t.status === 'Done' || t.status === 'done') domainMap[compKey].doneCount += 1;
      domainMap[compKey].spentHours += (t.spent_hours || 0);
      domainMap[compKey].estHours += (t.estimate_hours || 0);
      
      const opDesc = taskOperationalMap[t.id] || t.description || t.title;
      domainMap[compKey].capabilities.push({ id: t.id, title: t.title, desc: opDesc, status: t.status });
    }

    const domainSummaries = {
      'dev': 'توسعه سرویس‌ها، فریم‌ورک اختصاصی CLI و خودکارسازی سرویس‌های پلتفرم',
      'infrastructure': 'ارتقاء پایداری کلاستر کوبرنتیز، پیکربندی Ingress Controller و مقیاس‌پذیری پادها',
      'security': 'استقرار کلاستر HashiCorp Vault، اسکن امنیتی Container با Trivy و مدیریت کلیدها',
      'monitoring': 'راه‌اندازی استک متمرکز Prometheus & Grafana و پیکربندی Alertmanager',
      'database': 'ارتقاء کلاستر PostgreSQL HA به همراه خودکارسازی بکاپ روی ذخیره‌ساز Ceph',
      'testing': 'اتوماسیون تست‌های استاتیک کد (SAST) با SonarQube و یکپارچه‌سازی گیت‌هاب',
      'support': 'خودکارسازی گزارش‌های سلامت سرویس‌ها و پشتیبانی عملیاتی کلاسترها'
    };

    let domainCapabilitiesHTML = '';
    for (const dKey of Object.keys(domainMap)) {
      const d = domainMap[dKey];
      const spent = Math.round(d.spentHours);
      const est = Math.round(d.estHours);
      const prog = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : (d.tasksCount > 0 ? Math.round((d.doneCount / d.tasksCount) * 100) : 0);
      const summaryText = domainSummaries[dKey] || 'توسعه و ارتقاء پایداری قابلیت‌های عملیاتی پلتفرم';

      domainCapabilitiesHTML += `
        <tr>
          <td><strong style="font-size: 0.93rem; color: #0F172A;">${d.name}</strong></td>
          <td><strong style="color: #EA580C; font-size: 0.92rem;">${spent} ساعت</strong></td>
          <td>
            <div class="progress-wrap" style="width: 100px;">
              <div class="progress-fill" style="width: ${prog}%"></div>
            </div>
            <strong style="color: #16A34A; font-size: 0.95rem; margin-right: 6px;">%${prog} پیشرفت (${targetSprint !== 'all' ? targetSprint : 'کل'})</strong>
          </td>
          <td style="font-size: 0.86rem; color: #334155;">
            ${summaryText}
          </td>
        </tr>
      `;
    }

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
    <h1>🚀 ${targetSprint !== 'all' ? `گزارش خروجی و دستاوردهای اختصاصی ${targetSprint}` : 'گزارش تجمیعی خروجی و قابلیت‌های عملیاتی تمام اسپرینت‌ها'}</h1>
    <p class="subtitle">گزارش تحلیلی دستاوردهای عملیاتی، قابلیت‌های افزوده شده و پیشرفت تسک‌های پلتفرم R&D | تاریخ تنظیم: ۲۰ مرداد ۱۴۰۵</p>
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

  <!-- 🎯 Summary Section: Capabilities worked on & progress per domain -->
  <div class="sprint-card" style="border-top: 4px solid #0EA5E9; background: #F8FAFC; margin-bottom: 1.8rem;">
    <h2 style="color: #0284C7; margin-top: 0;">🎯 خلاصه وضعیت پیشرفت قابلیت‌ها و کارکرد حوزه‌های عملیاتی ${targetSprint !== 'all' ? `در ${targetSprint}` : 'در کل اسپرینت‌ها'}</h2>
    <p style="font-size: 0.88rem; color: #64748B; margin-bottom: 1rem;">
      جدول زیر میزان کارکرد (ساعت)، درصد پیشرفت و قابلیت‌های فنی توسعه‌یافته را به تفکیک حوزه عملیاتی نشان می‌دهد:
    </p>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 220px;">عنوان قابلیت عملیاتی</th>
          <th style="width: 160px;">کارکرد در این اسپرینت</th>
          <th style="width: 200px;">میزان بهبود در این اسپرینت</th>
          <th>خلاصه قابلیت‌ها و ارتقاء فنی ایجادشده</th>
        </tr>
      </thead>
      <tbody>
        ${domainCapabilitiesHTML}
      </tbody>
    </table>
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

// Standalone Single Project Executive Report & Gantt Timeline HTML Endpoint
router.get('/reports/project-html/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
      return res.status(404).send('Project not found');
    }

    const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC, id ASC').all(id);

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

    let capabilities = [];
    try {
      capabilities = JSON.parse(project.capabilities || '[]');
    } catch (e) {
      capabilities = [];
    }

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(t => t.status === 'Done' || t.status === 'done').length;
    const activeTasks = tasks.filter(t => t.status === 'In Progress' || t.status === 'in_progress').length;
    const waitingTasks = tasks.filter(t => t.is_waiting || t.status === 'Waiting' || t.status === 'OnHolding').length;
    const todoTasks = totalTasks - (doneTasks + activeTasks + waitingTasks);

    const totalSpent = Math.round(tasks.reduce((sum, t) => sum + (t.spent_hours || 0), 0));
    const totalEst = Math.round(tasks.reduce((sum, t) => sum + (t.estimate_hours || 0), 0));
    const progress = totalEst > 0 ? Math.round((totalSpent / totalEst) * 100) : (totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0);

    // Extract sprint list from tasks
    const projectSprintNames = Array.from(new Set(tasks.map(t => t.sprint_name || 'Sprint 10'))).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });

    const sprintColsCount = Math.max(1, projectSprintNames.length);

    // Build Gantt Timeline Header Columns
    let ganttHeaderColsHTML = projectSprintNames.map(s => `
      <div class="gantt-col-header">🔥 ${s}</div>
    `).join('');

    // Build Gantt Rows
    let ganttRowsHTML = '';
    for (const t of tasks) {
      const tEst = t.estimate_hours || 0;
      const tSpent = t.spent_hours || 0;
      const tProg = tEst > 0 ? Math.min(100, Math.round((tSpent / tEst) * 100)) : (t.status === 'Done' ? 100 : 0);
      const sName = t.sprint_name || 'Sprint 10';
      const sprintIndex = projectSprintNames.indexOf(sName);
      
      // Calculate bar offset and width relative to sprint grid
      const colWidthPct = 100 / sprintColsCount;
      const leftOffsetPct = (sprintIndex >= 0 ? sprintIndex : 0) * colWidthPct;
      const barWidthPct = Math.max(colWidthPct * 0.9, (tProg / 100) * colWidthPct);

      let statusGradient = 'linear-gradient(90deg, #A855F7, #7E22CE)';
      let statusIcon = '📋';
      let statusBadgeClass = 'badge-todo';
      let statusText = 'برای انجام';

      if (t.status === 'Done' || t.status === 'done') {
        statusGradient = 'linear-gradient(90deg, #10B981, #059669)';
        statusIcon = '✅';
        statusBadgeClass = 'badge-done';
        statusText = 'تکمیل شد';
      } else if (t.status === 'In Progress' || t.status === 'in_progress') {
        statusGradient = 'linear-gradient(90deg, #38BDF8, #0284C7)';
        statusIcon = '⚡';
        statusBadgeClass = 'badge-active';
        statusText = 'در حال انجام';
      } else if (t.is_waiting) {
        statusGradient = 'linear-gradient(90deg, #F59E0B, #D97706)';
        statusIcon = '⏳';
        statusBadgeClass = 'badge-waiting';
        statusText = `منتظر (${t.waiting_for_team || 'خارجی'})`;
      }

      ganttRowsHTML += `
        <div class="gantt-row">
          <div class="gantt-label">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom: 2px;">
              <code class="task-code">${t.id}</code>
              <strong style="font-size:0.88rem; color:#0F172A;">${t.title}</strong>
            </div>
            <div style="font-size: 0.78rem; color: #64748B;">👤 ${t.assignee || 'تیم R&D'} | <span style="color:#EA580C; font-weight:bold;">🔥 ${sName}</span></div>
          </div>

          <div class="gantt-grid-track">
            <!-- Grid Lines -->
            <div class="gantt-grid-lines">
              ${projectSprintNames.map(() => '<div class="gantt-grid-line"></div>').join('')}
            </div>

            <!-- Positioned Gantt Bar -->
            <div class="gantt-bar-fill" style="margin-right: ${leftOffsetPct}%; width: ${barWidthPct}%; background: ${statusGradient};">
              <span class="gantt-bar-text">${statusIcon} %${tProg}</span>
            </div>
          </div>

          <div class="gantt-meta">
            <span class="badge ${statusBadgeClass}">${statusText}</span>
            <span style="font-weight: bold; font-size: 0.82rem; color: #334155;">${tSpent}h / ${tEst}h</span>
          </div>
        </div>
      `;
    }

    // Build Tasks Table Rows HTML
    let taskTableRowsHTML = '';
    for (const t of tasks) {
      const tEst = t.estimate_hours || 0;
      const tSpent = t.spent_hours || 0;
      const tProg = tEst > 0 ? Math.min(100, Math.round((tSpent / tEst) * 100)) : (t.status === 'Done' ? 100 : 0);
      const opDesc = taskOperationalMap[t.id] || t.description || 'توسعه و ارتقاء قابلیت‌های پروژه';

      let statusBadgeHTML = '<span class="badge badge-todo">📋 برای انجام</span>';
      if (t.status === 'Done' || t.status === 'done') statusBadgeHTML = '<span class="badge badge-done">✅ تکمیل شده</span>';
      else if (t.status === 'In Progress' || t.status === 'in_progress') statusBadgeHTML = '<span class="badge badge-active">⚡ در حال انجام</span>';
      else if (t.is_waiting) statusBadgeHTML = `<span class="badge badge-waiting">⏳ منتظر (${t.waiting_for_team || 'تیم خارجی'})</span>`;

      taskTableRowsHTML += `
        <tr>
          <td><code class="task-code">${t.id}</code></td>
          <td>
            <strong>${t.title}</strong>
            <div style="font-size:0.82rem; color:#475569; margin-top:3px; line-height:1.4;">
              💡 <em>دستاورد عملیاتی:</em> ${opDesc}
            </div>
          </td>
          <td>👤 ${t.assignee || 'تیم R&D'}</td>
          <td>🔥 ${t.sprint_name || 'Sprint 10'}</td>
          <td>${statusBadgeHTML}</td>
          <td>${tSpent}h / ${tEst}h</td>
          <td>
            <div class="progress-wrap">
              <div class="progress-fill" style="width: ${tProg}%"></div>
            </div>
            <strong>%${tProg}</strong>
          </td>
        </tr>
      `;
    }

    const htmlDocument = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>گزارش و گانت‌چارت پروژه ${project.id}: ${project.title}</title>
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
    .subtitle { color: #475569; font-size: 0.95rem; margin: 0 0 1rem; line-height: 1.6; white-space: pre-line; }
    .ph-cap-pills { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.6rem; }
    .ph-cap-pill {
      background: #E0F2FE;
      color: #0369A1;
      border: 1px solid #BAE6FD;
      padding: 0.25rem 0.65rem;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 700;
    }
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
    .card-section {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      page-break-inside: avoid;
    }
    .card-section h2 { margin: 0 0 1rem; font-size: 1.25rem; color: #0284C7; font-weight: 800; }
    
    /* Executive Gantt Chart Custom Styling */
    .gantt-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      padding: 1rem;
    }
    .gantt-header-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding-bottom: 0.6rem;
      border-bottom: 2px solid #CBD5E1;
      font-weight: 800;
      font-size: 0.84rem;
      color: #475569;
    }
    .gantt-header-label { width: 300px; flex-shrink: 0; }
    .gantt-header-timeline {
      flex: 1;
      display: flex;
      justify-content: space-around;
      text-align: center;
    }
    .gantt-col-header { flex: 1; color: #EA580C; font-weight: 800; font-size: 0.82rem; }
    .gantt-header-meta { width: 170px; text-align: left; flex-shrink: 0; }

    .gantt-container { display: flex; flex-direction: column; gap: 0.65rem; }
    .gantt-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      padding: 0.65rem 0.85rem;
      border-radius: 10px;
      transition: all 0.2s ease;
    }
    .gantt-label { width: 300px; flex-shrink: 0; }
    .gantt-grid-track {
      flex: 1;
      height: 26px;
      background: #F1F5F9;
      border-radius: 8px;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      border: 1px solid #E2E8F0;
    }
    .gantt-grid-lines {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      pointer-events: none;
    }
    .gantt-grid-line {
      flex: 1;
      border-left: 1px dashed rgba(203, 213, 225, 0.7);
    }
    .gantt-bar-fill {
      height: 20px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 8px;
      position: relative;
      z-index: 2;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
      transition: all 0.3s ease;
    }
    .gantt-bar-text { color: #FFFFFF; font-size: 0.76rem; font-weight: 800; white-space: nowrap; }
    .gantt-meta { width: 170px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }

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
    <span>💡 پیش‌نمایش خروجی گزارش و گانت‌چارت پروژه ${project.id}</span>
    <button className="no-print-btn" onclick="window.print()">🖨️ دانلود و ذخیره به عنوان PDF</button>
  </div>

  <div class="header-banner">
    <h1>🚀 گزارش پروژه ${project.id}: ${project.title}</h1>
    <p class="subtitle">${project.description || 'توضیحات و اهداف عملیاتی این پروژه در اپیک جیرا ثبت شده است.'}</p>
    
    ${capabilities.length > 0 ? `
      <div style="font-size: 0.86rem; font-weight: bold; color: #0284C7; margin-bottom: 4px;">🎯 قابلیت‌های اصلی پروژه:</div>
      <div class="ph-cap-pills">
        ${capabilities.map(c => `<span class="ph-cap-pill">✓ ${c}</span>`).join('')}
      </div>
    ` : ''}
  </div>

  <div class="kpi-row">
    <div class="kpi-box">
      <div class="lbl">تعداد کل تسک‌ها</div>
      <div class="val">${totalTasks} تسک</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">تسک‌های انجام‌شده (Done)</div>
      <div class="val" style="color: #16A34A;">${doneTasks} تسک</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">کارکرد / تخمین کل</div>
      <div class="val" style="color: #EA580C;">${totalSpent}h / ${totalEst}h</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">پیشرفت کل پروژه</div>
      <div class="val" style="color: #16A34A;">%${progress}</div>
    </div>
  </div>

  <!-- 📊 Gantt Chart / Timeline Section -->
  <div class="card-section">
    <h2>📅 نمودار گانت و تایم‌لاین زمان‌بندی و پیشرفت تسک‌های پروژه</h2>
    <div class="gantt-wrapper">
      <div class="gantt-header-row">
        <div class="gantt-header-label">عنوان تسک و مسئول</div>
        <div class="gantt-header-timeline">
          ${ganttHeaderColsHTML}
        </div>
        <div class="gantt-header-meta">وضعیت و کارکرد</div>
      </div>
      <div class="gantt-container">
        ${ganttRowsHTML}
      </div>
    </div>
  </div>

  <!-- 📋 Detailed Tasks Table -->
  <div class="card-section">
    <h2>📋 جدول تفکیکی تسک‌ها و دستاوردهای عملیاتی</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 75px;">کد تسک</th>
          <th>عنوان تسک و دستاورد فنی حاصل شده</th>
          <th>مسئول تسک</th>
          <th>اسپرینت</th>
          <th>وضعیت</th>
          <th>ساعات کارکرد</th>
          <th>پیشرفت</th>
        </tr>
      </thead>
      <tbody>
        ${taskTableRowsHTML}
      </tbody>
    </table>
  </div>

</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlDocument);
  } catch (err) {
    res.status(500).send('Error generating project report: ' + err.message);
  }
});

// Standalone Waiting & Blocked Tasks Executive Report HTML Endpoint
router.get('/reports/waiting-html', (req, res) => {
  try {
    const db = getDb();
    const tasks = db.prepare(`
      SELECT t.*, p.title as project_title, p.category as project_category
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.is_waiting = 1 OR t.status = 'Waiting' OR t.status = 'OnHolding'
      ORDER BY t.project_id ASC, t.id ASC
    `).all();

    const totalWaitingCount = tasks.length;
    const totalSpent = Math.round(tasks.reduce((sum, t) => sum + (t.spent_hours || 0), 0));
    const totalEst = Math.round(tasks.reduce((sum, t) => sum + (t.estimate_hours || 0), 0));

    // Group tasks by blocked team (waiting_for_team)
    const teamsMap = {};
    for (const t of tasks) {
      const teamName = t.waiting_for_team || 'تیم‌های وابسته خارجی';
      if (!teamsMap[teamName]) teamsMap[teamName] = [];
      teamsMap[teamName].push(t);
    }

    let teamSummaryRowsHTML = '';
    let detailedTasksTableHTML = '';

    for (const teamName of Object.keys(teamsMap)) {
      const teamTasks = teamsMap[teamName];
      const count = teamTasks.length;
      const spent = Math.round(teamTasks.reduce((sum, t) => sum + (t.spent_hours || 0), 0));

      teamSummaryRowsHTML += `
        <tr>
          <td><strong style="color:#C2410C; font-size:0.92rem;">⏳ ${teamName}</strong></td>
          <td><span class="badge badge-waiting">${count} تسک متوقف‌شده</span></td>
          <td><strong>${spent} ساعت</strong></td>
          <td>توقف و انتظار در دریافت تأییدیه یا سرویس از ${teamName}</td>
        </tr>
      `;

      for (const t of teamTasks) {
        const blockingText = t.waiting_reason || (t.blocked_by_task ? `تسک مسدودکننده: ${t.blocked_by_task}` : 'در انتظار دریافت سرویس و تأییدیه فنی');

        detailedTasksTableHTML += `
          <tr>
            <td><code class="task-code">${t.id}</code></td>
            <td>
              <strong style="color: #0F172A; font-size: 0.92rem;">${t.title}</strong>
            </td>
            <td><span class="proj-tag">${t.project_id}: ${t.project_title}</span></td>
            <td>👤 ${t.assignee || 'تیم R&D'}</td>
            <td><strong style="color:#C2410C;">🏢 ${t.waiting_for_team || 'تیم وابسته'}</strong></td>
            <td>
              <div class="blocking-reason-box">
                <span class="blocking-icon">⛔</span>
                <span>${blockingText}</span>
              </div>
            </td>
            <td><span class="badge badge-waiting">${t.priority || 'متوسط'}</span></td>
            <td>${t.spent_hours || 0}h / ${t.estimate_hours || 0}h</td>
          </tr>
        `;
      }
    }

    const htmlDocument = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>گزارش تسک‌های منتظر و متوقف‌شده (Waiting Tasks Report)</title>
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
      background: #FFF7ED;
      border: 1px solid #FFEDD5;
      border-radius: 16px;
      padding: 1.8rem;
      margin-bottom: 1.5rem;
      border-top: 4px solid #EA580C;
    }
    h1 { margin: 0 0 0.5rem; color: #9A3412; font-size: 1.7rem; font-weight: 800; }
    .subtitle { color: #C2410C; font-size: 0.92rem; margin: 0; }
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
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
    .kpi-box .val { font-size: 1.75rem; font-weight: 800; color: #EA580C; margin-top: 0.2rem; }
    .kpi-box .lbl { font-size: 0.84rem; color: #64748B; font-weight: 600; }
    .card-section {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      page-break-inside: avoid;
    }
    .card-section h2 { margin: 0 0 1rem; font-size: 1.25rem; color: #C2410C; font-weight: 800; }

    .blocking-reason-box {
      background: #FEF2F2;
      border: 1px solid #FCA5A5;
      color: #991B1B;
      padding: 0.35rem 0.65rem;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      line-height: 1.4;
    }
    .blocking-icon { font-size: 0.95rem; }

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
      background: #FFEDD5;
      color: #9A3412;
      font-weight: 700;
    }
    .task-code {
      background: #FFEDD5;
      color: #C2410C;
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
    .badge {
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      display: inline-block;
    }
    .badge-waiting { background: #FFEDD5; color: #C2410C; border: 1px solid #FDBA74; }
    @media print {
      .no-print-bar { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <span>💡 پیش‌نمایش خروجی رسمی تسک‌های منتظر و متوقف‌کننده پلتفرم R&D</span>
    <button className="no-print-btn" onclick="window.print()">🖨️ دانلود و ذخیره به عنوان PDF</button>
  </div>

  <div class="header-banner">
    <h1>⏳ گزارش جامع تسک‌های منتظر و علل مسدودکننده (Blocking Tasks Report)</h1>
    <p class="subtitle">گزارش مدیریتی تسک‌های متوقف‌شده به همراه شناسایی دقیق تسک‌ها و تیم‌های مسدودکننده | تاریخ تنظیم: ۲۰ مرداد ۱۴۰۵</p>
  </div>

  <div class="kpi-row">
    <div class="kpi-box">
      <div class="lbl">تعداد کل تسک‌های متوقف‌شده</div>
      <div class="val">${totalWaitingCount} تسک</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">تعداد تیم‌های مسدودکننده</div>
      <div class="val" style="color: #0284C7;">${Object.keys(teamsMap).length} تیم</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">ساعات کارکرد متوقف‌شده</div>
      <div class="val" style="color: #C2410C;">${totalSpent}h / ${totalEst}h</div>
    </div>
  </div>

  <!-- 📊 Summary Table by Blocked Team -->
  <div class="card-section">
    <h2>📊 خلاصه وضعیت تسک‌های متوقف‌شده به تفکیک تیم‌های وابسته</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>نام تیم / واحد مسدودکننده</th>
          <th>تعداد تسک متوقف</th>
          <th>ساعات کارکرد معطل</th>
          <th>توضیحات وابستگی</th>
        </tr>
      </thead>
      <tbody>
        ${teamSummaryRowsHTML}
      </tbody>
    </table>
  </div>

  <!-- 📋 Detailed Tasks Table -->
  <div class="card-section">
    <h2>📋 لیست تفکیکی تسک‌های منتظر و شناسایی علل مسدودکننده</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 75px;">کد تسک</th>
          <th style="width: 200px;">عنوان تسک متوقف‌شده</th>
          <th>پروژه مربوطه</th>
          <th>مسئول تسک</th>
          <th>تیم در انتظار</th>
          <th style="width: 250px;">⛔ تسک و علت مسدودکننده (Blocking Cause)</th>
          <th>اولویت</th>
          <th>ساعات کارکرد</th>
        </tr>
      </thead>
      <tbody>
        ${detailedTasksTableHTML}
      </tbody>
    </table>
  </div>

</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlDocument);
  } catch (err) {
    res.status(500).send('Error generating waiting report: ' + err.message);
  }
});

// Standalone Overall / Filtered Projects Executive Portfolio Report HTML Endpoint
router.get('/reports/overall-html', (req, res) => {
  try {
    const db = getDb();
    const { project_ids } = req.query;

    let projects = [];
    if (project_ids && project_ids.trim() !== '') {
      const idsList = project_ids.split(',').map(id => id.trim()).filter(Boolean);
      const placeholders = idsList.map(() => '?').join(',');
      projects = db.prepare(`SELECT * FROM projects WHERE id IN (${placeholders}) ORDER BY id ASC`).all(...idsList);
    } else {
      projects = db.prepare('SELECT * FROM projects ORDER BY id ASC').all();
    }

    // Attach tasks and capabilities to projects
    let allTasks = [];
    for (const p of projects) {
      const pTasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY id ASC').all(p.id);
      p.tasks = pTasks;
      allTasks.push(...pTasks);

      // Parse capabilities
      if (typeof p.capabilities === 'string') {
        try { p.capabilities = JSON.parse(p.capabilities); } catch { p.capabilities = []; }
      }
      // Parse quarters
      if (typeof p.quarters === 'string') {
        try { p.quarters = JSON.parse(p.quarters); } catch { p.quarters = []; }
      }
    }

    const totalProjectsCount = projects.length;
    const totalTasks = allTasks.length;
    const doneTasks = allTasks.filter(t => t.status === 'Done' || t.status === 'done').length;
    const totalSpentHours = Math.round(allTasks.reduce((sum, t) => sum + (t.spent_hours || 0), 0));
    const totalEstimateHours = Math.round(allTasks.reduce((sum, t) => sum + (t.estimate_hours || 0), 0));
    const avgPlatformProgress = projects.length > 0
      ? Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length)
      : 0;

    // Build Portfolio Gantt Timeline Chart HTML
    let portfolioGanttRowsHTML = '';
    for (const p of projects) {
      const pProg = Math.round(p.progress || 0);
      const tasksCount = p.tasks ? p.tasks.length : 0;
      const spent = Math.round(p.tasks ? p.tasks.reduce((sum, t) => sum + (t.spent_hours || 0), 0) : 0);
      const est = Math.round(p.tasks ? p.tasks.reduce((sum, t) => sum + (t.estimate_hours || 0), 0) : 0);

      let statusGradient = 'linear-gradient(90deg, #38BDF8, #0284C7)';
      let statusBadgeClass = 'badge-active';
      let statusText = '⚡ در حال اجرا';

      if (p.status === 'Done' || p.status === 'done') {
        statusGradient = 'linear-gradient(90deg, #10B981, #059669)';
        statusBadgeClass = 'badge-done';
        statusText = '✅ تکمیل شده';
      } else if (p.status === 'Critical' || (p.waiting_tasks && p.waiting_tasks > 0)) {
        statusGradient = 'linear-gradient(90deg, #F59E0B, #D97706)';
        statusBadgeClass = 'badge-waiting';
        statusText = `⏳ دارای ${p.waiting_tasks || 1} تسک منتظر`;
      }

      portfolioGanttRowsHTML += `
        <div class="gantt-row">
          <div class="gantt-label">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
              <code class="proj-id-badge">${p.id}</code>
              <strong style="font-size:0.92rem; color:#0F172A;">${p.title}</strong>
            </div>
            <div style="font-size:0.78rem; color:#64748B;">📂 ${p.category || 'عمومی'} | 📋 ${tasksCount} تسک | 📅 ${(p.quarters || []).join('، ') || 'Q2-Q3'}</div>
          </div>

          <div class="gantt-grid-track">
            <div class="gantt-bar-fill" style="width: ${Math.max(8, pProg)}%; background: ${statusGradient};">
              <span class="gantt-bar-text">%${pProg} پیشرفت</span>
            </div>
          </div>

          <div class="gantt-meta">
            <span class="badge ${statusBadgeClass}">${statusText}</span>
            <span style="font-weight:bold; font-size:0.82rem; color:#334155;">${spent}h / ${est}h</span>
          </div>
        </div>
      `;
    }

    // Build Detailed Project Cards HTML
    let projectCardsHTML = '';
    for (const p of projects) {
      const pTasks = p.tasks || [];
      const spent = Math.round(pTasks.reduce((sum, t) => sum + (t.spent_hours || 0), 0));
      const est = Math.round(pTasks.reduce((sum, t) => sum + (t.estimate_hours || 0), 0));
      const pProg = Math.round(p.progress || 0);

      let taskRowsHTML = '';
      for (const t of pTasks) {
        taskRowsHTML += `
          <tr>
            <td><code class="task-code">${t.id}</code></td>
            <td><strong>${t.title}</strong></td>
            <td>👤 ${t.assignee || 'تیم R&D'}</td>
            <td>🔥 ${t.sprint_name || 'Sprint 10'}</td>
            <td>${t.status === 'Done' ? '<span class="badge badge-done">✅ Done</span>' : (t.is_waiting ? '<span class="badge badge-waiting">⏳ Waiting</span>' : '<span class="badge badge-active">⚡ Active</span>')}</td>
            <td>${t.spent_hours || 0}h / ${t.estimate_hours || 0}h</td>
          </tr>
        `;
      }

      projectCardsHTML += `
        <div class="project-detail-card">
          <div class="pd-header">
            <div>
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <code class="proj-id-badge">${p.id}</code>
                <h3 style="margin:0; font-size:1.15rem; color:#0F172A;">${p.title}</h3>
                <span class="badge ${p.status === 'Done' ? 'badge-done' : 'badge-active'}">${p.status || 'Active'}</span>
              </div>
              <p style="margin:4px 0 0; color:#475569; font-size:0.88rem; line-height:1.5;">${p.description || 'توضیحات اپیک در سیستم جیرا ثبت گردیده است.'}</p>
            </div>
            <div style="text-align:left; flex-shrink:0;">
              <div style="font-size:1.5rem; font-weight:800; color:#0284C7;">%${pProg}</div>
              <div style="font-size:0.78rem; color:#64748B;">${spent}h از ${est}h</div>
            </div>
          </div>

          ${(p.capabilities && p.capabilities.length > 0) ? `
            <div style="margin-top:0.75rem; display:flex; gap:0.4rem; flex-wrap:wrap;">
              ${p.capabilities.map(c => `<span class="cap-pill">✓ ${c}</span>`).join('')}
            </div>
          ` : ''}

          <table class="data-table" style="margin-top:1rem;">
            <thead>
              <tr>
                <th style="width:75px;">کد تسک</th>
                <th>عنوان تسک</th>
                <th>مسئول</th>
                <th>اسپرینت</th>
                <th>وضعیت</th>
                <th>کارکرد</th>
              </tr>
            </thead>
            <tbody>
              ${taskRowsHTML}
            </tbody>
          </table>
        </div>
      `;
    }

    const htmlDocument = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>گزارش جامع وضعیت پروژه‌های پلتفرم R&D (Executive Portfolio Report)</title>
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
      background: #F0F9FF;
      border: 1px solid #BAE6FD;
      border-radius: 16px;
      padding: 1.8rem;
      margin-bottom: 1.5rem;
      border-top: 4px solid #0284C7;
    }
    h1 { margin: 0 0 0.5rem; color: #0369A1; font-size: 1.7rem; font-weight: 800; }
    .subtitle { color: #0284C7; font-size: 0.92rem; margin: 0; }

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
    .kpi-box .val { font-size: 1.75rem; font-weight: 800; color: #0284C7; margin-top: 0.2rem; }
    .kpi-box .lbl { font-size: 0.84rem; color: #64748B; font-weight: 600; }

    .card-section {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      page-break-inside: avoid;
    }
    .card-section h2 { margin: 0 0 1.2rem; font-size: 1.25rem; color: #0284C7; font-weight: 800; }

    /* Gantt Chart Custom Styling */
    .gantt-wrapper {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      padding: 1rem;
    }
    .gantt-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      padding: 0.75rem 1rem;
      border-radius: 10px;
    }
    .gantt-label { width: 320px; flex-shrink: 0; }
    .gantt-grid-track {
      flex: 1;
      height: 26px;
      background: #E2E8F0;
      border-radius: 8px;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
    }
    .gantt-bar-fill {
      height: 20px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-left: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
    }
    .gantt-bar-text { color: #FFFFFF; font-size: 0.78rem; font-weight: 800; white-space: nowrap; padding-right: 8px; }
    .gantt-meta { width: 170px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }

    .project-detail-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 14px;
      padding: 1.25rem;
      margin-bottom: 1.25rem;
      page-break-inside: avoid;
    }
    .pd-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
    }
    .proj-id-badge {
      background: #E0F2FE;
      color: #0284C7;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-family: monospace;
      font-weight: bold;
    }
    .cap-pill {
      background: #E0F2FE;
      color: #0369A1;
      border: 1px solid #BAE6FD;
      padding: 0.2rem 0.55rem;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.86rem;
    }
    .data-table th, .data-table td {
      padding: 0.65rem 0.75rem;
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
      padding: 0.15rem 0.4rem;
      border-radius: 5px;
      font-family: monospace;
      font-weight: bold;
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
    @media print {
      .no-print-bar { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <span>💡 پیش‌نمایش خروجی جامع داشبورد پروژه‌های پلتفرم R&D</span>
    <button className="no-print-btn" onclick="window.print()">🖨️ دانلود و ذخیره به عنوان PDF</button>
  </div>

  <div class="header-banner">
    <h1>🚀 گزارش جامع وضعیت پروژه‌های پلتفرم R&D</h1>
    <p class="subtitle">خلاصه وضعیت، تایم‌لاین پیشرفت و دستاوردهای ${totalProjectsCount} پروژه انتخاب‌شده | تاریخ تنظیم: ۲۰ مرداد ۱۴۰۵</p>
  </div>

  <div class="kpi-row">
    <div class="kpi-box">
      <div class="lbl">تعداد پروژه‌های انتخابی</div>
      <div class="val">${totalProjectsCount} پروژه</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">مجموع تسک‌های پروژه</div>
      <div class="val" style="color: #16A34A;">${totalTasks} تسک (${doneTasks} Done)</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">کل کارکرد / تخمین اولیه</div>
      <div class="val" style="color: #EA580C;">${totalSpentHours}h / ${totalEstimateHours}h</div>
    </div>
    <div class="kpi-box">
      <div class="lbl">میانگین پیشرفت کلی</div>
      <div class="val" style="color: #16A34A;">%${avgPlatformProgress}</div>
    </div>
  </div>

  <!-- 📊 Portfolio Gantt Chart Section -->
  <div class="card-section">
    <h2>📅 تایم‌لاین و نمودار گانت پیشرفت پروژه‌ها</h2>
    <div class="gantt-wrapper">
      ${portfolioGanttRowsHTML}
    </div>
  </div>

  <!-- 📑 Detailed Project Breakdown Section -->
  <div class="card-section">
    <h2>📑 جزئیات پروژه‌ها و خروجی تسک‌های عملیاتی</h2>
    ${projectCardsHTML}
  </div>

</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlDocument);
  } catch (err) {
    res.status(500).send('Error generating overall report: ' + err.message);
  }
});

module.exports = router;
