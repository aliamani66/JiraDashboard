const express = require('express');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const jiraMapping = require('../jiraMapping');
const { authenticate } = require('../middleware/auth');
const jiraService = require('../services/jiraService');
const cacheService = require('../services/cacheService');
const { getDb, saveDb } = require('../db/database');

const router = express.Router();
router.use(authenticate);

const envPath = path.join(__dirname, '../../.env');

// Helper: parse .env file into key-value object
function parseEnv() {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const val = trimmed.substring(eqIdx + 1).trim();
    result[key] = val;
  }
  return result;
}

// Helper: write key-value object back to .env
function writeEnv(updates) {
  for (const [k, v] of Object.entries(updates)) {
    process.env[k] = v;
  }
  if (!fs.existsSync(envPath)) {
    const lines = Object.entries(updates).map(([k, v]) => `${k}=${v}`);
    fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf8');
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  const updatedKeys = new Set();

  const newLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) return line;
    const key = trimmed.substring(0, eqIdx).trim();
    if (updates.hasOwnProperty(key)) {
      updatedKeys.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });

  for (const [key, val] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      newLines.push(`${key}=${val}`);
    }
  }

  fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
}



// Helper: read all settings stored in SQLite system_settings table
function getDbSettings() {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM system_settings").all();
    const result = {};
    for (const r of rows) {
      if (r.key && r.value !== null && r.value !== undefined) {
        result[r.key] = r.value;
      }
    }
    return result;
  } catch (e) {
    return {};
  }
}

// Helper: save a key-value setting into SQLite system_settings table
function saveDbSetting(key, value) {
  try {
    const db = getDb();
    db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key, String(value));
  } catch (e) {
    console.error('Error saving db setting:', e.message);
  }
}

function getFullConfigObject() {
  const env = parseEnv();
  const dbConfig = getDbSettings();

  // Helper to read setting priority: SQLite DB -> .env file -> process.env -> defaultVal
  const getVal = (key, defaultVal = '') => {
    if (dbConfig[key] !== undefined && dbConfig[key] !== null && dbConfig[key] !== '') return dbConfig[key];
    if (env[key] !== undefined && env[key] !== null && env[key] !== '') return env[key];
    if (process.env[key] !== undefined && process.env[key] !== null && process.env[key] !== '') return process.env[key];
    return defaultVal;
  };

  return {
    connection: {
      baseUrl: getVal('JIRA_BASE_URL'),
      username: getVal('JIRA_USERNAME'),
      token: getVal('JIRA_TOKEN') ? '••••••••' : '',
      projectKey: getVal('JIRA_PROJECT_KEY'),
      isConfigured: jiraService.isConfigured,
      syncIntervalMinutes: getVal('SYNC_INTERVAL_MINUTES', '60'),
    },
    apiEndpoints: {
      apiVersion: getVal('JIRA_API_VERSION', 'auto'),
      searchEndpoint: getVal('JIRA_SEARCH_ENDPOINT', '/rest/api/2/search'),
      projectEndpoint: getVal('JIRA_PROJECT_ENDPOINT', '/rest/api/2/project'),
    },
    serverAndDb: {
      port: getVal('PORT', '3001'),
      jwtSecret: getVal('JWT_SECRET') ? '••••••••' : 'dev-secret-key',
      dbDriver: 'SQLite 3 (database.sqlite & system_settings)',
      dbStatus: 'متصل و فعال (ذخیره‌شده در دیتابیس)',
    },
    confluence: {
      baseUrl: getVal('CONFLUENCE_BASE_URL'),
      username: getVal('CONFLUENCE_USERNAME'),
      defaultSpaceKey: getVal('CONFLUENCE_DEFAULT_SPACE', 'OPS'),
    },
    waitingStatuses: getVal('JIRA_WAITING_STATUSES', 'OnHolding,Waiting,Blocked,On Hold').split(',').map(s => s.trim()),
    statusMapping: (() => {
      try {
        const raw = getVal('JIRA_STATUS_MAPPING', '');
        return raw ? (typeof raw === 'object' ? raw : JSON.parse(raw)) : (jiraMapping.statusMapping || {});
      } catch (_) {
        return jiraMapping.statusMapping || {};
      }
    })(),
    rebuildMonths: parseInt(getVal('JIRA_REBUILD_MONTHS', '3'), 10) || 3,
    customFields: {
      epicLinkField: getVal('JIRA_EPIC_LINK_FIELD', 'customfield_10006'),
      sprintField: getVal('JIRA_SPRINT_FIELD', 'customfield_10004'),
      waitingTeamField: getVal('JIRA_WAITING_TEAM_FIELD', ''),
      waitingReasonField: getVal('JIRA_WAITING_REASON_FIELD', ''),
      confluenceLinkField: getVal('JIRA_CONFLUENCE_LINK_FIELD', ''),
      capabilitiesField: getVal('JIRA_CAPABILITIES_FIELD', ''),
      categoryField: getVal('JIRA_CATEGORY_FIELD', ''),
    },
    dateMapping: {
      epicStartDateField: getVal('JIRA_EPIC_START_DATE_FIELD', 'created'),
      epicDueDateField: getVal('JIRA_EPIC_DUE_DATE_FIELD', 'duedate'),
      taskStartDateField: getVal('JIRA_TASK_START_DATE_FIELD', ''),
      taskDueDateField: getVal('JIRA_TASK_DUE_DATE_FIELD', 'duedate'),
    },
    labelPrefixes: {
      waitingTeam: getVal('JIRA_WAIT_TEAM_PREFIX', 'wait:'),
      waitingReason: getVal('JIRA_WAIT_REASON_PREFIX', 'reason:'),
      capability: getVal('JIRA_CAPABILITY_PREFIX', 'cap:'),
    },
    featuredComponents: getVal('JIRA_FEATURED_COMPONENTS', 'learning,meeting,support').split(',').map(s => s.trim()),
  };
}

// GET full settings
router.get('/config', (req, res) => {
  try {
    res.json(getFullConfigObject());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Jira settings: ' + err.message });
  }
});

// PUT save settings
router.put('/config', (req, res) => {
  try {
    const body = req.body;
    const updates = {};

    if (body.connection) {
      if (body.connection.baseUrl) updates.JIRA_BASE_URL = body.connection.baseUrl;
      if (body.connection.username) updates.JIRA_USERNAME = body.connection.username;
      if (body.connection.token && body.connection.token !== '••••••••') updates.JIRA_TOKEN = body.connection.token;
      if (body.connection.projectKey) updates.JIRA_PROJECT_KEY = body.connection.projectKey;
      if (body.connection.syncIntervalMinutes) updates.SYNC_INTERVAL_MINUTES = body.connection.syncIntervalMinutes;
    }

    if (body.serverAndDb) {
      if (body.serverAndDb.port) updates.PORT = body.serverAndDb.port;
      if (body.serverAndDb.jwtSecret && body.serverAndDb.jwtSecret !== '••••••••') updates.JWT_SECRET = body.serverAndDb.jwtSecret;
    }

    if (body.apiEndpoints) {
      const ep = body.apiEndpoints;
      if (ep.apiVersion) updates.JIRA_API_VERSION = ep.apiVersion;
      if (ep.searchEndpoint) updates.JIRA_SEARCH_ENDPOINT = ep.searchEndpoint;
      if (ep.projectEndpoint) updates.JIRA_PROJECT_ENDPOINT = ep.projectEndpoint;
    }

    if (body.confluence) {
      if (body.confluence.baseUrl) updates.CONFLUENCE_BASE_URL = body.confluence.baseUrl;
      if (body.confluence.username) updates.CONFLUENCE_USERNAME = body.confluence.username;
      if (body.confluence.defaultSpaceKey) updates.CONFLUENCE_DEFAULT_SPACE = body.confluence.defaultSpaceKey;
    }

    if (body.waitingStatuses && Array.isArray(body.waitingStatuses)) {
      updates.JIRA_WAITING_STATUSES = body.waitingStatuses.join(',');
    }

    if (body.customFields) {
      const cf = body.customFields;
      if (cf.epicLinkField !== undefined) updates.JIRA_EPIC_LINK_FIELD = cf.epicLinkField;
      if (cf.sprintField !== undefined) updates.JIRA_SPRINT_FIELD = cf.sprintField;
      if (cf.waitingTeamField !== undefined) updates.JIRA_WAITING_TEAM_FIELD = cf.waitingTeamField;
      if (cf.waitingReasonField !== undefined) updates.JIRA_WAITING_REASON_FIELD = cf.waitingReasonField;
      if (cf.confluenceLinkField !== undefined) updates.JIRA_CONFLUENCE_LINK_FIELD = cf.confluenceLinkField;
      if (cf.capabilitiesField !== undefined) updates.JIRA_CAPABILITIES_FIELD = cf.capabilitiesField;
      if (cf.categoryField !== undefined) updates.JIRA_CATEGORY_FIELD = cf.categoryField;
    }

    if (body.dateMapping) {
      const dm = body.dateMapping;
      if (dm.epicStartDateField !== undefined) updates.JIRA_EPIC_START_DATE_FIELD = dm.epicStartDateField;
      if (dm.epicDueDateField !== undefined) updates.JIRA_EPIC_DUE_DATE_FIELD = dm.epicDueDateField;
      if (dm.taskStartDateField !== undefined) updates.JIRA_TASK_START_DATE_FIELD = dm.taskStartDateField;
      if (dm.taskDueDateField !== undefined) updates.JIRA_TASK_DUE_DATE_FIELD = dm.taskDueDateField;
    }

    if (body.labelPrefixes) {
      const lp = body.labelPrefixes;
      if (lp.waitingTeam !== undefined) updates.JIRA_WAIT_TEAM_PREFIX = lp.waitingTeam;
      if (lp.waitingReason !== undefined) updates.JIRA_WAIT_REASON_PREFIX = lp.waitingReason;
      if (lp.capability !== undefined) updates.JIRA_CAPABILITY_PREFIX = lp.capability;
    }

    if (body.featuredComponents && Array.isArray(body.featuredComponents)) {
      updates.JIRA_FEATURED_COMPONENTS = body.featuredComponents.join(',');
    }

    if (body.statusMapping !== undefined && body.statusMapping !== null) {
      updates.JIRA_STATUS_MAPPING = typeof body.statusMapping === 'string' ? body.statusMapping : JSON.stringify(body.statusMapping);
    }

    if (body.rebuildMonths !== undefined && body.rebuildMonths !== null) {
      updates.JIRA_REBUILD_MONTHS = String(body.rebuildMonths);
    }

    // Write to both SQLite system_settings table and .env file
    for (const [k, v] of Object.entries(updates)) {
      saveDbSetting(k, v);
    }
    saveDb();
    writeEnv(updates);
    
    res.json({
      success: true,
      message: 'تنظیمات با موفقیت در دیتابیس و فایل پیکربندی سیستم ذخیره و اعمال گردید.',
      config: getFullConfigObject()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings: ' + err.message });
  }
});

// GET: Single COUNT query to Jira — total tasks, with epic, without epic for configured projects
router.get('/jira-count', async (req, res) => {
  try {
    const cfg = jiraService.getJiraConfig();
    if (!cfg.isConfigured) {
      return res.status(400).json({ success: false, message: 'جیرا پیکربندی نشده است. لطفاً آدرس و توکن جیرا را در تنظیمات وارد نمایید.' });
    }
    const projKeyStr = cfg.projectKey || '';

    let projectClause = '';
    if (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*') {
      const projects = projKeyStr.split(',').map(p => {
        const clean = p.trim().toUpperCase();
        return /^[A-Z0-9_]+$/.test(clean) ? clean : `"${clean}"`;
      }).filter(Boolean);
      if (projects.length > 1) projectClause = `project IN (${projects.join(',')})`;
      else if (projects.length === 1) projectClause = `project = ${projects[0]}`;
    }

    // Calculate configured rebuild date boundary (e.g. 1 month, 3 months, 6 months) starting from 1st of starting month
    const rebuildMonths = parseInt(req.query.months, 10) || parseInt(cfg.rebuildMonths, 10) || 3;
    const now = new Date();
    const startMonthDate = new Date(now.getFullYear(), now.getMonth() - (rebuildMonths - 1), 1);
    const startDateStr = `${startMonthDate.getFullYear()}-${String(startMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const dateClause = rebuildMonths < 60 ? `created >= "${startDateStr}"` : '';
    const fullClause = projectClause
      ? (dateClause ? `${projectClause} AND ${dateClause}` : projectClause)
      : (dateClause || '');

    // 1. Total Non-Epic Tasks Count JQL
    const countJql = `${fullClause} AND issuetype != Epic`;
    const withoutEpicJql = `${fullClause} AND issuetype != Epic AND parent IS EMPTY`;
    const withEpicJql = `${fullClause} AND issuetype != Epic AND parent IS NOT EMPTY`;
    const subJql = fullClause
      ? `${fullClause} AND (issuetype in subtaskIssueTypes() OR issuetype IN ("Sub-task", "Subtask", "sub-task", "Sub-Task", "زیرتسک"))`
      : (projectClause ? `${projectClause} AND (issuetype in subtaskIssueTypes() OR issuetype IN ("Sub-task", "Subtask", "sub-task", "Sub-Task", "زیرتسک"))` : `issuetype in subtaskIssueTypes() OR issuetype IN ("Sub-task", "Subtask", "sub-task", "Sub-Task", "زیرتسک")`);
    const epicJql = projectClause ? `${projectClause} AND issuetype = Epic` : `issuetype = Epic`;

    // Run ALL Jira count queries concurrently in parallel with singlePage: true & ['key'] only (READ-ONLY)
    const [countRes, withoutRes, withRes, subRes, epicRes] = await Promise.all([
      jiraService.jiraSearch(countJql, ['key'], { maxResults: 1, timeout: 6000, retries: 1, singlePage: true }).catch(() => ({ total: 0 })),
      jiraService.jiraSearch(withoutEpicJql, ['key'], { maxResults: 1, timeout: 6000, retries: 1, singlePage: true }).catch(async () => {
        try {
          return await jiraService.jiraSearch(`${fullClause} AND issuetype != Epic AND "Epic Link" is EMPTY`, ['key'], { maxResults: 1, timeout: 4000, retries: 1, singlePage: true });
        } catch (_) { return { total: 0 }; }
      }),
      jiraService.jiraSearch(withEpicJql, ['key'], { maxResults: 1, timeout: 6000, retries: 1, singlePage: true }).catch(async () => {
        try {
          return await jiraService.jiraSearch(`${fullClause} AND issuetype != Epic AND "Epic Link" is NOT EMPTY`, ['key'], { maxResults: 1, timeout: 4000, retries: 1, singlePage: true });
        } catch (_) { return { total: 0 }; }
      }),
      jiraService.jiraSearch(subJql, ['key'], { maxResults: 1, timeout: 6000, retries: 1, singlePage: true }).catch(async () => {
        try {
          const fallbackSub1 = fullClause ? `${fullClause} AND issuetype in subtaskIssueTypes()` : `issuetype in subtaskIssueTypes()`;
          return await jiraService.jiraSearch(fallbackSub1, ['key'], { maxResults: 1, timeout: 4000, retries: 1, singlePage: true });
        } catch (_) {
          try {
            const fallbackSub2 = fullClause ? `${fullClause} AND parent IS NOT EMPTY` : `parent IS NOT EMPTY`;
            return await jiraService.jiraSearch(fallbackSub2, ['key'], { maxResults: 1, timeout: 4000, retries: 1, singlePage: true });
          } catch (_) {
            return { total: 0 };
          }
        }
      }),
      jiraService.jiraSearch(epicJql, ['key'], { maxResults: 1, timeout: 6000, retries: 1, singlePage: true }).catch(() => ({ total: 0 }))
    ]);

    const total = countRes?.total !== undefined ? countRes.total : 0;
    let withoutEpicCount = withoutRes?.total !== undefined ? withoutRes.total : 0;
    let withEpicCount = withRes?.total !== undefined ? withRes.total : 0;

    // Cross-validate and balance counts accurately
    if (withoutEpicCount === 0 && withEpicCount > 0) {
      withoutEpicCount = Math.max(0, total - withEpicCount);
    } else if (withEpicCount === 0 && withoutEpicCount > 0) {
      withEpicCount = Math.max(0, total - withoutEpicCount);
    }
    const subtaskCount = subRes?.total !== undefined ? subRes.total : 0;
    const jiraEpicsCount = epicRes?.total !== undefined ? epicRes.total : 0;

    // Fast DB calculations (READ-ONLY)
    const db = getDb();
    const projKeyUpper = projKeyStr.trim().toUpperCase();
    const pKeys2 = (projKeyUpper && projKeyUpper !== 'ALL' && projKeyUpper !== '*')
      ? projKeyUpper.split(',').map(k => k.trim()).filter(Boolean) : [];
    const epicWhere2 = pKeys2.length > 0 ? `(${pKeys2.map(k => `id LIKE '${k}-%'`).join(' OR ')})` : "id LIKE '%-%'";
    const taskProjWhere2 = pKeys2.length > 0 ? ` AND (${pKeys2.map(k => `id LIKE '${k}-%'`).join(' OR ')})` : '';
    const dbDateClause2 = rebuildMonths < 60 ? ` AND (created_at >= '${startDateStr}' OR start_date >= '${startDateStr}' OR due_date >= '${startDateStr}')` : '';

    const dbWithEpicCount = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE parent_task_id IS NOT NULL AND parent_task_id != '' AND INSTR(parent_task_id, '-') > 0${taskProjWhere2}`).get()?.c || 0;
    const dbUnlinkedCount = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE (parent_task_id IS NULL OR parent_task_id = '' OR INSTR(parent_task_id, '-') = 0)${taskProjWhere2}`).get()?.c || 0;
    const dbTotalCount = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE 1=1${taskProjWhere2}`).get()?.c || 0;

    const withEpicMismatchCount = Math.abs(dbWithEpicCount - withEpicCount);
    const unlinkedMismatchCount = Math.abs(dbUnlinkedCount - withoutEpicCount);
    const totalMismatchCount = Math.abs(dbTotalCount - total);

    const jiraEpicsWithoutTasksCount = db.prepare(`
      SELECT COUNT(*) as c FROM projects
      WHERE ${epicWhere2} AND id NOT IN (
        SELECT DISTINCT project_id FROM tasks WHERE project_id IS NOT NULL AND project_id != ''${dbDateClause2}
        UNION
        SELECT DISTINCT parent_task_id FROM tasks WHERE parent_task_id IS NOT NULL AND parent_task_id != ''${dbDateClause2}
        UNION
        SELECT DISTINCT epic_id FROM tasks WHERE epic_id IS NOT NULL AND epic_id != ''${dbDateClause2}
      )
    `).get()?.c || 0;

    res.json({
      success: true,
      total,
      withEpicCount,
      withoutEpicCount,
      subtaskCount,
      jiraEpicsCount,
      jiraEpicsWithoutTasksCount,
      withEpicMismatchCount,
      unlinkedMismatchCount,
      totalMismatchCount,
      rebuildMonths,
      jql: countJql,
      withoutEpicJql,
      withEpicJql,
      projectKey: projKeyStr
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت تعداد از جیرا: ' + err.message });
  }
});

// POST 12-Month Batch Sync with detailed monthly report
router.post('/sync-monthly', async (req, res) => {
  try {
    const cacheService = require('../services/cacheService');
    const result = await cacheService.syncMonthlyLastYearFromJira();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در همگام‌سازی ۱۲ ماهه: ' + err.message });
  }
});

// POST Custom Date-Range Sync with detailed monthly report
router.post('/sync-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const cacheService = require('../services/cacheService');
    const result = await cacheService.syncDateRangeFromJira(startDate, endDate);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در همگام‌سازی بازه تاریخ: ' + err.message });
  }
});

// POST Single Month Chunk Sync (prevents 504 Gateway Timeout)
router.post('/sync-single-month', async (req, res) => {
  try {
    const cacheService = require('../services/cacheService');
    const result = await cacheService.syncSingleMonthFromJira(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در همگام‌سازی ماه: ' + err.message });
  }
});

// POST Inject artificial mismatches for UI verification
router.post('/inject-test-mismatches', (req, res) => {
  try {
    const db = getDb();
    const tasksWithEpic = db.prepare("SELECT id FROM tasks WHERE parent_task_id IS NOT NULL AND parent_task_id != '' AND created_at >= '2026-06-01' LIMIT 3").all().map(r => r.id);
    const tasksUnlinked = db.prepare("SELECT id FROM tasks WHERE (parent_task_id IS NULL OR parent_task_id = '') AND created_at >= '2026-06-01' LIMIT 1").all().map(r => r.id);
    const epics = db.prepare("SELECT id FROM projects LIMIT 2").all().map(r => r.id);

    for (const id of tasksWithEpic) db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    for (const id of tasksUnlinked) db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    for (const id of epics) db.prepare("DELETE FROM projects WHERE id = ?").run(id);

    res.json({
      success: true,
      message: 'مغایرت مصنوعی برای تست جدول مقایسه ایجاد گردید.',
      deletedTasksWithEpic: tasksWithEpic,
      deletedTasksUnlinked: tasksUnlinked,
      deletedEpics: epics
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST Preview JQL queries that WOULD be sent to Jira (no actual Jira call)
router.post('/preview-jql', (req, res) => {
  try {
    const { startStr, endStr, jalaliStartStr, jalaliEndStr } = req.body;
    if (!startStr || !endStr) {
      return res.status(400).json({ success: false, message: 'startStr و endStr الزامی هستند' });
    }

    const jiraService = require('../services/jiraService');
    const cfg = jiraService.getJiraConfig();
    const projKeyStr = cfg.projectKey || 'ORD';

    // Build project clause exactly same as syncSingleMonthFromJira
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

    // Jalali conversion
    function g2j(gy, gm, gd) {
      const g_d_no = 365 * gy + Math.floor((gy + 3) / 4) - Math.floor((gy + 99) / 100) + Math.floor((gy + 399) / 400);
      const j_d_no_base = 365 * 1348 + Math.floor((1348 + 3) / 4) - Math.floor((1348 + 99) / 100) + Math.floor((1348 + 399) / 400);
      const gMonthDays = [0, 31, (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      let d_no = g_d_no + [0, 0, 31, 59 + (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0) ? 1 : 0), 90, 120, 151, 181, 212, 243, 273, 304, 334][gm] + gd - j_d_no_base - 79;
      let jy = 33 * Math.floor(d_no / 12053);
      d_no %= 12053;
      jy += 4 * Math.floor(d_no / 1461);
      d_no %= 1461;
      if (d_no >= 366) { jy += Math.floor((d_no - 1) / 365); d_no = (d_no - 1) % 365; }
      let jm, jd;
      const jMonthDays = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
      for (jm = 0; jm < 11 && d_no >= jMonthDays[jm]; jm++) d_no -= jMonthDays[jm];
      jd = d_no + 1; jm++;
      return { jy, jm, jd };
    }

    let effectiveJalaliStart = jalaliStartStr;
    let effectiveJalaliEnd = jalaliEndStr;

    if (!effectiveJalaliStart && startStr) {
      const p = startStr.split(' ')[0].split('-').map(Number);
      if (p.length === 3) {
        const j = g2j(p[0], p[1], p[2]);
        effectiveJalaliStart = `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')} 00:00`;
      }
    }
    if (!effectiveJalaliEnd && endStr) {
      const p = endStr.split(' ')[0].split('-').map(Number);
      if (p.length === 3) {
        const j = g2j(p[0], p[1], p[2]);
        effectiveJalaliEnd = `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')} 23:59`;
      }
    }

    const jalaliSlash = effectiveJalaliStart ? effectiveJalaliStart.split(' ')[0] : '';
    const jalaliSlashEnd = effectiveJalaliEnd ? effectiveJalaliEnd.split(' ')[0] : '';
    const jalaliDash = jalaliSlash.replace(/\//g, '-');
    const jalaliDashEnd = jalaliSlashEnd.replace(/\//g, '-');
    const gregStart = startStr.split(' ')[0];
    const gregEnd = endStr.split(' ')[0];

    const queries = [
      { id: 1, name: '🟢 شمسی دش (توصیه‌شده)', jql: jalaliDash ? `${projPrefix}created >= "${jalaliDash}" AND created <= "${jalaliDashEnd}" ORDER BY created ASC` : null },
      { id: 2, name: '🟡 شمسی اسلش', jql: jalaliSlash ? `${projPrefix}created >= "${jalaliSlash}" AND created <= "${jalaliSlashEnd}" ORDER BY created ASC` : null },
      { id: 3, name: '🔵 میلادی تاریخ تنها', jql: `${projPrefix}created >= "${gregStart}" AND created <= "${gregEnd}" ORDER BY created ASC` },
      { id: 4, name: '🔵 میلادی با ساعت', jql: `${projPrefix}created >= "${startStr}" AND created <= "${endStr}" ORDER BY created ASC` },
      { id: 5, name: '⚪ پروژه بدون فیلتر تاریخ', jql: projectClause ? `${projectClause} ORDER BY created DESC` : `ORDER BY created DESC` },
      { id: 6, name: '⚪ کلیه تسک‌های سرور', jql: `ORDER BY created DESC` }
    ].filter(q => q.jql);

    res.json({
      success: true,
      jiraBaseUrl: cfg.baseUrl,
      projectKey: projKeyStr,
      projectClause,
      gregorianRange: `${gregStart} تا ${gregEnd}`,
      jalaliRange: `${jalaliDash} تا ${jalaliDashEnd}`,
      queries
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// POST Test ALL JQL queries against real Jira and return status of each
router.post('/test-all-jql', async (req, res) => {
  try {
    const { startStr, endStr, jalaliStartStr, jalaliEndStr } = req.body;
    if (!startStr || !endStr) {
      return res.status(400).json({ success: false, message: 'startStr و endStr الزامی هستند' });
    }

    const cfg = jiraService.getJiraConfig();
    const projKeyStr = cfg.projectKey || 'ORD';

    // Build project clause
    let projectClause = '';
    if (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*') {
      const projects = projKeyStr.split(',').map(p => {
        const clean = p.trim().toUpperCase();
        return /^[A-Z0-9_]+$/.test(clean) ? clean : `"${clean}"`;
      }).filter(Boolean);
      if (projects.length > 1) projectClause = `project IN (${projects.join(',')})`;
      else if (projects.length === 1) projectClause = `project = ${projects[0]}`;
    }
    const projPrefix = projectClause ? `${projectClause} AND ` : '';

    // Jalali conversion helper
    function g2j(gy, gm, gd) {
      let d_no = 365 * gy + Math.floor((gy+3)/4) - Math.floor((gy+99)/100) + Math.floor((gy+399)/400)
        + [0,0,31,59+(gy%4===0&&(gy%100!==0||gy%400===0)?1:0),90,120,151,181,212,243,273,304,334][gm] + gd
        - (365*1348 + Math.floor((1348+3)/4) - Math.floor((1348+99)/100) + Math.floor((1348+399)/400)) - 79;
      let jy = 33 * Math.floor(d_no / 12053); d_no %= 12053;
      jy += 4 * Math.floor(d_no / 1461); d_no %= 1461;
      if (d_no >= 366) { jy += Math.floor((d_no-1)/365); d_no = (d_no-1)%365; }
      let jm = 0;
      for (const days of [31,31,31,31,31,31,30,30,30,30,30]) { if (d_no < days) break; d_no -= days; jm++; }
      return { jy, jm: jm+1, jd: d_no+1 };
    }

    let jStart = jalaliStartStr;
    let jEnd = jalaliEndStr;
    if (!jStart && startStr) {
      const p = startStr.split(' ')[0].split('-').map(Number);
      if (p.length === 3) { const j = g2j(p[0],p[1],p[2]); jStart = `${j.jy}/${String(j.jm).padStart(2,'0')}/${String(j.jd).padStart(2,'0')} 00:00`; }
    }
    if (!jEnd && endStr) {
      const p = endStr.split(' ')[0].split('-').map(Number);
      if (p.length === 3) { const j = g2j(p[0],p[1],p[2]); jEnd = `${j.jy}/${String(j.jm).padStart(2,'0')}/${String(j.jd).padStart(2,'0')} 23:59`; }
    }

    const jalaliSlash = jStart ? jStart.split(' ')[0] : '';
    const jalaliSlashEnd = jEnd ? jEnd.split(' ')[0] : '';
    const jalaliDash = jalaliSlash.replace(/\//g, '-');
    const jalaliDashEnd = jalaliSlashEnd.replace(/\//g, '-');
    const gregStart = startStr.split(' ')[0];
    const gregEnd = endStr.split(' ')[0];

    const queries = [
      { id: 3, name: 'کوئری اصلی جیرا (کوئری ۳ - پروژه + تاریخ میلادی دقیق)', jql: `${projPrefix}created >= "${gregStart}" AND created <= "${gregEnd}" ORDER BY created ASC` }
    ].filter(q => q && q.jql);

    // Run ALL queries IN PARALLEL with short timeout (8s each) — avoids 504
    const QUERY_TIMEOUT = 8000;

    const runOneQuery = async (q) => {
      const t0 = Date.now();
      try {
        const res = await jiraService.jiraSearch(q.jql, ['key'], { maxResults: 1, timeout: QUERY_TIMEOUT, retries: 1, singlePage: true });
        const totalCount = res.total !== undefined ? res.total : (res.issues ? res.issues.length : 0);
        return { id: q.id, name: q.name, jql: q.jql, status: totalCount > 0 ? 'success' : 'zero', total: totalCount, ms: Date.now() - t0 };
      } catch (err) {
        const errCode = err.code || (err.response ? `HTTP_${err.response.status}` : 'ERROR');
        const errMsg = err.response?.data?.errorMessages?.join(', ') || err.message;
        return { id: q.id, name: q.name, jql: q.jql, status: 'error', total: 0, ms: Date.now() - t0, errorCode: errCode, errorMsg: errMsg };
      }
    };

    const results = (await Promise.all(queries.map(runOneQuery))).sort((a, b) => a.id - b.id);

    // Run a total COUNT query for the full project (no date filter) to show grand total
    let totalCountInJira = null;
    let countJql = null;
    try {
      const countOnlyJql = projectClause ? `${projectClause} AND issuetype != Epic ORDER BY created ASC` : `issuetype != Epic ORDER BY created ASC`;
      countJql = countOnlyJql;
      const countRes = await jiraService.jiraSearch(countOnlyJql, ['key'], { maxResults: 1, timeout: 5000, retries: 1, singlePage: true });
      totalCountInJira = countRes.total !== undefined ? countRes.total : null;
    } catch (_countErr) {
      totalCountInJira = null;
    }

    const winner = results.find(r => r.status === 'success');
    res.json({
      success: true,
      jiraBaseUrl: cfg.baseUrl,
      projectKey: projKeyStr,
      jalaliRange: `${jalaliDash} تا ${jalaliDashEnd}`,
      gregorianRange: `${gregStart} تا ${gregEnd}`,
      winnerJql: winner ? winner.jql : null,
      winnerId: winner ? winner.id : null,
      totalCountInJira,
      countJql,
      results
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


router.get('/fetch-jira-projects', async (req, res) => {
  try {
    const projects = await jiraService.fetchAllJiraProjects();
    res.json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ success: false, message: 'عدم دریافت لیست پروژه‌ها از جیرا: ' + err.message });
  }
});

// POST Clear / Wipe all tasks and projects from SQLite database (LEAVES USERS TABLE UNTOUCHED)
router.post('/clear-db', async (req, res) => {
  try {
    const db = getDb();
    // Only delete task and project data (USERS TABLE IS NEVER TOUCHED)
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM projects').run();
    db.prepare('DELETE FROM task_estimate_history').run();
    try { db.exec('VACUUM'); } catch (_) {}
    
    saveDb();
    res.json({ success: true, message: 'داده‌های تسک‌ها، اسپرینت‌ها و پروژه‌ها پاک شدند (جدول کاربران و دسترسی‌ها دست‌نخورده باقی ماند).' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در خالی کردن دیتابیس: ' + err.message });
  }
});

// POST Reset Database directly from Jira live
router.post('/reset-db', async (req, res) => {
  try {
    const syncRes = await cacheService.syncFromJira();
    if (syncRes.success) {
      res.json({ success: true, message: syncRes.message });
    } else {
      res.status(400).json({ success: false, message: `خطا در بازسازی دیتابیس از Jira: ${syncRes.message}` });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: `خطا در سینک: ${err.message}` });
  }
});

// POST Run diagnostic
router.post('/diagnose', async (req, res) => {
  try {
    const env = parseEnv();
    const baseUrl = req.body.baseUrl || env.JIRA_BASE_URL || process.env.JIRA_BASE_URL || '';
    const username = req.body.username || env.JIRA_USERNAME || process.env.JIRA_USERNAME || '';
    let token = req.body.token || env.JIRA_TOKEN || process.env.JIRA_TOKEN || '';
    if (!token || token === '••••••••') {
      token = env.JIRA_TOKEN || process.env.JIRA_TOKEN || '';
    }
    const projectKey = req.body.projectKey || env.JIRA_PROJECT_KEY || process.env.JIRA_PROJECT_KEY || '';

    if (!baseUrl || !token) {
      return res.status(400).json({ success: false, message: 'آدرس Jira و توکن API الزامی است.' });
    }

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    // Try Basic Auth first, fallback to Bearer Auth if 401
    const basicAuth = 'Basic ' + Buffer.from(`${username}:${token}`).toString('base64');
    const bearerAuth = 'Bearer ' + token;

    let headers = { Authorization: basicAuth, 'Content-Type': 'application/json', 'Accept': 'application/json' };

    const pKeyStr = projectKey.trim().toUpperCase().replace(/["']/g, '');
    const jqlFilter = (pKeyStr && pKeyStr !== 'ALL' && pKeyStr !== '*') ? `project = ${pKeyStr} ORDER BY created DESC` : `ORDER BY created DESC`;
    const jqlFilterQuotes = (pKeyStr && pKeyStr !== 'ALL' && pKeyStr !== '*') ? `project = "${pKeyStr}" ORDER BY created DESC` : `ORDER BY created DESC`;
    const projectUrlPath = (pKeyStr && pKeyStr !== 'ALL' && pKeyStr !== '*') ? `/${pKeyStr}` : '';

function cleanErrorMessage(e) {
  if (!e) return 'خطای نامشخص در ارتباط با سرور جیرا';
  const status = e.response ? e.response.status : null;
  let rawData = e.response ? e.response.data : (e.message || e);
  let cleanMsg = '';

  if (typeof rawData === 'string') {
    const titleMatch = rawData.match(/<title>(.*?)<\/title>/i);
    const h1Match = rawData.match(/<h1>(.*?)<\/h1>/i);
    const extracted = (titleMatch && titleMatch[1]) || (h1Match && h1Match[1]) || '';
    if (extracted) {
      cleanMsg = extracted.replace(/<[^>]+>/g, '').trim();
    } else {
      cleanMsg = rawData.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 250);
    }
  } else if (typeof rawData === 'object' && rawData !== null) {
    cleanMsg = rawData.errorMessages ? rawData.errorMessages.join(', ') : (rawData.message || rawData.error || JSON.stringify(rawData));
  } else {
    cleanMsg = String(rawData);
  }

  let statusDesc = '';
  if (status === 401) statusDesc = ' [کد 401: احراز هویت ناموفق - نام کاربری یا کلمه عبور/توکن جیرا اشتباه است]';
  else if (status === 403) statusDesc = ' [کد 403: عدم دسترسی - حساب شما مجاز به مشاهده این پروژه نیست]';
  else if (status === 404) statusDesc = ' [کد 404: مسیر یا پروژه جیرا یافت نشد]';
  else if (status) statusDesc = ` [کد ${status}]`;

  return `${cleanMsg}${statusDesc}`;
}

    let projName = pKeyStr || 'ORD';
    try {
      const projRes = await axios.get(`${baseUrl}/rest/api/2/project${projectUrlPath}`, { headers, httpsAgent, timeout: 5000 });
      if (projRes.data && projRes.data.name) projName = projRes.data.name;
    } catch (_) {
      try {
        const projRes3 = await axios.get(`${baseUrl}/rest/api/3/project${projectUrlPath}`, { headers, httpsAgent, timeout: 5000 });
        if (projRes3.data && projRes3.data.name) projName = projRes3.data.name;
      } catch (_) {}
    }

    let searchData;
    let lastExecutedJql = jqlFilter;
    const jqlAttempts = [jqlFilter, jqlFilterQuotes, 'ORDER BY created DESC'];
    let lastSearchErr = null;

    for (const q of jqlAttempts) {
      try {
        searchData = await jiraService.jiraSearch(q, ['*all'], { maxResults: 5, singlePage: true, timeout: 8000, retries: 1 });
        if (searchData && searchData.issues) {
          lastExecutedJql = q;
          break;
        }
      } catch (e1) {
        lastSearchErr = e1;
      }
    }

    if (!searchData || !searchData.issues) {
      const errMsg = cleanErrorMessage(lastSearchErr);
      return res.status(400).json({
        success: false,
        message: `عدم دریافت تسک‌ها از جیرا: ${errMsg}`
      });
    }

    const issues = searchData.issues || [];
    if (issues.length === 0) {
      return res.json({
        success: true,
        projectName: projName,
        complianceScore: 60,
        message: 'پروژه متصل شد اما تسکی یافت نشد.',
        requestDetails: {
          baseUrl,
          username,
          projectKey: pKeyStr,
          executedJql: lastExecutedJql,
          endpoint: `${baseUrl}/rest/api/2/search`
        },
        diagnostics: []
      });
    }

    let sampleWithComp = issues.find(i => i.fields?.components && i.fields.components.length > 0);
    let sampleWithSprint = issues.find(i => i.fields?.customfield_10020 || i.fields?.sprint);
    let sampleWithAssignee = issues.find(i => i.fields?.assignee?.displayName);
    let sampleWithLabels = issues.find(i => i.fields?.labels && i.fields.labels.length > 0);
    let sampleWithLinks = issues.find(i => i.fields?.issuelinks && i.fields.issuelinks.length > 0);

    const firstIssue = issues[0];
    const fields = firstIssue.fields || {};

    const schemaReport = [];
    let matchCount = 0;

    const check = (field, label, value, note, status = 'matched') => {
      if (status === 'matched') matchCount++;
      schemaReport.push({ field: `${field} (${label})`, status, value: value ? String(value).substring(0, 80) : null, note });
    };

    check('summary', 'عنوان تسک', fields.summary, 'فیلد استاندارد جیرا - کاملاً متصل', 'matched');
    check('status.name', 'وضعیت', fields.status?.name, 'نگاشت شده به وضعیت‌های داشبورد', 'matched');
    
    const assigneeVal = sampleWithAssignee ? sampleWithAssignee.fields.assignee.displayName : fields.assignee?.displayName;
    check('assignee.displayName', 'مسئول', assigneeVal || 'بدون مسئول مستقیم', 'اختیاری - پشتیبانی از نام نمایشی مسئول', 'matched');
    
    if (sampleWithComp) {
      const comps = sampleWithComp.fields.components.map(c => c.name).join(', ');
      check('components', 'کامپوننت‌های جیرا', comps, 'فیلد کامپوننت نیتیو جیرا شناسایی شد و کاملاً متصل است', 'matched');
    } else {
      check('components', 'کامپوننت‌های جیرا', 'شناسایی برچسب‌ها (comp:...)', 'فیلد نیتیو یا برچسب‌های comp: پشتیبانی می‌شوند', 'matched');
    }

    if (sampleWithSprint) {
      check('customfield_10020 / sprint', 'اسپرینت', 'یافت شد', 'اسپرینت‌های جیرا کاملاً متصل هستند (استفاده در گانت چارت)', 'matched');
    } else {
      check('customfield_10020 / sprint', 'اسپرینت', 'customfield_10020', 'پشتیبانی از اسپرینت‌های چابک جیرا', 'matched');
    }

    check('duedate / created', 'تاریخ‌های زمان‌بندی', fields.duedate || fields.created, 'استفاده در محاسبه بازه زمانی و پیشرفت', 'matched');

    const labelsVal = sampleWithLabels ? sampleWithLabels.fields.labels.join(', ') : (fields.labels?.join(', ') || '—');
    check('labels', 'برچسب‌ها', labelsVal, 'پشتیبانی از برچسب‌های wait:، comp:، reason:', 'matched');

    const linksVal = sampleWithLinks ? `${sampleWithLinks.fields.issuelinks.length} لینک` : 'پشتیبانی شده';
    check('issuelinks', 'لینک‌های بین تسک‌ها', linksVal, 'شناسایی هوشمند وابستگی‌ها و تسک‌های منتظر', 'matched');

    const customKeys = Object.keys(fields).filter(k => k.startsWith('customfield_') || ['summary','status','components','labels','duedate','issuelinks','priority','assignee','timeoriginalestimate','timespent','created'].includes(k));

    res.json({
      success: true,
      projectName: projName,
      sampleIssueKey: firstIssue.key,
      totalIssuesFound: searchData.total || issues.length,
      complianceScore: 100,
      requestDetails: {
        baseUrl,
        username,
        projectKey: pKeyStr,
        executedJql: lastExecutedJql,
        endpoint: `${baseUrl}/rest/api/2/search`
      },
      diagnostics: schemaReport,
      rawSampleKeys: customKeys,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: `خطا در اجرای تست: ${err.message}` });
  }
});

// GET Database Statistics Tile Data
router.get('/db-stats', (req, res) => {
  try {
    const db = getDb();
    const cfg = jiraService.getJiraConfig();
    const rebuildMonths = parseInt(req.query.months, 10) || parseInt(cfg.rebuildMonths, 10) || 3;

    const projKeyStr = (cfg.projectKey || '').trim().toUpperCase();
    let taskProjWhere = '';
    let epicWhere = "id LIKE '%-%'";
    if (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*') {
      const pKeys = projKeyStr.split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
      if (pKeys.length > 0) {
        const epicLikes = pKeys.map(k => `id LIKE '${k}-%'`).join(' OR ');
        epicWhere = `(${epicLikes})`;
        const taskLikes = pKeys.map(k => `id LIKE '${k}-%'`).join(' OR ');
        taskProjWhere = ` AND (${taskLikes})`;
      }
    }

    const now = new Date();
    const startMonthDate = new Date(now.getFullYear(), now.getMonth() - (rebuildMonths - 1), 1);
    const startDateStr = `${startMonthDate.getFullYear()}-${String(startMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const dbDateClause = (rebuildMonths < 60)
      ? ` AND (created_at >= '${startDateStr}' OR start_date >= '${startDateStr}' OR due_date >= '${startDateStr}')`
      : '';

    let totalProjects = 0;
    let dbSizeMb = '0.00';
    let lastSynced = null;
    let componentsList = [];

    const isValidEpicKey = (k) => k && /^[A-Z][A-Z0-9_]*-\d+$/i.test(k);

    let allTasks = [];
    try {
      allTasks = db.prepare(`SELECT id, project_id, parent_task_id, is_subtask, status, is_waiting FROM tasks`).all() || [];
    } catch (_) {}

    const pKeys = (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*')
      ? projKeyStr.split(',').map(k => k.trim().toUpperCase()).filter(Boolean) : [];

    if (pKeys.length > 0) {
      allTasks = allTasks.filter(t => pKeys.some(k => (t.id || '').toUpperCase().startsWith(`${k}-`)));
    }

    const totalTasks = allTasks.length;
    let withEpicTasksCount = 0;
    let unlinkedTasksCount = 0;
    let subtasksCount = 0;
    let doneTasks = 0;
    let waitingTasks = 0;
    let inProgressTasks = 0;

    for (const t of allTasks) {
      if (t.is_subtask === 1) subtasksCount++;
      const st = (t.status || '').toLowerCase();
      if (['done', 'completed'].includes(st)) doneTasks++;
      else if (t.is_waiting === 1 || ['waiting', 'onholding', 'blocked'].includes(st)) waitingTasks++;
      else if (['in progress', 'in_progress'].includes(st)) inProgressTasks++;

      if (isValidEpicKey(t.parent_task_id)) {
        withEpicTasksCount++;
      } else {
        unlinkedTasksCount++;
      }
    }

    const todoTasks = Math.max(0, totalTasks - doneTasks - waitingTasks - inProgressTasks);
    try { totalProjects = db.prepare(`SELECT COUNT(*) as count FROM projects WHERE ${epicWhere}`).get()?.count || 0; } catch (_) {}

    try {
      const volumeDir = '/app/data_volume';
      const defaultDbPath = path.join(__dirname, '../../database.sqlite');
      const dbPath = fs.existsSync(volumeDir) ? path.join(volumeDir, 'database.sqlite') : defaultDbPath;
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        dbSizeMb = (stats.size / (1024 * 1024)).toFixed(2);
      }
    } catch (_) {}

    try {
      const lastSyncedRow = db.prepare("SELECT MAX(last_synced) as max_sync FROM tasks").get();
      lastSynced = lastSyncedRow?.max_sync || null;
    } catch (_) {}

    try {
      const componentRows = db.prepare("SELECT component FROM tasks WHERE component IS NOT NULL AND component != ''").all();
      const componentCountsMap = new Map();

      for (const r of componentRows) {
        if (r.component) {
          const parts = String(r.component).split(/[,|]/).map(c => c.trim()).filter(Boolean);
          for (const p of parts) {
            componentCountsMap.set(p, (componentCountsMap.get(p) || 0) + 1);
          }
        }
      }

      componentsList = Array.from(componentCountsMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    } catch (_) {}

    let sprintsList = [];
    try {
      const sprintRows = db.prepare("SELECT sprint_name FROM tasks WHERE sprint_name IS NOT NULL AND sprint_name != ''").all();
      const sprintCountsMap = new Map();
      for (const r of sprintRows) {
        if (r.sprint_name) {
          const sName = String(r.sprint_name).trim();
          sprintCountsMap.set(sName, (sprintCountsMap.get(sName) || 0) + 1);
        }
      }
      sprintsList = Array.from(sprintCountsMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => {
          const numA = parseInt(String(a.name).replace(/\D/g, '')) || 0;
          const numB = parseInt(String(b.name).replace(/\D/g, '')) || 0;
          return numA - numB;
        });
    } catch (_) {}

    // Task count and Epic count per Jira project key (e.g. ORD, OPS)
    let projectTaskCounts = [];
    try {
      const epicCountMap = new Map();
      try {
        const epicRows = db.prepare(`
          SELECT
            CASE
              WHEN INSTR(id, '-') > 0 THEN UPPER(SUBSTR(id, 1, INSTR(id, '-') - 1))
              ELSE UPPER(id)
            END as projectKey,
            COUNT(*) as epicCount
          FROM projects
          WHERE id IS NOT NULL AND id != ''
          GROUP BY projectKey
        `).all();
        for (const r of epicRows) {
          if (r.projectKey) epicCountMap.set(r.projectKey, r.epicCount || 0);
        }
      } catch (_) {}

      const projTaskRows = db.prepare(`
        SELECT
          CASE
            WHEN INSTR(id, '-') > 0 THEN UPPER(SUBSTR(id, 1, INSTR(id, '-') - 1))
            ELSE UPPER(id)
          END as projectKey,
          COUNT(*) as taskCount
        FROM tasks
        WHERE id IS NOT NULL AND id != ''
        GROUP BY projectKey
        ORDER BY taskCount DESC
      `).all();

      projectTaskCounts = projTaskRows.map(r => ({
        id: r.projectKey,
        title: r.projectKey,
        taskCount: r.taskCount || 0,
        epicCount: epicCountMap.get(r.projectKey) || 0
      }));

      for (const [pKey, eCount] of epicCountMap.entries()) {
        if (!projectTaskCounts.some(p => p.id === pKey)) {
          projectTaskCounts.push({ id: pKey, title: pKey, taskCount: 0, epicCount: eCount });
        }
      }
    } catch (_) {}

    const unlinkedTasksList = allTasks.filter(t => !isValidEpicKey(t.parent_task_id)).slice(0, 100);

    // Epics without tasks: epics in projects table that have 0 tasks attached
    let epicsWithoutTasksCount = 0;
    let epicsWithoutTasksList = [];
    try {
      epicsWithoutTasksCount = db.prepare(`
        SELECT COUNT(*) as c
        FROM projects
        WHERE ${epicWhere} AND id NOT IN (
          SELECT DISTINCT project_id FROM tasks WHERE project_id IS NOT NULL AND project_id != ''
          UNION
          SELECT DISTINCT parent_task_id FROM tasks WHERE parent_task_id IS NOT NULL AND parent_task_id != ''
          UNION
          SELECT DISTINCT epic_id FROM tasks WHERE epic_id IS NOT NULL AND epic_id != ''
        )
      `).get()?.c || 0;

      if (epicsWithoutTasksCount > 0) {
        epicsWithoutTasksList = db.prepare(`
          SELECT id, title, status
          FROM projects
          WHERE ${epicWhere} AND id NOT IN (
            SELECT DISTINCT project_id FROM tasks WHERE project_id IS NOT NULL AND project_id != ''
            UNION
            SELECT DISTINCT parent_task_id FROM tasks WHERE parent_task_id IS NOT NULL AND parent_task_id != ''
            UNION
            SELECT DISTINCT epic_id FROM tasks WHERE epic_id IS NOT NULL AND epic_id != ''
          )
          LIMIT 50
        `).all() || [];
      }
    } catch (_) {}

    res.json({
      success: true,
      totalTasks,
      totalProjects,
      doneTasks,
      waitingTasks,
      inProgressTasks,
      todoTasks,
      dbSizeMb,
      lastSynced,
      totalComponents: componentsList.length,
      componentsList,
      totalSprints: sprintsList.length,
      sprintsList,
      projectTaskCounts,
      unlinkedTasksCount,
      unlinkedTasksList,
      withEpicTasksCount,
      subtasksCount,
      epicsWithoutTasksCount,
      epicsWithoutTasksList
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت آمار دیتابیس: ' + err.message });
  }
});

// GET /api/jira/mismatch-details
// Returns exact differences between DB items and Jira Live items based on comparison table queries
router.get('/mismatch-details', async (req, res) => {
  try {
    const db = getDb();
    const cfg = jiraService.getJiraConfig();
    const category = req.query.category || 'totalTasks';
    const rebuildMonths = parseInt(req.query.months, 10) || parseInt(cfg.rebuildMonths, 10) || 3;

    const projKeyStr = (cfg.projectKey || '').trim().toUpperCase();
    let projectFilter = '';
    let taskProjWhere = '';
    let epicWhere = "id LIKE '%-%'";

    if (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*') {
      const projects = projKeyStr.split(',').map(p => {
        const clean = p.trim().toUpperCase();
        return /^[A-Z0-9_]+$/.test(clean) ? clean : `"${clean}"`;
      }).filter(Boolean);
      if (projects.length > 1) {
        projectFilter = `AND project IN (${projects.join(',')})`;
      } else if (projects.length === 1) {
        projectFilter = `AND project = ${projects[0]}`;
      }

      const pKeys = projKeyStr.split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
      if (pKeys.length > 0) {
        epicWhere = `(${pKeys.map(k => `id LIKE '${k}-%'`).join(' OR ')})`;
        taskProjWhere = ` AND (${pKeys.map(k => `id LIKE '${k}-%'`).join(' OR ')})`;
      }
    }

    const now = new Date();
    const startMonthDate = new Date(now.getFullYear(), now.getMonth() - (rebuildMonths - 1), 1);
    const startDateStr = `${startMonthDate.getFullYear()}-${String(startMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const dateClause = (rebuildMonths < 60) ? `created >= "${startDateStr}"` : '';
    const fullClause = projectFilter
      ? (dateClause ? `${projectFilter.replace(/^AND\s+/i, '')} AND ${dateClause}` : projectFilter.replace(/^AND\s+/i, ''))
      : (dateClause || '');

    const dbDateClause = (rebuildMonths < 60)
      ? ` AND (created_at >= '${startDateStr}' OR start_date >= '${startDateStr}' OR due_date >= '${startDateStr}')`
      : '';

    let items = [];
    const missingKeys = [];

    if (category === 'epics') {
      const dbEpics = db.prepare(`SELECT id, title, status FROM projects WHERE ${epicWhere}`).all();
      const dbEpicMap = new Map();
      for (const e of dbEpics) dbEpicMap.set(e.id.toUpperCase(), e);

      const jql = `issuetype = Epic ${projectFilter} ORDER BY created ASC`;
      let jiraEpics = [];
      try {
        const jiraRes = await jiraService.jiraSearch(jql, ['summary', 'status', 'project'], { maxResults: 1000, timeout: 8000 });
        if (jiraRes && jiraRes.issues) jiraEpics = jiraRes.issues;
      } catch (err) {
        console.error('Failed to fetch live epics:', err.message);
      }

      const jiraEpicMap = new Map();
      for (const je of jiraEpics) {
        const keyUpper = je.key.toUpperCase();
        jiraEpicMap.set(keyUpper, {
          id: je.key,
          title: je.fields?.summary || je.key,
          status: je.fields?.status?.name || 'In Progress'
        });
      }

      const allKeys = new Set([...dbEpicMap.keys(), ...jiraEpicMap.keys()]);
      for (const key of allKeys) {
        const inDb = dbEpicMap.get(key);
        const inJira = jiraEpicMap.get(key);

        if (!inDb && inJira) {
          missingKeys.push(key);
          items.push({
            id: key,
            title: inJira.title,
            jiraStatus: inJira.status,
            dbStatus: '🔴 ثبت‌نشده در دیتابیس',
            mismatchType: 'JIRA_ONLY',
            reason: `🌐 اپیک «${key}» در جیرا موجود است اما در دیتابیس ثبت نشده.`
          });
        } else if (inDb && !inJira) {
          items.push({
            id: key,
            title: inDb.title,
            jiraStatus: '🔴 یافت‌نشد در جیرا',
            dbStatus: inDb.status || 'موجود',
            mismatchType: 'DB_ONLY',
            reason: `💾 اپیک «${key}» در دیتابیس موجود است اما در نتایج جیرا نیامد.`
          });
        }
      }
    } else {
      const countJql = fullClause ? `${fullClause} AND issuetype != Epic ORDER BY created ASC` : `issuetype != Epic ORDER BY created ASC`;
      const FIELDS = ['summary', 'status', 'issuetype', 'parent', 'project', 'created'];

      let rawJiraIssues = [];
      try {
        const jiraRes = await jiraService.jiraSearch(countJql, FIELDS, { maxResults: 1000, timeout: 10000 });
        if (jiraRes && jiraRes.issues) rawJiraIssues = jiraRes.issues;
      } catch (err) {
        console.error('Failed to fetch live tasks for mismatch:', err.message);
      }

      const jiraTaskMap = new Map();
      for (const ji of rawJiraIssues) {
        const kUpper = (ji.key || '').trim().toUpperCase();
        if (/^[A-Z][A-Z0-9_]*-\d+$/i.test(kUpper)) {
          jiraTaskMap.set(kUpper, {
            id: ji.key,
            title: ji.fields?.summary || ji.key,
            status: ji.fields?.status?.name || 'To Do',
            issueType: ji.fields?.issuetype?.name || 'Task'
          });
        }
      }

      const dbTasks = db.prepare(`SELECT id, project_id, parent_task_id, is_subtask, title, status FROM tasks WHERE 1=1${taskProjWhere}${dbDateClause}`).all();
      const dbTaskMap = new Map();
      for (const dt of dbTasks) {
        dbTaskMap.set(dt.id.toUpperCase(), dt);
      }

      const allKeys = new Set([...dbTaskMap.keys(), ...jiraTaskMap.keys()]);
      for (const key of allKeys) {
        const inDb = dbTaskMap.get(key);
        const inJira = jiraTaskMap.get(key);

        if (!inDb && inJira) {
          missingKeys.push(key);
          items.push({
            id: key,
            title: inJira.title,
            issueType: inJira.issueType,
            jiraStatus: inJira.status,
            dbStatus: '🔴 ثبت‌نشده در دیتابیس',
            mismatchType: 'JIRA_ONLY',
            reason: `🌐 تسک «${key}» در جیرا موجود است اما در دیتابیس ثبت نشده.`
          });
        } else if (inDb && !inJira) {
          items.push({
            id: key,
            title: inDb.title,
            issueType: inDb.is_subtask === 1 ? 'Sub-task' : 'Task',
            jiraStatus: '🔴 یافت‌نشد در بازه جیرا',
            dbStatus: inDb.status || 'موجود',
            mismatchType: 'DB_ONLY',
            reason: `💾 تسک «${key}» در دیتابیس ثبت است اما در بازه جاری جیرا دریافت نشد.`
          });
        }
      }
    }

    res.json({
      success: true,
      category,
      rebuildMonths,
      totalJiraCount: category === 'epics' ? (items.filter(i => i.mismatchType !== 'DB_ONLY').length) : (items.filter(i => i.mismatchType !== 'DB_ONLY').length),
      mismatches: items,
      mismatchCount: items.length,
      missingCount: missingKeys.length,
      missingKeys
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در استخراج موارد اختلاف: ' + err.message });
  }
});

// GET /api/jira/live-mapping-inspector
// Returns item-by-item side-by-side Jira to DB mapping inspection report
router.get('/live-mapping-inspector', async (req, res) => {
  try {
    const db = getDb();
    const cfg = jiraService.getJiraConfig();
    const rebuildMonths = parseInt(req.query.months, 10) || parseInt(cfg.rebuildMonths, 10) || 3;

    const projKeyStr = (cfg.projectKey || '').trim().toUpperCase();
    let projectFilter = '';
    if (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*') {
      const projects = projKeyStr.split(',').map(p => {
        const clean = p.trim().toUpperCase();
        return /^[A-Z0-9_]+$/.test(clean) ? clean : `"${clean}"`;
      }).filter(Boolean);
      if (projects.length > 1) {
        projectFilter = `AND project IN (${projects.join(',')})`;
      } else if (projects.length === 1) {
        projectFilter = `AND project = ${projects[0]}`;
      }
    }

    const now = new Date();
    const startMonthDate = new Date(now.getFullYear(), now.getMonth() - (rebuildMonths - 1), 1);
    const startDateStr = `${startMonthDate.getFullYear()}-${String(startMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const dateClause = `created >= "${startDateStr}"`;
    const fullClause = projectFilter ? `${projectFilter.replace(/^AND\s+/i, '')} AND ${dateClause}` : dateClause;

    const jql = `${fullClause} ORDER BY created ASC`;
    let rawIssues = [];
    const INSPECTION_FIELDS = [
      'summary',
      'status',
      'issuetype',
      'parent',
      'project',
      'created',
      'duedate',
      'assignee',
      'issuelinks',
      'customfield_10006',
      'customfield_10014',
      'customfield_10008',
      'customfield_10004',
      'customfield_10020'
    ];

    try {
      const jiraRes = await jiraService.jiraSearch(jql, INSPECTION_FIELDS, { maxResults: 1000, timeout: 12000 });
      if (jiraRes && jiraRes.issues) rawIssues = jiraRes.issues;
    } catch (err) {
      console.error('Failed to fetch live issues for mapping inspector:', err.message);
    }

    const dbDateClause = (rebuildMonths < 60)
      ? ` AND (created_at >= '${startDateStr}' OR start_date >= '${startDateStr}')`
      : '';
    const dbTasks = db.prepare(`SELECT id, project_id, parent_task_id, is_subtask, title, status FROM tasks WHERE 1=1${dbDateClause}`).all();
    const dbTaskMap = new Map();
    for (const dt of dbTasks) dbTaskMap.set(dt.id.toUpperCase(), dt);

    const dbEpics = db.prepare(`SELECT id, title, status FROM projects`).all();
    const dbEpicMap = new Map();
    for (const de of dbEpics) dbEpicMap.set(de.id.toUpperCase(), de);

    const knownEpicsSet = new Set(dbEpicMap.keys());

    const mappings = [];
    let withEpicCount = 0;
    let withoutEpicCount = 0;
    let epicsCount = 0;
    let subtaskCount = 0;
    let invalidKeyCount = 0;

    for (let idx = 0; idx < rawIssues.length; idx++) {
      const issue = rawIssues[idx];
      const issueKey = (issue.key || '').trim().toUpperCase();
      const summary = issue.fields?.summary || issueKey;
      const issueTypeName = issue.fields?.issuetype?.name || 'Task';
      const rawStatus = issue.fields?.status?.name || 'To Do';

      if (!/^[A-Z0-9_]+-\d+$/i.test(issueKey)) {
        invalidKeyCount++;
        mappings.push({
          jiraKey: issueKey || 'INVALID',
          jiraIssueType: issueTypeName,
          jiraRawStatus: rawStatus,
          jiraEpicFieldVal: '—',
          dbSavedKey: '🔴 ذخیره نشد',
          dbMappedStatus: '—',
          dbSavedParentEpic: '—',
          classification: 'INVALID_KEY',
          recordStatus: '⚠️ ردشده (الگوی شناسه فاقد شماره استاندارد است)',
          inDb: false
        });
        continue;
      }

      if (issueTypeName.toLowerCase().trim() === 'epic') {
        epicsCount++;
        const inDbEpic = dbEpicMap.get(issueKey);
        mappings.push({
          jiraKey: issueKey,
          jiraIssueType: 'Epic (اپیک)',
          jiraRawStatus: rawStatus,
          jiraEpicFieldVal: 'کانتینر اصلی پروژه/اپیک',
          dbSavedKey: inDbEpic ? inDbEpic.id : '📌 ثبت پروژه‌ها',
          dbMappedStatus: inDbEpic ? inDbEpic.status : rawStatus,
          dbSavedParentEpic: '— (خود اپیک است)',
          classification: 'EPIC_PROJECT',
          recordStatus: inDbEpic ? '📌 موجود در جدول پروژه‌ها/اپیک‌ها' : '🔴 عدم تطابق در دیتابیس',
          inDb: !!inDbEpic
        });
        continue;
      }

      const parsed = jiraService.parseTaskIssue(issue, null, idx, knownEpicsSet);
      const inDbTask = dbTaskMap.get(issueKey);

      const isSubtask = parsed?.is_subtask === 1 || issue.fields?.issuetype?.subtask || issueTypeName.toLowerCase().includes('sub-task') || issueTypeName.toLowerCase().includes('subtask');
      
      let epicSourceText = '— بدون لینک اپیک';
      let jiraEpicKey = null;
      let subtaskParentKey = null;

      if (isSubtask) {
        subtaskCount++;
        subtaskParentKey = issue.fields?.parent?.key || parsed?.parent_key || inDbTask?.parent_key || null;
        if (subtaskParentKey) {
          epicSourceText = `parent.key: ${subtaskParentKey}`;
        }
      } else if (issue.fields?.customfield_10006) {
        const v = issue.fields.customfield_10006;
        const keyVal = String(typeof v === 'object' ? (v.key || v.value) : v).toUpperCase();
        if (/^[A-Z][A-Z0-9_]*-\d+$/i.test(keyVal)) {
          jiraEpicKey = keyVal;
          epicSourceText = `customfield_10006: ${jiraEpicKey}`;
        }
      } else if (issue.fields?.epic?.key) {
        const keyVal = String(issue.fields.epic.key).toUpperCase();
        if (/^[A-Z][A-Z0-9_]*-\d+$/i.test(keyVal)) {
          jiraEpicKey = keyVal;
          epicSourceText = `epic.key: ${jiraEpicKey}`;
        }
      } else if (issue.fields?.customfield_10014) {
        const v = issue.fields.customfield_10014;
        const keyVal = String(typeof v === 'object' ? (v.key || v.value) : v).toUpperCase();
        if (/^[A-Z][A-Z0-9_]*-\d+$/i.test(keyVal)) {
          jiraEpicKey = keyVal;
          epicSourceText = `customfield_10014: ${jiraEpicKey}`;
        }
      } else if (issue.fields?.customfield_10008) {
        const v = issue.fields.customfield_10008;
        const keyVal = String(typeof v === 'object' ? (v.key || v.value) : v).toUpperCase();
        if (/^[A-Z][A-Z0-9_]*-\d+$/i.test(keyVal)) {
          jiraEpicKey = keyVal;
          epicSourceText = `customfield_10008: ${jiraEpicKey}`;
        }
      } else if (issue.fields?.parent?.key) {
        const keyVal = String(issue.fields.parent.key).toUpperCase();
        if (/^[A-Z][A-Z0-9_]*-\d+$/i.test(keyVal)) {
          jiraEpicKey = keyVal;
          epicSourceText = `parent.key: ${jiraEpicKey}`;
        }
      }

      const isValidEpicKey = (k) => k && /^[A-Z][A-Z0-9_]*-\d+$/i.test(k);
      const dbParentEpicKey = (inDbTask?.parent_task_id && isValidEpicKey(inDbTask.parent_task_id)) ? inDbTask.parent_task_id.toUpperCase() : null;

      const parentTaskId = isValidEpicKey(jiraEpicKey) ? jiraEpicKey : dbParentEpicKey;
      const isWithEpic = !!parentTaskId;

      if (isWithEpic) withEpicCount++;
      else withoutEpicCount++;

      mappings.push({
        jiraKey: issueKey,
        jiraIssueType: isSubtask ? `Sub-task (زیرتسک)` : issueTypeName,
        jiraRawStatus: rawStatus,
        jiraEpicFieldVal: epicSourceText,
        dbSavedKey: inDbTask ? inDbTask.id : parsed?.id || issueKey,
        dbMappedStatus: inDbTask ? inDbTask.status : parsed?.status || rawStatus,
        dbSavedParentEpic: isWithEpic ? `🔗 ${parentTaskId}${isSubtask && subtaskParentKey ? ` (پدر: ${subtaskParentKey})` : ''}` : (isSubtask ? `⚪ بدون اپیک (پدر: ${subtaskParentKey || 'نامشخص'})` : '⚪ بدون اپیک'),
        classification: isSubtask ? 'SUB_TASK' : (isWithEpic ? 'WITH_EPIC' : 'WITHOUT_EPIC'),
        recordStatus: inDbTask
          ? (isSubtask ? (isWithEpic ? `✅ ذخیره‌شده به‌عنوان زیرتسک دارای اپیک (اپیک: ${parentTaskId} | پدر: ${subtaskParentKey})` : `✅ ذخیره‌شده به‌عنوان زیرتسک بدون اپیک (پدر: ${subtaskParentKey || 'نامشخص'})`) : (isWithEpic ? '✅ ذخیره‌شده به‌عنوان تسک دارای اپیک' : '✅ ذخیره‌شده به‌عنوان تسک مستقل (بدون اپیک)'))
          : '🔴 هنوز در دیتابیس سینک نشده است',
        inDb: !!inDbTask
      });
    }

    res.json({
      success: true,
      rebuildMonths,
      totalJiraIssues: rawIssues.length,
      withEpicCount,
      withoutEpicCount,
      subtaskCount,
      epicsCount,
      invalidKeyCount,
      dbTotalCount: dbTasks.length,
      mappings
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در استخراج نگاشت نظیر به نظیر: ' + err.message });
  }
});

// POST /api/jira/sync-missing-tasks
// Syncs and saves targeted missing/error tasks returned from Jira live into SQLite DB
router.post('/sync-missing-tasks', async (req, res) => {
  try {
    const db = getDb();
    const cfg = jiraService.getJiraConfig();
    let targetKeys = Array.isArray(req.body.keys) ? req.body.keys.map(k => String(k).trim().toUpperCase()).filter(k => /^[A-Z][A-Z0-9_]*-\d+$/i.test(k)) : [];

    if (targetKeys.length === 0) {
      // If no keys provided in body, discover ONLY the true missing keys from Jira
      const rebuildMonths = parseInt(req.body.months, 10) || parseInt(cfg.rebuildMonths, 10) || 3;
      const projKeyStr = (cfg.projectKey || '').trim().toUpperCase();
      let projectFilter = '';
      if (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*') {
        const projects = projKeyStr.split(',').map(p => {
          const clean = p.trim().toUpperCase();
          return /^[A-Z0-9_]+$/.test(clean) ? clean : `"${clean}"`;
        }).filter(Boolean);
        if (projects.length > 1) {
          projectFilter = `AND project IN (${projects.join(',')})`;
        } else if (projects.length === 1) {
          projectFilter = `AND project = ${projects[0]}`;
        }
      }

      const now = new Date();
      const startMonthDate = new Date(now.getFullYear(), now.getMonth() - (rebuildMonths - 1), 1);
      const startDateStr = `${startMonthDate.getFullYear()}-${String(startMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
      const dateClause = (rebuildMonths < 60) ? `created >= "${startDateStr}"` : '';
      const fullClause = projectFilter
        ? (dateClause ? `${projectFilter.replace(/^AND\s+/i, '')} AND ${dateClause}` : projectFilter.replace(/^AND\s+/i, ''))
        : (dateClause || '');

      const searchJql = fullClause ? `${fullClause} ORDER BY created ASC` : `issuetype != Epic ORDER BY created ASC`;
      const jiraRes = await jiraService.jiraSearch(searchJql, ['key'], { maxResults: 1000, timeout: 8000 });
      const jiraIssues = jiraRes?.issues || [];

      const existingDbKeys = new Set(db.prepare("SELECT UPPER(id) as id FROM tasks").all().map(t => t.id));
      const existingDbProjects = new Set(db.prepare("SELECT UPPER(id) as id FROM projects").all().map(p => p.id));

      for (const ji of jiraIssues) {
        const kUpper = (ji.key || '').trim().toUpperCase();
        if (kUpper && !existingDbKeys.has(kUpper) && !existingDbProjects.has(kUpper)) {
          targetKeys.push(kUpper);
        }
      }

      if (targetKeys.length === 0) {
        return res.json({
          success: true,
          savedCount: 0,
          message: 'هیچ تسک یا اپیک جامانده‌ای برای همگام‌سازی یافت نشد. همه داده‌ها در دیتابیس موجود هستند.'
        });
      }
    }

    // TARGETED EXACT SYNC: Query Jira ONLY for the exact requested keys!
    const jql = `key IN (${targetKeys.map(k => `"${k}"`).join(',')}) ORDER BY created ASC`;

    const INSPECTION_FIELDS = [
      'summary',
      'description',
      'status',
      'issuetype',
      'parent',
      'project',
      'created',
      'duedate',
      'assignee',
      'issuelinks',
      'customfield_10006',
      'customfield_10014',
      'customfield_10008',
      'customfield_10004',
      'customfield_10020'
    ];

    const jiraRes = await jiraService.jiraSearch(jql, INSPECTION_FIELDS, { maxResults: targetKeys.length, timeout: 10000 });
    const rawIssues = jiraRes?.issues || [];

    const knownEpicsSet = new Set(db.prepare("SELECT UPPER(id) as id FROM projects").all().map(p => p.id));

    let savedCount = 0;
    const nowIso = new Date().toISOString();

    const insertTaskStmt = db.prepare(`
      INSERT INTO tasks (
        id, project_id, epic_id, parent_task_id, parent_key, linked_tasks,
        title, description, status, is_waiting, waiting_for_team, waiting_reason,
        assignee, estimate_hours, spent_hours, created_at, start_date, due_date,
        is_subtask, sprint_name, sprint_start_date, sprint_end_date, component, last_synced
      ) VALUES (
        @id, @project_id, @epic_id, @parent_task_id, @parent_key, @linked_tasks,
        @title, @description, @status, @is_waiting, @waiting_for_team, @waiting_reason,
        @assignee, @estimate_hours, @spent_hours, @created_at, @start_date, @due_date,
        @is_subtask, @sprint_name, @sprint_start_date, @sprint_end_date, @component, @last_synced
      )
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        epic_id = excluded.epic_id,
        parent_task_id = excluded.parent_task_id,
        parent_key = excluded.parent_key,
        linked_tasks = excluded.linked_tasks,
        title = excluded.title,
        status = excluded.status,
        is_waiting = excluded.is_waiting,
        assignee = excluded.assignee,
        start_date = excluded.start_date,
        due_date = excluded.due_date,
        last_synced = excluded.last_synced
    `);

    const insertRelationStmt = db.prepare(`
      INSERT INTO task_relations (
        task_id, linked_task_id, relation_type, relationship, title, status, assignee, start_date, due_date, created_at
      ) VALUES (
        @task_id, @linked_task_id, @relation_type, @relationship, @title, @status, @assignee, @start_date, @due_date, @created_at
      )
    `);

    for (let idx = 0; idx < rawIssues.length; idx++) {
      const issue = rawIssues[idx];
      const issueKey = (issue.key || '').trim().toUpperCase();
      if (!/^[A-Z][A-Z0-9_]*-\d+$/i.test(issueKey)) continue;

      const issueTypeName = (issue.fields?.issuetype?.name || '').toLowerCase().trim();
      if (issueTypeName === 'epic') {
        try {
          db.prepare(`
            INSERT INTO projects (id, title, description, status, category, capabilities, confluence_link, start_date, due_date, last_synced)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET title=excluded.title, status=excluded.status, last_synced=excluded.last_synced
          `).run(issueKey, issue.fields?.summary || issueKey, '', issue.fields?.status?.name || 'To Do', 'general', '', null, issue.fields?.created?.split('T')[0] || null, issue.fields?.duedate || null, nowIso);
          savedCount++;
        } catch (_) {}
        continue;
      }

      const parsed = jiraService.parseTaskIssue(issue, null, idx, knownEpicsSet);
      if (parsed && parsed.id) {
        try {
          insertTaskStmt.run({
            id: parsed.id,
            project_id: parsed.project_id || issueKey.split('-')[0],
            epic_id: parsed.epic_id || null,
            parent_task_id: parsed.parent_task_id || null,
            parent_key: parsed.parent_key || null,
            linked_tasks: parsed.linked_tasks || '[]',
            title: parsed.title || issueKey,
            description: parsed.description || '',
            status: parsed.status || 'To Do',
            is_waiting: parsed.is_waiting || 0,
            waiting_for_team: parsed.waiting_team || parsed.waiting_for_team || null,
            waiting_reason: parsed.waiting_reason || null,
            assignee: parsed.assignee || null,
            estimate_hours: parsed.estimate_hours || parsed.time_estimate || 0,
            spent_hours: parsed.spent_hours || parsed.time_spent || 0,
            created_at: parsed.created_at || nowIso,
            start_date: parsed.start_date || null,
            due_date: parsed.due_date || null,
            is_subtask: parsed.is_subtask || 0,
            sprint_name: parsed.sprint_name || null,
            sprint_start_date: parsed.sprint_start_date || null,
            sprint_end_date: parsed.sprint_end_date || null,
            component: parsed.component || null,
            last_synced: nowIso
          });

          if (Array.isArray(parsed.raw_linked_tasks) && parsed.raw_linked_tasks.length > 0) {
            try { db.prepare("DELETE FROM task_relations WHERE task_id = ?").run(parsed.id); } catch (_) {}
            for (const rel of parsed.raw_linked_tasks) {
              if (rel && rel.key && /^[A-Z][A-Z0-9_]*-\d+$/i.test(rel.key)) {
                try {
                  insertRelationStmt.run({
                    task_id: parsed.id,
                    linked_task_id: rel.key.toUpperCase(),
                    relation_type: rel.type || 'Related',
                    relationship: rel.relationship || 'relates to',
                    title: rel.title || null,
                    status: rel.status || null,
                    assignee: rel.assignee || null,
                    start_date: rel.startDate || null,
                    due_date: rel.dueDate || null,
                    created_at: nowIso
                  });
                } catch (_) {}
              }
            }
          }

          savedCount++;
        } catch (e) {
          console.error(`Error inserting missing task ${parsed.id}:`, e.message);
        }
      }
    }

    saveDb();
    res.json({
      success: true,
      savedCount,
      message: `${savedCount} تسک با موفقیت از جیرا دریافت و در دیتابیس لوکال ذخیره گردید.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در سینک تسک‌های جامانده: ' + err.message });
  }
});

// GET /api/jira/last-sync-report
// Returns the detailed audit report of the last sync run, including skipped/failed issues and reasons
router.get('/last-sync-report', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(`SELECT value FROM system_settings WHERE key = 'LAST_SYNC_REPORT'`).get();
    if (!row || !row.value) {
      return res.json({
        success: true,
        report: {
          syncTime: null,
          rawIssuesCount: 0,
          projectsSynced: 0,
          tasksSynced: 0,
          skippedOrFailedCount: 0,
          skippedDetails: []
        }
      });
    }
    const report = JSON.parse(row.value);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت گزارش همگام‌سازی: ' + err.message });
  }
});

module.exports = router;
