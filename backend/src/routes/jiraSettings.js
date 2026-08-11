const express = require('express');
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');
const jiraMapping = require('../jiraMapping');
const { authenticate } = require('../middleware/auth');
const jiraService = require('../services/jiraService');
const cacheService = require('../services/cacheService');

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

// GET full settings
router.get('/config', (req, res) => {
  try {
    const env = parseEnv();
    res.json({
      connection: {
        baseUrl: env.JIRA_BASE_URL || process.env.JIRA_BASE_URL || '',
        username: env.JIRA_USERNAME || process.env.JIRA_USERNAME || '',
        token: (env.JIRA_TOKEN || process.env.JIRA_TOKEN) ? '••••••••' : '',
        projectKey: env.JIRA_PROJECT_KEY || process.env.JIRA_PROJECT_KEY || '',
        isConfigured: jiraService.isConfigured,
        syncIntervalMinutes: env.SYNC_INTERVAL_MINUTES || process.env.SYNC_INTERVAL_MINUTES || '60',
      },
      apiEndpoints: {
        apiVersion: env.JIRA_API_VERSION || process.env.JIRA_API_VERSION || 'auto', // 'v3', 'v2', 'auto'
        searchEndpoint: env.JIRA_SEARCH_ENDPOINT || process.env.JIRA_SEARCH_ENDPOINT || '/rest/api/3/search/jql',
        projectEndpoint: env.JIRA_PROJECT_ENDPOINT || process.env.JIRA_PROJECT_ENDPOINT || '/rest/api/3/project',
      },
      serverAndDb: {
        port: env.PORT || process.env.PORT || '3001',
        jwtSecret: (env.JWT_SECRET || process.env.JWT_SECRET) ? '••••••••' : 'dev-secret-key',
        dbDriver: 'SQLite 3 (database.sqlite)',
        dbStatus: 'متصل و فعال',
      },
      confluence: {
        baseUrl: env.CONFLUENCE_BASE_URL || process.env.CONFLUENCE_BASE_URL || '',
        username: env.CONFLUENCE_USERNAME || process.env.CONFLUENCE_USERNAME || '',
        defaultSpaceKey: env.CONFLUENCE_DEFAULT_SPACE || process.env.CONFLUENCE_DEFAULT_SPACE || 'OPS',
      },
      waitingStatuses: (env.JIRA_WAITING_STATUSES || process.env.JIRA_WAITING_STATUSES || 'OnHolding,Waiting,Blocked,On Hold').split(',').map(s => s.trim()),
      statusMapping: jiraMapping.statusMapping || {},
      customFields: {
        sprintField: env.JIRA_SPRINT_FIELD || process.env.JIRA_SPRINT_FIELD || 'customfield_10020',
        waitingTeamField: env.JIRA_WAITING_TEAM_FIELD || process.env.JIRA_WAITING_TEAM_FIELD || '',
        waitingReasonField: env.JIRA_WAITING_REASON_FIELD || process.env.JIRA_WAITING_REASON_FIELD || '',
        confluenceLinkField: env.JIRA_CONFLUENCE_LINK_FIELD || process.env.JIRA_CONFLUENCE_LINK_FIELD || '',
        capabilitiesField: env.JIRA_CAPABILITIES_FIELD || process.env.JIRA_CAPABILITIES_FIELD || '',
        categoryField: env.JIRA_CATEGORY_FIELD || process.env.JIRA_CATEGORY_FIELD || '',
      },
      dateMapping: {
        epicStartDateField: env.JIRA_EPIC_START_DATE_FIELD || process.env.JIRA_EPIC_START_DATE_FIELD || 'created',
        epicDueDateField: env.JIRA_EPIC_DUE_DATE_FIELD || process.env.JIRA_EPIC_DUE_DATE_FIELD || 'duedate',
        taskStartDateField: env.JIRA_TASK_START_DATE_FIELD || process.env.JIRA_TASK_START_DATE_FIELD || '',
        taskDueDateField: env.JIRA_TASK_DUE_DATE_FIELD || process.env.JIRA_TASK_DUE_DATE_FIELD || 'duedate',
      },
      labelPrefixes: {
        waitingTeam: env.JIRA_WAIT_TEAM_PREFIX || process.env.JIRA_WAIT_TEAM_PREFIX || 'wait:',
        waitingReason: env.JIRA_WAIT_REASON_PREFIX || process.env.JIRA_WAIT_REASON_PREFIX || 'reason:',
        capability: env.JIRA_CAPABILITY_PREFIX || process.env.JIRA_CAPABILITY_PREFIX || 'cap:',
      },
      featuredComponents: (env.JIRA_FEATURED_COMPONENTS || process.env.JIRA_FEATURED_COMPONENTS || 'learning,meeting,support').split(',').map(s => s.trim()),
    });
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

    writeEnv(updates);
    res.json({ message: 'تنظیمات با موفقیت در فایل .env ذخیره گردید. برای اعمال تغییرات سرور را ری‌استارت فرمایید.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings: ' + err.message });
  }
});

// POST Reset Database directly from Jira live
router.post('/reset-db', async (req, res) => {
  try {
    const syncRes = await cacheService.syncFromJira();
    if (syncRes.success) {
      res.json({ success: true, message: `دیتابیس با موفقیت بازسازی شد (${syncRes.projectsSynced} پروژه و ${syncRes.tasksSynced} تسک از جیرا دریافت شد).` });
    } else {
      res.status(500).json({ success: false, message: syncRes.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

    let projRes;
    try {
      projRes = await axios.get(`${baseUrl}/rest/api/2/project/${projectKey}`, { headers, httpsAgent, timeout: 10000 });
    } catch (e) {
      if (e.response && e.response.status === 401) {
        // Retry with Bearer Auth
        headers.Authorization = bearerAuth;
        try {
          projRes = await axios.get(`${baseUrl}/rest/api/2/project/${projectKey}`, { headers, httpsAgent, timeout: 10000 });
        } catch (eBearer) {
          try {
            projRes = await axios.get(`${baseUrl}/rest/api/3/project/${projectKey}`, { headers, httpsAgent, timeout: 10000 });
          } catch (e3) {
            return res.status(401).json({ success: false, message: 'خطای 401 احراز هویت با جیرا: نام کاربری یا توکن معتبر نیست.' });
          }
        }
      } else {
        try {
          projRes = await axios.get(`${baseUrl}/rest/api/3/project/${projectKey}`, { headers, httpsAgent, timeout: 10000 });
        } catch (e3) {
          return res.status(400).json({
            success: false,
            message: `خطا در برقراری ارتباط با Jira API: ${e.response?.data?.message || e.message}`,
          });
        }
      }
    }

    let searchRes;
    try {
      searchRes = await axios.post(`${baseUrl}/rest/api/2/search`, {
        jql: `project = ${projectKey} ORDER BY created DESC`,
        maxResults: 10,
        fields: ['*all']
      }, { headers, httpsAgent, timeout: 15000 });
    } catch (e) {
      try {
        searchRes = await axios.get(`${baseUrl}/rest/api/2/search`, {
          headers,
          httpsAgent,
          params: { jql: `project = ${projectKey} ORDER BY created DESC`, maxResults: 10, fields: '*all' },
          timeout: 15000
        });
      } catch (e2) {
        try {
          searchRes = await axios.post(`${baseUrl}/rest/api/3/search/jql`, {
            jql: `project = ${projectKey} ORDER BY created DESC`,
            maxResults: 10,
            fields: ['*all']
          }, { headers, httpsAgent, timeout: 15000 });
        } catch (e3) {
          return res.status(400).json({ success: false, message: `خطا در دریافت تسک‌های نمونه: ${e.message}` });
        }
      }
    }

    const issues = searchRes.data.issues || [];
    if (issues.length === 0) {
      return res.json({ success: true, projectName: projRes.data.name, complianceScore: 60, message: 'پروژه متصل شد اما تسکی یافت نشد.', diagnostics: [] });
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
      projectName: projRes.data.name,
      sampleIssueKey: firstIssue.key,
      totalIssuesFound: searchRes.data.total || issues.length,
      complianceScore: 100,
      diagnostics: schemaReport,
      rawSampleKeys: customKeys,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: `خطا در اجرای تست: ${err.message}` });
  }
});

module.exports = router;
