const cron = require('node-cron');
const jiraService = require('./jiraService');
const { getDb } = require('../db/database');
const dotenv = require('dotenv');

dotenv.config();

const SYNC_INTERVAL = process.env.SYNC_INTERVAL_MINUTES || 60;

async function syncFromJira() {
  if (!jiraService.isConfigured) {
    console.log('Jira is not configured. Skipping sync.');
    return { success: false, message: 'Jira not configured' };
  }

  const db = getDb();
  let projectsSynced = 0;
  let tasksSynced = 0;
  const syncTime = new Date().toISOString();

  try {
    console.log('Starting Epic extraction from Jira...');
    const epics = await jiraService.fetchEpics();
    console.log(`Fetched ${epics.length} epics from Jira.`);
    
    const insertProject = db.prepare(`
      INSERT INTO projects (id, title, description, status, capabilities, category, confluence_link, start_date, due_date, last_synced)
      VALUES (@id, @title, @description, @status, @capabilities, @category, @confluence_link, @start_date, @due_date, @last_synced)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE projects.description END,
        status=excluded.status,
        capabilities=excluded.capabilities,
        category=excluded.category,
        confluence_link=excluded.confluence_link,
        start_date=excluded.start_date,
        due_date=excluded.due_date,
        last_synced=excluded.last_synced
    `);

    db.transaction(() => {
      for (const epic of epics) {
        epic.last_synced = syncTime;
        if (!epic.capabilities) epic.capabilities = '';
        if (!epic.confluence_link) epic.confluence_link = null;
        insertProject.run(epic);
        projectsSynced++;
      }
    })();

    // Link any previously-saved tasks to these newly-fetched epics
    autoLinkTasksToEpics();

    console.log(`Epic extraction complete. Epics/Projects: ${projectsSynced}`);
    console.log('Now fetching tasks for the last 12 months...');

    // Fetch tasks for the last 12 months
    try {
      const monthlyResult = await syncMonthlyLastYearFromJira();
      tasksSynced = monthlyResult.totalTasksSynced || 0;
      console.log(`Task extraction complete. Tasks synced: ${tasksSynced}`);
    } catch (taskErr) {
      console.error('Task extraction failed (epics still saved):', taskErr.message);
    }

    const logInsert = db.prepare('INSERT INTO sync_log (synced_at, status, message, projects_synced, tasks_synced) VALUES (?, ?, ?, ?, ?)');
    logInsert.run(syncTime, 'Success', 'Full sync completed successfully', projectsSynced, tasksSynced);

    return {
      success: true,
      projectsSynced,
      tasksSynced,
      message: `بازسازی کامل انجام شد (${projectsSynced} اپیک و ${tasksSynced} تسک از جیرا دریافت شد)`
    };

  } catch (err) {
    console.error('Epic extraction failed:', err);
    const logInsert = db.prepare('INSERT INTO sync_log (synced_at, status, message) VALUES (?, ?, ?)');
    logInsert.run(syncTime, 'Failed', err.message);
    return { success: false, message: err.message };
  }
}

function getLastSync() {
  try {
    const db = getDb();
    const logRow = db.prepare('SELECT * FROM sync_log WHERE status = "Success" ORDER BY id DESC LIMIT 1').get();
    if (logRow && logRow.synced_at) {
      return logRow;
    }
    const projRow = db.prepare('SELECT MAX(last_synced) as synced_at FROM projects').get();
    if (projRow && projRow.synced_at) {
      return { synced_at: projRow.synced_at, status: 'Success' };
    }
    return null;
  } catch (e) {
    return null;
  }
}

const PERSIAN_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

function getJalaliMonthLabel(year, monthZeroIndexed) {
  const gMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const gName = gMonthNames[monthZeroIndexed];
  let jMonthIdx = (monthZeroIndexed + 9) % 12;
  let jYear = monthZeroIndexed >= 2 ? year - 621 : year - 622;
  return {
    jalali: `${PERSIAN_MONTH_NAMES[jMonthIdx]} ${jYear}`,
    gregorian: `${gName} ${year}`
  };
}

async function syncMonthlyLastYearFromJira() {
  if (!jiraService.isConfigured) {
    return { success: false, message: 'Jira is not configured' };
  }

  const db = getDb();
  const syncTime = new Date().toISOString();
  const monthlyResults = [];
  let totalTasksSynced = 0;
  let projectsSynced = 0;

  // 1. Fetch Epics first
  let epics = [];
  try {
    epics = await jiraService.fetchEpics();
    db.transaction(() => {
      const insertProject = db.prepare(`
        INSERT INTO projects (id, title, description, status, capabilities, category, confluence_link, start_date, due_date, last_synced)
        VALUES (@id, @title, @description, @status, @capabilities, @category, @confluence_link, @start_date, @due_date, @last_synced)
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title,
          description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE projects.description END,
          status=excluded.status,
          last_synced=excluded.last_synced
      `);
      for (const epic of epics) {
        epic.last_synced = syncTime;
        insertProject.run(epic);
        projectsSynced++;
      }
    })();
  } catch (err) {
    console.error('Fetching epics failed during monthly sync:', err);
  }

  // 2. Generate 12 month ranges (11 months ago to current month)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthRanges = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();

    const lastDay = new Date(y, m + 1, 0);

    const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01 00:00`;
    const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')} 23:59`;

    const monthInfo = getJalaliMonthLabel(y, m);

    monthRanges.push({
      monthIndex: 12 - i,
      year: y,
      month: m + 1,
      monthKey: `${y}-${String(m + 1).padStart(2, '0')}`,
      jalaliName: monthInfo.jalali,
      gregorianName: monthInfo.gregorian,
      startStr,
      endStr
    });
  }

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, project_id, title, description, status, assignee, estimate_hours, spent_hours, start_date, due_date, is_waiting, waiting_for_team, waiting_reason, sprint_name, sprint_start_date, sprint_end_date, priority, labels, component, sort_order, is_subtask, parent_task_id, last_synced)
    VALUES (@id, @project_id, @title, @description, @status, @assignee, @estimate_hours, @spent_hours, @start_date, @due_date, @is_waiting, @waiting_for_team, @waiting_reason, @sprint_name, @sprint_start_date, @sprint_end_date, @priority, @labels, @component, @sort_order, @is_subtask, @parent_task_id, @last_synced)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE tasks.description END,
      status=excluded.status,
      assignee=excluded.assignee,
      estimate_hours=excluded.estimate_hours,
      spent_hours=excluded.spent_hours,
      start_date=excluded.start_date,
      due_date=excluded.due_date,
      is_waiting=excluded.is_waiting,
      waiting_for_team=excluded.waiting_for_team,
      waiting_reason=excluded.waiting_reason,
      sprint_name=excluded.sprint_name,
      sprint_start_date=excluded.sprint_start_date,
      sprint_end_date=excluded.sprint_end_date,
      priority=excluded.priority,
      labels=excluded.labels,
      component=excluded.component,
      sort_order=excluded.sort_order,
      is_subtask=excluded.is_subtask,
      parent_task_id=excluded.parent_task_id,
      last_synced=excluded.last_synced
  `);

  const cfg = jiraService.getJiraConfig();
  const projKeys = cfg.projectKey ? cfg.projectKey.split(',').map(k => k.trim()).filter(Boolean) : [];
  const projectJqlClause = projKeys.length > 0 ? `project IN (${projKeys.join(',')}) AND ` : '';

  const configuredProjKeySet = new Set((cfg.projectKey || '').split(',').map(k => k.trim().toUpperCase()).filter(Boolean));

  for (const mRange of monthRanges) {
    const jql = `${projectJqlClause}created >= "${mRange.startStr}" AND created <= "${mRange.endStr}" ORDER BY created ASC`;
    try {
      const searchRes = await jiraService.jiraSearch(jql);
      const rawIssues = searchRes.issues || [];

      // Strict JS-level filter: only keep issues from configured project keys
      const filteredIssues = configuredProjKeySet.size > 0
        ? rawIssues.filter(issue => {
            const issueProjKey = (issue.fields?.project?.key || (issue.key || '').split('-')[0] || '').toUpperCase();
            return configuredProjKeySet.has(issueProjKey);
          })
        : rawIssues;

      const parsedTasks = filteredIssues.map((issue, idx) => jiraService.parseTaskIssue ? jiraService.parseTaskIssue(issue, null, idx) : issue);

      db.transaction(() => {
        for (const task of parsedTasks) {
          if (task && task.id) {
            task.last_synced = syncTime;
            // Only insert tasks from configured project keys (check by key prefix, not exact epic ID)
            if (task.project_id && configuredProjKeySet.size > 0) {
              const taskProjPrefix = (task.project_id || '').split('-')[0].toUpperCase();
              if (!configuredProjKeySet.has(taskProjPrefix)) continue;
            }
            insertTask.run(task);
          }
        }
      })();

      totalTasksSynced += parsedTasks.length;

      monthlyResults.push({
        monthIndex: mRange.monthIndex,
        monthKey: mRange.monthKey,
        jalaliName: mRange.jalaliName,
        gregorianName: mRange.gregorianName,
        dateRange: `${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]}`,
        jql,
        taskCount: parsedTasks.length,
        status: parsedTasks.length > 0 ? 'success' : 'empty',
        message: parsedTasks.length > 0 ? `${parsedTasks.length} تسک دریافت شد` : '۰ تسک (بدون نتیجه)'
      });

    } catch (monthErr) {
      console.error(`Monthly sync failed for month ${mRange.monthKey}:`, monthErr.message);
      monthlyResults.push({
        monthIndex: mRange.monthIndex,
        monthKey: mRange.monthKey,
        jalaliName: mRange.jalaliName,
        gregorianName: mRange.gregorianName,
        dateRange: `${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]}`,
        jql,
        taskCount: 0,
        status: 'error',
        message: `خطا در همگام‌سازی: ${monthErr.message}`
      });
    }
  }

  // Update project stats
  try {
    const updateAllProjectStats = db.prepare(`
      UPDATE projects SET
        total_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0)),
        completed_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0) AND (status = 'Done' OR status = 'Completed')),
        waiting_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0) AND (is_waiting = 1 OR status = 'OnHolding' OR status = 'Waiting'))
    `);
    updateAllProjectStats.run();
  } catch (_) {}

  return {
    success: true,
    totalTasksSynced,
    projectsSynced,
    monthlyResults
  };
}

async function syncDateRangeFromJira(startDateInput, endDateInput) {
  if (!jiraService.isConfigured) {
    return { success: false, message: 'Jira is not configured' };
  }

  const db = getDb();
  const syncTime = new Date().toISOString();
  const monthlyResults = [];
  let totalTasksSynced = 0;
  let projectsSynced = 0;

  // 1. Fetch Epics first
  let epics = [];
  try {
    epics = await jiraService.fetchEpics();
    db.transaction(() => {
      const insertProject = db.prepare(`
        INSERT INTO projects (id, title, description, status, capabilities, category, confluence_link, start_date, due_date, last_synced)
        VALUES (@id, @title, @description, @status, @capabilities, @category, @confluence_link, @start_date, @due_date, @last_synced)
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title,
          description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE projects.description END,
          status=excluded.status,
          last_synced=excluded.last_synced
      `);
      for (const epic of epics) {
        epic.last_synced = syncTime;
        insertProject.run(epic);
        projectsSynced++;
      }
    })();
  } catch (err) {
    console.error('Fetching epics failed during range sync:', err);
  }

  const startDt = new Date(startDateInput || '2025-01-01');
  const endDt = new Date(endDateInput || new Date().toISOString().split('T')[0]);

  const monthRanges = [];
  let curr = new Date(startDt.getFullYear(), startDt.getMonth(), 1);
  let stepIndex = 1;

  while (curr <= endDt) {
    const y = curr.getFullYear();
    const m = curr.getMonth();
    const lastDayOfMonth = new Date(y, m + 1, 0);

    const chunkStart = (y === startDt.getFullYear() && m === startDt.getMonth()) ? startDt : new Date(y, m, 1);
    const chunkEnd = (y === endDt.getFullYear() && m === endDt.getMonth()) ? endDt : lastDayOfMonth;

    const startStr = `${chunkStart.getFullYear()}-${String(chunkStart.getMonth() + 1).padStart(2, '0')}-${String(chunkStart.getDate()).padStart(2, '0')} 00:00`;
    const endStr = `${chunkEnd.getFullYear()}-${String(chunkEnd.getMonth() + 1).padStart(2, '0')}-${String(chunkEnd.getDate()).padStart(2, '0')} 23:59`;

    const monthInfo = getJalaliMonthLabel(y, m);

    monthRanges.push({
      monthIndex: stepIndex++,
      year: y,
      month: m + 1,
      monthKey: `${y}-${String(m + 1).padStart(2, '0')}`,
      jalaliName: monthInfo.jalali,
      gregorianName: monthInfo.gregorian,
      startStr,
      endStr
    });

    curr = new Date(y, m + 1, 1);
  }

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, project_id, title, description, status, assignee, estimate_hours, spent_hours, start_date, due_date, is_waiting, waiting_for_team, waiting_reason, sprint_name, sprint_start_date, sprint_end_date, priority, labels, component, sort_order, is_subtask, parent_task_id, last_synced)
    VALUES (@id, @project_id, @title, @description, @status, @assignee, @estimate_hours, @spent_hours, @start_date, @due_date, @is_waiting, @waiting_for_team, @waiting_reason, @sprint_name, @sprint_start_date, @sprint_end_date, @priority, @labels, @component, @sort_order, @is_subtask, @parent_task_id, @last_synced)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE tasks.description END,
      status=excluded.status,
      assignee=excluded.assignee,
      estimate_hours=excluded.estimate_hours,
      spent_hours=excluded.spent_hours,
      start_date=excluded.start_date,
      due_date=excluded.due_date,
      is_waiting=excluded.is_waiting,
      waiting_for_team=excluded.waiting_for_team,
      waiting_reason=excluded.waiting_reason,
      sprint_name=excluded.sprint_name,
      sprint_start_date=excluded.sprint_start_date,
      sprint_end_date=excluded.sprint_end_date,
      priority=excluded.priority,
      labels=excluded.labels,
      component=excluded.component,
      sort_order=excluded.sort_order,
      is_subtask=excluded.is_subtask,
      parent_task_id=excluded.parent_task_id,
      last_synced=excluded.last_synced
  `);

  const cfg = jiraService.getJiraConfig();
  const projKeys = cfg.projectKey ? cfg.projectKey.split(',').map(k => k.trim()).filter(Boolean) : [];
  const projectJqlClause = projKeys.length > 0 ? `project IN (${projKeys.join(',')}) AND ` : '';

  for (const mRange of monthRanges) {
    const jql = `${projectJqlClause}created >= "${mRange.startStr}" AND created <= "${mRange.endStr}" ORDER BY created ASC`;
    try {
      const searchRes = await jiraService.jiraSearch(jql);
      const rawIssues = searchRes.issues || [];
      const parsedTasks = rawIssues.map((issue, idx) => jiraService.parseTaskIssue ? jiraService.parseTaskIssue(issue, null, idx) : issue);

      db.transaction(() => {
        for (const task of parsedTasks) {
          if (task && task.id) {
            task.last_synced = syncTime;
            insertTask.run(task);
          }
        }
      })();

      totalTasksSynced += parsedTasks.length;

      monthlyResults.push({
        monthIndex: mRange.monthIndex,
        monthKey: mRange.monthKey,
        jalaliName: mRange.jalaliName,
        gregorianName: mRange.gregorianName,
        dateRange: `${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]}`,
        jql,
        taskCount: parsedTasks.length,
        status: parsedTasks.length > 0 ? 'success' : 'empty',
        message: parsedTasks.length > 0 ? `${parsedTasks.length} تسک دریافت شد` : '۰ تسک (بدون نتیجه)'
      });

    } catch (monthErr) {
      console.error(`Range sync failed for month ${mRange.monthKey}:`, monthErr.message);
      monthlyResults.push({
        monthIndex: mRange.monthIndex,
        monthKey: mRange.monthKey,
        jalaliName: mRange.jalaliName,
        gregorianName: mRange.gregorianName,
        dateRange: `${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]}`,
        jql,
        taskCount: 0,
        status: 'error',
        message: `خطا در همگام‌سازی: ${monthErr.message}`
      });
    }
  }

  try {
    const updateAllProjectStats = db.prepare(`
      UPDATE projects SET
        total_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0)),
        completed_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0) AND (status = 'Done' OR status = 'Completed')),
        waiting_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0) AND (is_waiting = 1 OR status = 'OnHolding' OR status = 'Waiting'))
    `);
    updateAllProjectStats.run();
  } catch (_) {}

  return {
    success: true,
    totalTasksSynced,
    projectsSynced,
    startDate: startDateInput,
    endDate: endDateInput,
    totalMonths: monthRanges.length,
    monthlyResults
  };
}

function g2j(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * (Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 0) days = (days - 1) % 365;
  let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

async function syncSingleMonthFromJira({ startStr, endStr, jalaliStartStr, jalaliEndStr, monthLabel, monthIndex }) {
  if (!jiraService.isConfigured) {
    return { success: false, message: 'Jira is not configured' };
  }

  const db = getDb();
  const syncTime = new Date().toISOString();

  // Only fetch Epics on step 1 to eliminate network overhead for subsequent steps
  if (Number(monthIndex) === 1) {
    try {
      const epics = await jiraService.fetchEpics();
      db.transaction(() => {
        const insertProject = db.prepare(`
          INSERT INTO projects (id, title, description, status, capabilities, category, confluence_link, start_date, due_date, last_synced)
          VALUES (@id, @title, @description, @status, @capabilities, @category, @confluence_link, @start_date, @due_date, @last_synced)
          ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE projects.description END,
            status=excluded.status,
            last_synced=excluded.last_synced
        `);
        for (const epic of epics) {
          epic.last_synced = syncTime;
          insertProject.run(epic);
        }
      })();
      // Link any previously-saved tasks to these newly-fetched epics
      autoLinkTasksToEpics();
    } catch (err) {
      console.error('Fetching epics failed during single month sync:', err.message);
    }
  }

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, project_id, title, description, status, assignee, estimate_hours, spent_hours, start_date, due_date, is_waiting, waiting_for_team, waiting_reason, sprint_name, sprint_start_date, sprint_end_date, priority, labels, component, sort_order, is_subtask, parent_task_id, last_synced)
    VALUES (@id, @project_id, @title, @description, @status, @assignee, @estimate_hours, @spent_hours, @start_date, @due_date, @is_waiting, @waiting_for_team, @waiting_reason, @sprint_name, @sprint_start_date, @sprint_end_date, @priority, @labels, @component, @sort_order, @is_subtask, @parent_task_id, @last_synced)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      description=CASE WHEN excluded.description IS NOT NULL AND excluded.description != '' THEN excluded.description ELSE tasks.description END,
      status=excluded.status,
      assignee=excluded.assignee,
      estimate_hours=excluded.estimate_hours,
      spent_hours=excluded.spent_hours,
      start_date=excluded.start_date,
      due_date=excluded.due_date,
      is_waiting=excluded.is_waiting,
      waiting_for_team=excluded.waiting_for_team,
      waiting_reason=excluded.waiting_reason,
      sprint_name=excluded.sprint_name,
      sprint_start_date=excluded.sprint_start_date,
      sprint_end_date=excluded.sprint_end_date,
      priority=excluded.priority,
      labels=excluded.labels,
      component=excluded.component,
      sort_order=excluded.sort_order,
      is_subtask=excluded.is_subtask,
      parent_task_id=excluded.parent_task_id,
      last_synced=excluded.last_synced
  `);

  const cfg = jiraService.getJiraConfig();
  const projKeyStr = cfg.projectKey || 'ORD';

  let projectClause = '';
  if (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*') {
    const projects = projKeyStr.split(',').map(p => {
      const clean = p.trim().toUpperCase();
      return /^[A-Z0-9_]+$/.test(clean) ? clean : `"${clean}"`;
    }).filter(Boolean);
    if (projects.length > 1) {
      projectClause = `project IN (${projects.join(',')})`;
    } else if (projects.length === 1) {
      projectClause = `project = ${projects[0]}`;
    }
  }

  const projPrefix = projectClause ? `${projectClause} AND ` : '';

  let effectiveJalaliStart = jalaliStartStr;
  let effectiveJalaliEnd = jalaliEndStr;

  if (!effectiveJalaliStart && startStr) {
    const sDateParts = startStr.split(' ')[0].split('-').map(Number);
    if (sDateParts.length === 3) {
      const jStart = g2j(sDateParts[0], sDateParts[1], sDateParts[2]);
      effectiveJalaliStart = `${jStart.jy}/${String(jStart.jm).padStart(2, '0')}/${String(jStart.jd).padStart(2, '0')} 00:00`;
    }
  }

  if (!effectiveJalaliEnd && endStr) {
    const eDateParts = endStr.split(' ')[0].split('-').map(Number);
    if (eDateParts.length === 3) {
      const jEnd = g2j(eDateParts[0], eDateParts[1], eDateParts[2]);
      effectiveJalaliEnd = `${jEnd.jy}/${String(jEnd.jm).padStart(2, '0')}/${String(jEnd.jd).padStart(2, '0')} 23:59`;
    }
  }

  const jalaliSlashDateOnly = effectiveJalaliStart && effectiveJalaliEnd ? effectiveJalaliStart.split(' ')[0] : '';
  const jalaliSlashDateEndOnly = effectiveJalaliStart && effectiveJalaliEnd ? effectiveJalaliEnd.split(' ')[0] : '';
  const jalaliDashDateOnly = jalaliSlashDateOnly ? jalaliSlashDateOnly.replace(/\//g, '-') : '';
  const jalaliDashDateEndOnly = jalaliSlashDateEndOnly ? jalaliSlashDateEndOnly.replace(/\//g, '-') : '';

  try {
    const gregStartDateOnly = (startStr || '').split(' ')[0];
    const gregEndDateOnly = (endStr || '').split(' ')[0];

    const confirmedJql = projectClause
      ? `${projectClause} AND created >= "${gregStartDateOnly}" AND created <= "${gregEndDateOnly}" ORDER BY created ASC`
      : `created >= "${gregStartDateOnly}" AND created <= "${gregEndDateOnly}" ORDER BY created ASC`;

    const configuredProjKeys = new Set(
      projKeyStr.split(',').map(k => k.trim().toUpperCase()).filter(Boolean)
    );

    console.log(`[SYNC][${monthLabel}] JQL: ${confirmedJql}`);
    console.log(`[SYNC][${monthLabel}] configuredProjKeys: ${[...configuredProjKeys].join(', ')}`);

    // Count projects in DB
    const projCount = db.prepare('SELECT COUNT(*) as c FROM projects').get();
    console.log(`[SYNC][${monthLabel}] Projects in DB before sync: ${projCount.c}`);

    let searchRes = null;
    try {
      searchRes = await jiraService.jiraSearch(confirmedJql);
    } catch (err) {
      const errCode = err.code || (err.response ? `HTTP_${err.response.status}` : 'TIMEOUT_OR_NETWORK');
      const detailMsg = err.response?.data?.errorMessages?.join(', ') || err.message;
      console.error(`[SYNC][${monthLabel}] Jira search ERROR: ${errCode} - ${detailMsg}`);
      return {
        success: false, monthIndex, monthLabel,
        dateRange: `${gregStartDateOnly} تا ${gregEndDateOnly}`,
        jql: confirmedJql, taskCount: 0, status: 'error',
        errorCode: errCode, message: `🔴 خطا (${errCode}): ${detailMsg}`,
        queryAuditResults: [{ variant: 3, name: 'کوئری #۳ (پروژه + تاریخ میلادی)', jql: confirmedJql, taskCount: 0, status: 'error', error: detailMsg }]
      };
    }

    const startDt = new Date(startStr);
    const endDt = new Date(endStr);
    const rawIssues = (searchRes && searchRes.issues) ? searchRes.issues : [];

    console.log(`[SYNC][${monthLabel}] Raw issues from Jira: ${rawIssues.length}`);
    if (rawIssues.length > 0) {
      const projKeysSeen = [...new Set(rawIssues.map(i => i.fields?.project?.key || i.key?.split('-')[0] || '?'))];
      console.log(`[SYNC][${monthLabel}] Project keys seen in raw issues: ${projKeysSeen.join(', ')}`);
    }

    // Filter in JS: by configured project keys + exact date range
    const finalIssues = rawIssues.filter(issue => {
      const issueProjKey = (issue.fields?.project?.key || (issue.key || '').split('-')[0] || '').toUpperCase();
      if (configuredProjKeys.size > 0 && issueProjKey && !configuredProjKeys.has(issueProjKey)) return false;
      if (issue.fields?.created) {
        const cDate = new Date(issue.fields.created);
        if (cDate < startDt || cDate > endDt) return false;
      }
      return true;
    });

    console.log(`[SYNC][${monthLabel}] Issues after JS project+date filter: ${finalIssues.length}`);

    const parsedTasks = finalIssues.map((issue, idx) => {
      const parsed = jiraService.parseTaskIssue ? jiraService.parseTaskIssue(issue, null, idx) : issue;
      if (parsed && !parsed.project_id) {
        const projKey = (issue.fields?.project?.key || (issue.key || '').split('-')[0] || 'ORD').toUpperCase();
        const proj = db.prepare('SELECT id FROM projects WHERE UPPER(id) = ? LIMIT 1').get(projKey);
        parsed.project_id = proj ? proj.id : projKey;
      }
      return parsed;
    });

    let savedCount = 0;
    let skippedCount = 0;
    db.transaction(() => {
      for (const task of parsedTasks) {
        if (task && task.id) {
          task.last_synced = syncTime;
          // Only insert tasks from configured project keys (check by key prefix, not exact epic ID)
          if (task.project_id && configuredProjKeys.size > 0) {
            const taskProjPrefix = (task.project_id || '').split('-')[0].toUpperCase();
            if (!configuredProjKeys.has(taskProjPrefix)) {
              skippedCount++;
              continue;
            }
          }
          try {
            insertTask.run(task);
            savedCount++;
          } catch (insertErr) {
            console.error(`[SYNC][${monthLabel}] insertTask ERROR for ${task.id}:`, insertErr.message);
          }
        }
      }
    })();

    console.log(`[SYNC][${monthLabel}] Tasks saved: ${savedCount}, skipped (wrong project): ${skippedCount}`);

    autoLinkTasksToEpics();

    const tasksInDb = db.prepare('SELECT COUNT(*) as c FROM tasks').get();
    console.log(`[SYNC][${monthLabel}] Total tasks in DB after sync: ${tasksInDb.c}`);

    try {
      db.prepare(`UPDATE projects SET
        total_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0)),
        completed_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0) AND (status = 'Done' OR status = 'Completed')),
        waiting_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_subtask IS NULL OR is_subtask = 0) AND (is_waiting = 1 OR status = 'OnHolding' OR status = 'Waiting'))
      `).run();
    } catch (_) {}

    return {
      success: true, monthIndex, monthLabel,
      dateRange: `${gregStartDateOnly} تا ${gregEndDateOnly}`,
      jql: confirmedJql,
      winningVariant: 'کوئری #۳ (پروژه + تاریخ میلادی دقیق)',
      taskCount: savedCount,
      status: savedCount > 0 ? 'success' : 'empty',
      message: savedCount > 0 ? `${savedCount} تسک دریافت و ذخیره شد` : '۰ تسک (در این بازه تسکی یافت نشد)',
      queryAuditResults: [{
        variant: 3, name: '✅ کوئری #۳ (پروژه + تاریخ میلادی دقیق)',
        jql: confirmedJql, taskCount: parsedTasks.length,
        status: parsedTasks.length > 0 ? 'success' : 'zero'
      }]
    };
  } catch (outerErr) {
    const fallbackJql = `${projPrefix}created >= "${(startStr||'').split(' ')[0]}" AND created <= "${(endStr||'').split(' ')[0]}" ORDER BY created ASC`;
    return {
      success: false, monthIndex, monthLabel,
      dateRange: `${(startStr||'').split(' ')[0]} تا ${(endStr||'').split(' ')[0]}`,
      jql: fallbackJql,
      taskCount: 0, status: 'error',
      errorCode: 'PROCESSING_ERROR',
      message: `🔴 خطا در پردازش ماه: ${outerErr.message}`,
      queryAuditResults: [{ variant: 3, name: 'کوئری #۳', jql: fallbackJql, taskCount: 0, status: 'error', error: outerErr.message }]
    };
  }
}

function autoLinkTasksToEpics() {
  try {
    const db = getDb();
    // Get all epics grouped by project key prefix
    const epics = db.prepare("SELECT id FROM projects WHERE id LIKE '%-%'").all().map(r => r.id);
    if (epics.length === 0) return;

    // Find tasks whose project_id is NOT a valid epic (not matching any projects.id)
    const unlinkedTasks = db.prepare(
      "SELECT id, project_id FROM tasks WHERE project_id NOT IN (SELECT id FROM projects)"
    ).all();
    if (unlinkedTasks.length === 0) return;

    const updateStmt = db.prepare('UPDATE tasks SET project_id = ? WHERE id = ?');
    // Build a map: projectKeyPrefix -> list of epic IDs
    const epicsByPrefix = {};
    for (const epicId of epics) {
      const prefix = epicId.split('-')[0].toUpperCase();
      if (!epicsByPrefix[prefix]) epicsByPrefix[prefix] = [];
      epicsByPrefix[prefix].push(epicId);
    }

    db.transaction(() => {
      for (const task of unlinkedTasks) {
        // Try to match by task's own key prefix (e.g. OPS-501 -> OPS -> OPS-101)
        const taskPrefix = (task.id || '').split('-')[0].toUpperCase();
        // Also try by project_id prefix if it's a plain project key
        const projPrefix = (task.project_id || '').split('-')[0].toUpperCase();

        const candidates = epicsByPrefix[taskPrefix] || epicsByPrefix[projPrefix] || [];
        if (candidates.length > 0) {
          // Assign to first available epic with same prefix
          updateStmt.run(candidates[0], task.id);
        }
      }
    })();
    console.log(`Auto-linked ${unlinkedTasks.length} tasks to epics.`);
  } catch (err) {
    console.error('Auto-link tasks error:', err.message);
  }
}

function initCron() {
  if (jiraService.isConfigured) {
    cron.schedule(`*/${SYNC_INTERVAL} * * * *`, syncFromJira);
    console.log(`Scheduled Jira sync every ${SYNC_INTERVAL} minutes`);
  }
}

module.exports = {
  syncFromJira,
  syncMonthlyLastYearFromJira,
  syncDateRangeFromJira,
  syncSingleMonthFromJira,
  getLastSync,
  autoLinkTasksToEpics,
  initCron
};
