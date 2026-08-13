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
    statusMapping: jiraMapping.statusMapping || {},
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

    // Calculate configured rebuild date boundary (e.g. 1 month, 3 months, 60 months) starting from 1st of starting month
    const rebuildMonths = parseInt(cfg.rebuildMonths, 10) || 3;
    const now = new Date();
    const startMonthDate = new Date(now.getFullYear(), now.getMonth() - (rebuildMonths - 1), 1);
    const startDateStr = `${startMonthDate.getFullYear()}-${String(startMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
    const dateClause = `created >= "${startDateStr}"`;
    const fullClause = projectClause ? `${projectClause} AND ${dateClause}` : dateClause;

    // 1. Total Non-Epic Tasks Count JQL (Last 5 Years)
    const countJql = `${fullClause} AND issuetype != Epic`;

    const countRes = await jiraService.jiraSearch(countJql, ['key'], { maxResults: 1, timeout: 15000, retries: 2, singlePage: true });
    const total = countRes.total !== undefined ? countRes.total : 0;

    // 2. Direct Jira Query for Tasks Without Epic (Last 5 Years): "Epic Link" EMPTY
    let withoutEpicCount = 0;
    const withoutEpicJql = `${fullClause} AND issuetype != Epic AND "Epic Link" EMPTY`;

    try {
      const withoutRes = await jiraService.jiraSearch(withoutEpicJql, ['key'], { maxResults: 1, timeout: 10000, retries: 1, singlePage: true });
      if (withoutRes && withoutRes.total !== undefined) {
        withoutEpicCount = withoutRes.total;
      }
    } catch (e1) {
      // Fallback 1: "Epic Link" IS EMPTY
      try {
        const altJql = `${fullClause} AND issuetype != Epic AND "Epic Link" IS EMPTY`;
        const altRes = await jiraService.jiraSearch(altJql, ['key'], { maxResults: 1, timeout: 10000, retries: 1, singlePage: true });
        if (altRes && altRes.total !== undefined) {
          withoutEpicCount = altRes.total;
        }
      } catch (e2) {
        // Fallback 2: parent IS EMPTY
        try {
          const parentJql = `${fullClause} AND issuetype != Epic AND parent IS EMPTY`;
          const parentRes = await jiraService.jiraSearch(parentJql, ['key'], { maxResults: 1, timeout: 10000, retries: 1, singlePage: true });
          if (parentRes && parentRes.total !== undefined) {
            withoutEpicCount = parentRes.total;
          }
        } catch (e3) {
          withoutEpicCount = 0;
        }
      }
    }

    const withEpicCount = Math.max(0, total - withoutEpicCount);

    // 3. Epics Count JQL (All Epics in Project, without date bounds since Epics are standing containers)
    let jiraEpicsCount = 0;
    try {
      const epicJql = projectClause ? `${projectClause} AND issuetype = Epic` : `issuetype = Epic`;
      const epicRes = await jiraService.jiraSearch(epicJql, ['key'], { maxResults: 1, timeout: 10000, retries: 1, singlePage: true });
      jiraEpicsCount = epicRes.total !== undefined ? epicRes.total : 0;
    } catch (_) {}

    // 4. Calculate Epics without tasks from DB stats
    const db = getDb();
    const jiraEpicsWithoutTasksCount = db.prepare('SELECT COUNT(*) as c FROM projects WHERE id NOT IN (SELECT DISTINCT project_id FROM tasks WHERE project_id IS NOT NULL)').get()?.c || 0;

    res.json({
      success: true,
      total,
      withEpicCount,
      withoutEpicCount,
      jiraEpicsCount,
      jiraEpicsWithoutTasksCount,
      jql: countJql,
      withoutEpicJql,
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
        const res = await jiraService.jiraSearch(q.jql, null, { maxResults: 1, timeout: QUERY_TIMEOUT, retries: 1, singlePage: true });
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
      const countRes = await jiraService.jiraSearch(countOnlyJql, ['key'], { maxResults: 1, timeout: 10000, retries: 1, singlePage: true });
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
    let totalTasks = 0;
    let totalProjects = 0;
    let doneTasks = 0;
    let waitingTasks = 0;
    let inProgressTasks = 0;
    let dbSizeMb = '0.00';
    let lastSynced = null;
    let componentsList = [];

    try { totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks').get()?.count || 0; } catch (_) {}
    try { totalProjects = db.prepare('SELECT COUNT(*) as count FROM projects').get()?.count || 0; } catch (_) {}
    try { doneTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE LOWER(status) IN ('done', 'completed')").get()?.count || 0; } catch (_) {}
    try { waitingTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE is_waiting = 1 OR LOWER(status) IN ('waiting', 'onholding', 'blocked')").get()?.count || 0; } catch (_) {}
    try { inProgressTasks = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE LOWER(status) IN ('in progress', 'in_progress')").get()?.count || 0; } catch (_) {}

    const todoTasks = Math.max(0, totalTasks - doneTasks - waitingTasks - inProgressTasks);

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

    // Unlinked tasks: tasks whose project_id is NOT in projects table (or null/empty)
    let unlinkedTasksCount = 0;
    let unlinkedTasksList = [];
    try {
      unlinkedTasksCount = db.prepare(`
        SELECT COUNT(*) as c
        FROM tasks
        WHERE project_id NOT IN (SELECT id FROM projects) OR project_id IS NULL OR project_id = ''
      `).get().c || 0;

      if (unlinkedTasksCount > 0) {
        unlinkedTasksList = db.prepare(`
          SELECT id, title, project_id, status, assignee
          FROM tasks
          WHERE project_id NOT IN (SELECT id FROM projects) OR project_id IS NULL OR project_id = ''
          ORDER BY id DESC
          LIMIT 100
        `).all() || [];
      }
    } catch (_) {}

    // Epics without tasks: epics in projects table that have 0 tasks attached
    let epicsWithoutTasksCount = 0;
    let epicsWithoutTasksList = [];
    try {
      epicsWithoutTasksCount = db.prepare(`
        SELECT COUNT(*) as c
        FROM projects
        WHERE id NOT IN (SELECT DISTINCT project_id FROM tasks WHERE project_id IS NOT NULL AND project_id != '')
      `).get().c || 0;

      if (epicsWithoutTasksCount > 0) {
        epicsWithoutTasksList = db.prepare(`
          SELECT id, title, status
          FROM projects
          WHERE id NOT IN (SELECT DISTINCT project_id FROM tasks WHERE project_id IS NOT NULL AND project_id != '')
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
      epicsWithoutTasksCount,
      epicsWithoutTasksList
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت آمار دیتابیس: ' + err.message });
  }
});

module.exports = router;
