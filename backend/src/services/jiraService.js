const axios = require('axios');
const https = require('https');
const jiraMapping = require('../jiraMapping');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

let config;
try {
  config = require('../config');
} catch (e) {
  require('dotenv').config();
  config = {
    jira: {
      baseUrl: process.env.JIRA_BASE_URL || '',
      username: process.env.JIRA_USERNAME || '',
      token: process.env.JIRA_TOKEN || '',
      projectKey: process.env.JIRA_PROJECT_KEY || 'OPS',
      isConfigured: !!(process.env.JIRA_BASE_URL && process.env.JIRA_TOKEN),
      mapping: jiraMapping
    }
  };
}

function getJiraConfig() {
  let dbSettingMap = {};
  try {
    const { getDb } = require('../db/database');
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM system_settings").all();
    for (const r of rows) {
      if (r.key && r.value !== null && r.value !== undefined) {
        dbSettingMap[r.key] = r.value;
      }
    }
  } catch (_) {}

  const baseUrl = (dbSettingMap['JIRA_BASE_URL'] || process.env.JIRA_BASE_URL || (config && config.jira && config.jira.baseUrl) || '').trim();
  const username = (dbSettingMap['JIRA_USERNAME'] || process.env.JIRA_USERNAME || (config && config.jira && config.jira.username) || '').trim();
  const token = (dbSettingMap['JIRA_TOKEN'] || process.env.JIRA_TOKEN || (config && config.jira && config.jira.token) || '').trim();
  const projectKey = (dbSettingMap['JIRA_PROJECT_KEY'] || process.env.JIRA_PROJECT_KEY || (config && config.jira && config.jira.projectKey) || 'ORD').trim();
  const isConfigured = !!(baseUrl && token);
  const currentMapping = (config && config.jira && config.jira.mapping) || jiraMapping;
  return {
    baseUrl,
    username,
    token,
    projectKey,
    isConfigured,
    mapping: currentMapping
  };
}

function getAuthHeaderVariants(username, token) {
  const list = [];
  if (token) {
    const trimmedToken = token.trim();
    const trimmedUser = (username || '').trim();
    if (trimmedToken.startsWith('Basic ') || trimmedToken.startsWith('Bearer ')) {
      list.push(trimmedToken);
    } else {
      // Prioritize Bearer Auth for Jira Personal Access Tokens (PAT)
      list.push('Bearer ' + trimmedToken);
      if (trimmedUser) {
        list.push('Basic ' + Buffer.from(`${trimmedUser}:${trimmedToken}`).toString('base64'));
      }
      list.push('Basic ' + trimmedToken);
    }
  }
  return list;
}

function getAuthHeader() {
  const cfg = getJiraConfig();
  const variants = getAuthHeaderVariants(cfg.username, cfg.token);
  return variants[0] || '';
}

// Helper to extract date from issue fields according to mapping
function extractDateField(issue, fieldName) {
  if (!issue || !issue.fields || !fieldName) return null;
  
  const val = issue.fields[fieldName];
  if (!val) return null;
  
  if (typeof val === 'string') {
    return val.split('T')[0];
  }
  return null;
}

// Perform JQL Search with retry & automatic pagination logic to fetch ALL matching issues
async function jiraSearch(jql, fields = [], options = {}) {
  const cfg = getJiraConfig();
  const authVariants = getAuthHeaderVariants(cfg.username, cfg.token);
  const standardFields = ['summary', 'description', 'status', 'assignee', 'created', 'duedate', 'project', 'priority', 'labels', 'components', 'issuelinks', 'parent', 'issuetype', 'timeoriginalestimate', 'timespent', 'aggregatetimeoriginalestimate', 'aggregatetimespent'];
  const validFields = (fields && fields.length > 0) ? fields.filter(Boolean) : standardFields;
  const isCloud = cfg.baseUrl && cfg.baseUrl.includes('.atlassian.net');

  const pageSize = options.maxResults || 500;
  const timeout = options.timeout || 8000;
  const retries = options.retries || 1;

  let lastError = null;

  for (const authHeader of authVariants) {
    let headers = { 
      Authorization: authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    let authSuccess = false;
    let allIssues = [];
    let totalCount = 0;
    let startAt = 0;

    while (true) {
      let pageData = null;

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const endpoint = isCloud ? `${cfg.baseUrl}/rest/api/3/search/jql` : `${cfg.baseUrl}/rest/api/2/search`;
          const postBody = { jql, fields: validFields, maxResults: pageSize, startAt };

          const response = await axios.post(endpoint, postBody, { headers, httpsAgent, timeout });
          pageData = response.data;
          authSuccess = true;
          break;
        } catch (err) {
          lastError = err;
          if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            break;
          }
          console.log(`[JiraSearch Attempt ${attempt + 1}/${retries}] Error: ${err.code || err.message}`);
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (!authSuccess || !pageData) break;

      const pageIssues = pageData.issues || [];
      allIssues.push(...pageIssues);
      totalCount = pageData.total || allIssues.length;

      if (
        allIssues.length >= totalCount ||
        pageIssues.length === 0 ||
        (options.maxResults && allIssues.length >= options.maxResults) ||
        options.singlePage
      ) {
        return { total: totalCount, issues: allIssues };
      }

      startAt += pageIssues.length;
    }

    if (authSuccess) {
      return { total: totalCount, issues: allIssues };
    }
  }

  if (lastError && lastError.response && lastError.response.status === 403 && jql.includes('project')) {
    const fallbackJql = jql.replace(/AND\s+project\s*=\s*"[^"]+"/gi, '').replace(/project\s*=\s*"[^"]+"/gi, '').trim();
    if (fallbackJql && fallbackJql !== jql) {
      console.log(`[JiraSearch 403 Fallback] Retrying search without project filter: ${fallbackJql}`);
      try {
        return await jiraSearch(fallbackJql, fields, { ...options, retries: 1 });
      } catch (_) {}
    }
  }

  if (lastError) throw lastError;
  throw new Error('Jira search failed due to authentication or network error');
}

function parseJiraDescription(desc) {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (typeof desc === 'object' && desc.content && Array.isArray(desc.content)) {
    try {
      const texts = [];
      for (const block of desc.content) {
        if (block.content && Array.isArray(block.content)) {
          for (const item of block.content) {
            if (item.text) texts.push(item.text);
          }
        }
      }
      return texts.join(' ');
    } catch {
      return '';
    }
  }
  return '';
}

// Fetch all epics from the configured project
async function fetchEpics() {
  const cfg = getJiraConfig();
  if (!cfg.isConfigured) return [];
  const mapping = cfg.mapping || jiraMapping;
  const customFields = mapping.customFields || {};
  try {
    const projKeyStr = cfg.projectKey;
    let projectFilter = '';
    if (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*') {
      const projects = projKeyStr.split(',').map(p => {
        const clean = p.trim().toUpperCase();
        return /^[A-Z0-9_]+$/.test(clean) ? clean : `"${clean}"`;
      }).filter(p => p !== '""' && p !== '');
      if (projects.length > 1) {
        projectFilter = `AND project IN (${projects.join(',')})`;
      } else if (projects.length === 1) {
        projectFilter = `AND project = ${projects[0]}`;
      }
    }
    const jql = `issuetype=Epic ${projectFilter} ORDER BY created DESC`;
    const fields = [
      'summary', 
      'description', 
      'status', 
      'duedate', 
      'created',
      'labels', 
      'components',
      mapping.dateMapping.epicStartDateField, 
      mapping.dateMapping.epicDueDateField,
      customFields.confluenceLinkField,
      customFields.capabilitiesField,
      customFields.categoryField
    ];
    
    const data = await jiraSearch(jql, fields);
    const allIssues = data.issues || [];

    return allIssues.map(issue => {
      // 1. Extract Confluence Link (Custom Field, Description, or Config Fallback)
      let confluenceLink = null;
      if (customFields.confluenceLinkField && issue.fields?.[customFields.confluenceLinkField]) {
        confluenceLink = issue.fields[customFields.confluenceLinkField];
      } else {
        const descText = parseJiraDescription(issue.fields?.description);
        const confMatch = descText.match(/https?:\/\/[^\s"]*confluence[^\s"]*/i);
        if (confMatch) confluenceLink = confMatch[0];
      }

      // Fallback to configured Confluence Base URL if no explicit link found
      if (!confluenceLink && mapping.confluence?.baseUrl) {
        const space = mapping.confluence.defaultSpaceKey || 'OPS';
        confluenceLink = `${mapping.confluence.baseUrl}/display/${space}/${issue.key}`;
      }

      // 2. Extract Capabilities (Custom Field or Labels)
      let capabilities = '';
      if (customFields.capabilitiesField && issue.fields?.[customFields.capabilitiesField]) {
        const val = issue.fields[customFields.capabilitiesField];
        capabilities = Array.isArray(val) ? val.join('|') : String(val);
      } else {
        const labels = issue.fields?.labels || [];
        const capPrefix = mapping.labelPrefixes.capability;
        capabilities = labels
          .filter(l => l.startsWith(capPrefix))
          .map(l => l.replace(capPrefix, ''))
          .join('|');
      }

      // 3. Extract Category (Custom Field -> Component -> Labels)
      let category = 'general';
      if (customFields.categoryField && issue.fields?.[customFields.categoryField]) {
        category = String(issue.fields[customFields.categoryField]).toLowerCase();
      } else if (issue.fields?.components && issue.fields.components.length > 0) {
        category = issue.fields.components[0].name.toLowerCase();
      } else {
        const labels = issue.fields?.labels || [];
        const categoryMap = mapping.categoryMapping || {};
        for (const [key, value] of Object.entries(categoryMap)) {
          if (labels.some(l => l.toLowerCase() === key.toLowerCase())) {
            category = value;
            break;
          }
        }
      }

      // 4. Extract Dates
      const startDate = extractDateField(issue, mapping.dateMapping.epicStartDateField) || extractDateField(issue, 'created');
      const dueDate = extractDateField(issue, mapping.dateMapping.epicDueDateField) || extractDateField(issue, 'duedate');

      const rawStatus = issue.fields?.status?.name || 'To Do';
      const mappedStatus = mapping.statusMapping[rawStatus] || rawStatus;

      return {
        id: issue.key,
        title: issue.fields?.summary || issue.key,
        description: parseJiraDescription(issue.fields?.description),
        status: mappedStatus,
        category,
        capabilities,
        confluence_link: confluenceLink,
        start_date: startDate,
        due_date: dueDate
      };
    });
  } catch (err) {
    console.error('Error fetching epics from Jira:', err.message);
    throw err;
  }
}

// Fetch all tasks (stories/tasks/sub-tasks) under an epic
async function fetchTasksForEpic(epicKey) {
  const cfg = getJiraConfig();
  if (!cfg.isConfigured) return [];
  const mapping = cfg.mapping || jiraMapping;
  const customFields = mapping.customFields || {};
  try {
    const jql = `("Epic Link" = ${epicKey} OR parent = ${epicKey}) ORDER BY rank ASC`;
    const fields = [
      'summary', 
      'description',
      'status', 
      'assignee', 
      'timeoriginalestimate', 
      'timespent', 
      'aggregatetimeoriginalestimate',
      'aggregatetimespent',
      'issuetype',
      'parent',
      'created', 
      'duedate', 
      'priority', 
      'labels', 
      'sprint', 
      'customfield_10004',
      'customfield_10020',
      'issuelinks',
      mapping.dateMapping.taskStartDateField,
      mapping.dateMapping.taskDueDateField,
      customFields.sprintField,
      customFields.waitingTeamField,
      customFields.waitingReasonField
    ];

    const data = await jiraSearch(jql, fields);
    const allIssues = data.issues || [];

    return allIssues.map((issue, index) => {
      const rawStatus = issue.fields?.status?.name || 'To Do';
      const mappedStatus = mapping.statusMapping[rawStatus] || rawStatus;

      let isWaiting = mapping.waitingStatuses.some(ws => 
        rawStatus.toLowerCase() === ws.toLowerCase()
      ) ? 1 : 0;

      // Issue links check
      const issueLinks = issue.fields?.issuelinks || [];
      let linkedWaitingTeam = null;
      let linkedWaitingReason = null;

      for (const link of issueLinks) {
        const linkType = link.type || {};
        const inwardDesc = (linkType.inward || '').toLowerCase();
        const outwardDesc = (linkType.outward || '').toLowerCase();

        const blockingKeywords = ['is blocked by', 'depends on', 'is waited on by'];
        const linkedIssue = link.inwardIssue || null;

        if (linkedIssue && blockingKeywords.some(kw => inwardDesc.includes(kw))) {
          isWaiting = 1;
          if (linkedIssue.fields) {
            if (linkedIssue.fields.assignee) {
              linkedWaitingTeam = linkedWaitingTeam || linkedIssue.fields.assignee.displayName;
            }
            if (linkedIssue.fields.project) {
              linkedWaitingTeam = linkedWaitingTeam || linkedIssue.fields.project.name;
            }
          }
          linkedWaitingReason = `بلاک شده توسط ${linkedIssue.key}: ${linkedIssue.fields?.summary || ''}`;
        }

        const outLinkedIssue = link.outwardIssue || null;
        if (outLinkedIssue && blockingKeywords.some(kw => outwardDesc.includes(kw))) {
          isWaiting = 1;
          if (outLinkedIssue.fields) {
            if (outLinkedIssue.fields.assignee) {
              linkedWaitingTeam = linkedWaitingTeam || outLinkedIssue.fields.assignee.displayName;
            }
            if (outLinkedIssue.fields.project) {
              linkedWaitingTeam = linkedWaitingTeam || outLinkedIssue.fields.project.name;
            }
          }
          linkedWaitingReason = `وابسته به ${outLinkedIssue.key}: ${outLinkedIssue.fields?.summary || ''}`;
        }
      }

      // Sprint Schedule Map for realistic staggered Gantt dates (April to September 2026)
      const sprintSchedule = {
        1:  { start: '2026-04-15', due: '2026-05-10' },
        2:  { start: '2026-05-01', due: '2026-06-05' },
        3:  { start: '2026-05-20', due: '2026-06-25' },
        4:  { start: '2026-06-05', due: '2026-07-10' },
        5:  { start: '2026-06-20', due: '2026-07-25' },
        6:  { start: '2026-07-05', due: '2026-08-10' },
        7:  { start: '2026-07-20', due: '2026-08-25' },
        8:  { start: '2026-08-01', due: '2026-09-05' },
        9:  { start: '2026-08-12', due: '2026-09-15' },
        10: { start: '2026-08-20', due: '2026-09-25' }
      };

      // Extract Sprint Number
      const rawLabels = issue.fields?.labels || [];
      const sprintLabelObj = rawLabels.find(l => typeof l === 'string' && l.startsWith('sprint:'));
      let sprintNum = 10;
      if (sprintLabelObj) {
        sprintNum = parseInt(sprintLabelObj.replace('sprint:', '').trim()) || 10;
      }

      const sched = sprintSchedule[sprintNum] || sprintSchedule[10];

      let startDate = extractDateField(issue, mapping.dateMapping.taskStartDateField);
      let dueDate = extractDateField(issue, mapping.dateMapping.taskDueDateField) || extractDateField(issue, 'duedate');

      if (!startDate || startDate === '2026-08-09') {
        startDate = sched.start;
      }
      if (!dueDate) {
        dueDate = sched.due;
      }

      // Sprint Extraction (Custom Field or Default Field)
      let sprintName = `Sprint ${sprintNum}`;
      let sprintStartDate = sched.start;
      let sprintEndDate = sched.due;

      const sprintFieldVal = (customFields.sprintField && issue.fields?.[customFields.sprintField])
        || issue.fields?.sprint 
        || issue.fields?.customfield_10004
        || issue.fields?.customfield_10020;

      if (sprintFieldVal) {
        const sprint = Array.isArray(sprintFieldVal) ? sprintFieldVal[sprintFieldVal.length - 1] : sprintFieldVal;
        if (sprint) {
          if (typeof sprint === 'string') {
            const nameMatch = sprint.match(/name=([^,\]]+)/);
            if (nameMatch && nameMatch[1] && nameMatch[1] !== '<null>') {
              sprintName = nameMatch[1].trim();
            } else if (!sprint.includes('com.atlassian.')) {
              sprintName = sprint.trim();
            }
            const startMatch = sprint.match(/startDate=([^,\]]+)/);
            if (startMatch && startMatch[1] && startMatch[1] !== '<null>') {
              sprintStartDate = startMatch[1].split('T')[0];
            }
            const endMatch = sprint.match(/endDate=([^,\]]+)/);
            if (endMatch && endMatch[1] && endMatch[1] !== '<null>') {
              sprintEndDate = endMatch[1].split('T')[0];
            }
          } else if (typeof sprint === 'object') {
            sprintName = sprint.name || sprintName;
            sprintStartDate = sprint.startDate ? sprint.startDate.split('T')[0] : sprintStartDate;
            sprintEndDate = sprint.endDate ? sprint.endDate.split('T')[0] : sprintEndDate;
          }
        }
      }

      // Waiting Team & Reason Extraction (Custom Fields, Labels, or Issue Links)
      let rawWaitingTeam = customFields.waitingTeamField ? issue.fields?.[customFields.waitingTeamField] : null;
      let waitingForTeam = null;
      if (rawWaitingTeam) {
        if (Array.isArray(rawWaitingTeam)) {
          waitingForTeam = rawWaitingTeam.map(item => typeof item === 'object' ? (item.name || item.value || JSON.stringify(item)) : String(item)).join(', ');
        } else if (typeof rawWaitingTeam === 'object') {
          waitingForTeam = rawWaitingTeam.name || rawWaitingTeam.value || String(rawWaitingTeam);
        } else {
          waitingForTeam = String(rawWaitingTeam);
        }
      }
      let waitingReason = customFields.waitingReasonField ? issue.fields?.[customFields.waitingReasonField] : null;

      if (!waitingForTeam || !waitingReason) {
        const labels = issue.fields?.labels || [];
        const waitTeamPrefix = mapping.labelPrefixes.waitingTeam;
        const waitReasonPrefix = mapping.labelPrefixes.waitingReason;

        for (const label of labels) {
          if (!waitingForTeam && label.startsWith(waitTeamPrefix)) {
            waitingForTeam = label.replace(waitTeamPrefix, '').replace(/-/g, ' ');
          }
          if (!waitingReason && label.startsWith(waitReasonPrefix)) {
            waitingReason = label.replace(waitReasonPrefix, '').replace(/-/g, ' ');
          }
        }
      }

      if (!waitingForTeam && linkedWaitingTeam) waitingForTeam = linkedWaitingTeam;
      if (!waitingReason && linkedWaitingReason) waitingReason = linkedWaitingReason;

      if (waitingForTeam || waitingReason) {
        isWaiting = 1;
      }

      let finalStatus = mappedStatus;
      if (isWaiting && mappedStatus !== 'Done') {
        const labelsStr = JSON.stringify(issue.fields?.labels || []).toLowerCase();
        const summaryStr = (issue.fields?.summary || '').toLowerCase();
        if (labelsStr.includes('onhold') || summaryStr.includes('آن‌هولد') || summaryStr.includes('onholding')) {
          finalStatus = 'OnHolding';
        } else {
          finalStatus = 'Waiting';
        }
      }

      // Fully Dynamic Jira Component extraction (handles unlimited Jira components)
      let component = 'dev';
      const jiraComponents = issue.fields?.components || [];
      const labelsArr = issue.fields?.labels || [];

      if (jiraComponents.length > 0) {
        component = (jiraComponents[0].name || '').toLowerCase().trim();
      } else {
        const compLabel = labelsArr.find(l => typeof l === 'string' && l.startsWith('comp:'));
        if (compLabel) {
          component = compLabel.replace('comp:', '').toLowerCase().trim();
        } else {
          component = 'dev';
        }
      }

      const estSec = issue.fields?.aggregatetimeoriginalestimate || issue.fields?.timeoriginalestimate || 0;
      const spentSec = issue.fields?.aggregatetimespent || issue.fields?.timespent || 0;
      const isSubtask = issue.fields?.issuetype?.subtask ? 1 : 0;
      const parentTaskId = issue.fields?.parent?.key || null;

      return {
        id: issue.key,
        project_id: epicKey,
        title: issue.fields?.summary || issue.key,
        description: parseJiraDescription(issue.fields?.description),
        status: finalStatus,
        assignee: issue.fields?.assignee ? issue.fields.assignee.displayName : null,
        estimate_hours: estSec ? Math.round((estSec / 3600) * 100) / 100 : 0,
        spent_hours: spentSec ? Math.round((spentSec / 3600) * 100) / 100 : 0,
        start_date: startDate,
        due_date: dueDate,
        is_waiting: isWaiting,
        waiting_for_team: waitingForTeam,
        waiting_reason: waitingReason,
        sprint_name: sprintName,
        sprint_start_date: sprintStartDate,
        sprint_end_date: sprintEndDate,
        priority: issue.fields?.priority ? issue.fields.priority.name : 'Medium',
        labels: JSON.stringify(issue.fields?.labels || []),
        component: component,
        sort_order: index,
        is_subtask: isSubtask,
      };
    });
  } catch (err) {
    console.error(`Error fetching tasks for epic ${epicKey}:`, err.message);
    throw err;
  }
}
function parseTaskIssue(issue, epicKeyOverride = null, index = 0) {
  const cfg = getJiraConfig();
  const mapping = cfg.mapping || jiraMapping;
  const customFields = mapping.customFields || {};

  let epicKey = epicKeyOverride;
  if (!epicKey) {
    if (issue.fields?.epic?.key) {
      epicKey = issue.fields.epic.key;
    } else if (issue.fields?.customfield_10014) {
      epicKey = issue.fields.customfield_10014;
    } else if (issue.fields?.parent && issue.fields.parent.fields?.issuetype?.name === 'Epic') {
      epicKey = issue.fields.parent.key;
    }
  }

  const rawStatus = issue.fields?.status?.name || 'To Do';
  const mappedStatus = mapping.statusMapping[rawStatus] || rawStatus;

  let isWaiting = mapping.waitingStatuses.some(ws => 
    rawStatus.toLowerCase() === ws.toLowerCase()
  ) ? 1 : 0;

  const issueLinks = issue.fields?.issuelinks || [];
  let linkedWaitingTeam = null;
  let linkedWaitingReason = null;

  for (const link of issueLinks) {
    const linkType = link.type || {};
    const inwardDesc = (linkType.inward || '').toLowerCase();
    const outwardDesc = (linkType.outward || '').toLowerCase();
    const blockingKeywords = ['is blocked by', 'depends on', 'is waited on by'];

    const linkedIssue = link.inwardIssue || null;
    if (linkedIssue && blockingKeywords.some(kw => inwardDesc.includes(kw))) {
      isWaiting = 1;
      if (linkedIssue.fields) {
        if (linkedIssue.fields.assignee) {
          linkedWaitingTeam = linkedWaitingTeam || linkedIssue.fields.assignee.displayName;
        }
        if (linkedIssue.fields.project) {
          linkedWaitingTeam = linkedWaitingTeam || linkedIssue.fields.project.name;
        }
      }
      linkedWaitingReason = `بلاک شده توسط ${linkedIssue.key}: ${linkedIssue.fields?.summary || ''}`;
    }

    const outLinkedIssue = link.outwardIssue || null;
    if (outLinkedIssue && blockingKeywords.some(kw => outwardDesc.includes(kw))) {
      isWaiting = 1;
      if (outLinkedIssue.fields) {
        if (outLinkedIssue.fields.assignee) {
          linkedWaitingTeam = linkedWaitingTeam || outLinkedIssue.fields.assignee.displayName;
        }
        if (outLinkedIssue.fields.project) {
          linkedWaitingTeam = linkedWaitingTeam || outLinkedIssue.fields.project.name;
        }
      }
      linkedWaitingReason = `وابسته به ${outLinkedIssue.key}: ${outLinkedIssue.fields?.summary || ''}`;
    }
  }

  let startDate = extractDateField(issue, mapping.dateMapping.taskStartDateField);
  let dueDate = extractDateField(issue, mapping.dateMapping.taskDueDateField) || extractDateField(issue, 'duedate');

  let sprintName = null;
  let sprintStartDate = null;
  let sprintEndDate = null;

  const sprintFieldVal = (customFields.sprintField && issue.fields?.[customFields.sprintField])
    || issue.fields?.sprint 
    || issue.fields?.customfield_10004
    || issue.fields?.customfield_10020;

  if (sprintFieldVal) {
    const sprint = Array.isArray(sprintFieldVal) ? sprintFieldVal[sprintFieldVal.length - 1] : sprintFieldVal;
    if (sprint) {
      if (typeof sprint === 'string') {
        const nameMatch = sprint.match(/name=([^,\]]+)/);
        if (nameMatch && nameMatch[1] && nameMatch[1] !== '<null>') {
          sprintName = nameMatch[1].trim();
        } else if (!sprint.includes('com.atlassian.')) {
          sprintName = sprint.trim();
        }
      } else if (typeof sprint === 'object') {
        sprintName = sprint.name || sprintName;
        sprintStartDate = sprint.startDate ? sprint.startDate.split('T')[0] : sprintStartDate;
        sprintEndDate = sprint.endDate ? sprint.endDate.split('T')[0] : sprintEndDate;
      }
    }
  }

  let rawWaitingTeam = customFields.waitingTeamField ? issue.fields?.[customFields.waitingTeamField] : null;
  let waitingForTeam = null;
  if (rawWaitingTeam) {
    if (Array.isArray(rawWaitingTeam)) {
      waitingForTeam = rawWaitingTeam.map(item => typeof item === 'object' ? (item.name || item.value || JSON.stringify(item)) : String(item)).join(', ');
    } else if (typeof rawWaitingTeam === 'object') {
      waitingForTeam = rawWaitingTeam.name || rawWaitingTeam.value || String(rawWaitingTeam);
    } else {
      waitingForTeam = String(rawWaitingTeam);
    }
  }
  let waitingReason = customFields.waitingReasonField ? issue.fields?.[customFields.waitingReasonField] : null;

  if (!waitingForTeam || !waitingReason) {
    const labels = issue.fields?.labels || [];
    const waitTeamPrefix = mapping.labelPrefixes.waitingTeam;
    const waitReasonPrefix = mapping.labelPrefixes.waitingReason;

    for (const label of labels) {
      if (!waitingForTeam && label.startsWith(waitTeamPrefix)) {
        waitingForTeam = label.replace(waitTeamPrefix, '').replace(/-/g, ' ');
      }
      if (!waitingReason && label.startsWith(waitReasonPrefix)) {
        waitingReason = label.replace(waitReasonPrefix, '').replace(/-/g, ' ');
      }
    }
  }

  if (!waitingForTeam && linkedWaitingTeam) waitingForTeam = linkedWaitingTeam;
  if (!waitingReason && linkedWaitingReason) waitingReason = linkedWaitingReason;

  if (waitingForTeam || waitingReason) {
    isWaiting = 1;
  }

  let finalStatus = mappedStatus;
  if (isWaiting && mappedStatus !== 'Done') {
    const labelsStr = JSON.stringify(issue.fields?.labels || []).toLowerCase();
    const summaryStr = (issue.fields?.summary || '').toLowerCase();
    if (labelsStr.includes('onhold') || summaryStr.includes('آن‌هولد') || summaryStr.includes('onholding')) {
      finalStatus = 'OnHolding';
    } else {
      finalStatus = 'Waiting';
    }
  }

  let component = 'dev';
  const jiraComponents = issue.fields?.components || [];
  const labelsArr = issue.fields?.labels || [];

  if (jiraComponents.length > 0) {
    component = (jiraComponents[0].name || '').toLowerCase().trim();
  } else {
    const compLabel = labelsArr.find(l => typeof l === 'string' && l.startsWith('comp:'));
    if (compLabel) {
      component = compLabel.replace('comp:', '').toLowerCase().trim();
    } else {
      component = 'dev';
    }
  }

  const estSec = issue.fields?.aggregatetimeoriginalestimate || issue.fields?.timeoriginalestimate || 0;
  const spentSec = issue.fields?.aggregatetimespent || issue.fields?.timespent || 0;
  const isSubtask = issue.fields?.issuetype?.subtask ? 1 : 0;
  const parentTaskId = issue.fields?.parent?.key || null;

  return {
    id: issue.key,
    project_id: epicKey,
    title: issue.fields?.summary || issue.key,
    description: parseJiraDescription(issue.fields?.description),
    status: finalStatus,
    assignee: issue.fields?.assignee ? issue.fields.assignee.displayName : null,
    estimate_hours: estSec ? Math.round((estSec / 3600) * 100) / 100 : 0,
    spent_hours: spentSec ? Math.round((spentSec / 3600) * 100) / 100 : 0,
    start_date: startDate,
    due_date: dueDate,
    is_waiting: isWaiting,
    waiting_for_team: waitingForTeam,
    waiting_reason: waitingReason,
    sprint_name: sprintName,
    sprint_start_date: sprintStartDate,
    sprint_end_date: sprintEndDate,
    priority: issue.fields?.priority ? issue.fields.priority.name : 'Medium',
    labels: JSON.stringify(issue.fields?.labels || []),
    component: component,
    sort_order: index,
    is_subtask: isSubtask,
    parent_task_id: parentTaskId
  };
}

async function fetchAllJiraProjects() {
  const { baseUrl, username, token } = getJiraConfig();
  if (!baseUrl || !token) throw new Error('تنظیمات آدرس یا توکن جیرا وارد نشده است.');

  // Get local DB epic counts per project key
  let epicCountsMap = new Map();
  try {
    const { getDb } = require('../db/database');
    const db = getDb();
    const rows = db.prepare('SELECT id FROM projects').all();
    for (const row of rows) {
      const pKey = row.id ? String(row.id).split('-')[0].toUpperCase() : '';
      if (pKey) {
        epicCountsMap.set(pKey, (epicCountsMap.get(pKey) || 0) + 1);
      }
    }
  } catch (_) {}

  const headersVariants = getAuthHeaderVariants(username, token);
  let projectsList = [];

  for (const h of headersVariants) {
    try {
      const res = await axios.get(`${baseUrl}/rest/api/2/project`, {
        headers: { Authorization: h, Accept: 'application/json' },
        httpsAgent,
        timeout: 6000
      });
      if (Array.isArray(res.data) && res.data.length > 0) {
        projectsList = res.data.map(p => {
          const keyUpper = p.key ? p.key.toUpperCase() : '';
          return {
            key: p.key,
            name: p.name || p.key,
            id: p.id || p.key,
            epicCount: epicCountsMap.get(keyUpper) || 0
          };
        });
        break;
      }
    } catch (_) {}
  }

  if (projectsList.length === 0) {
    try {
      const searchRes = await jiraSearch('ORDER BY created DESC', ['project'], { maxResults: 1000, timeout: 10000 });
      if (searchRes && searchRes.issues) {
        const pMap = new Map();
        for (const issue of searchRes.issues) {
          if (issue.fields?.project) {
            const p = issue.fields.project;
            const keyUpper = p.key ? p.key.toUpperCase() : '';
            pMap.set(p.key, {
              key: p.key,
              name: p.name || p.key,
              id: p.id || p.key,
              epicCount: epicCountsMap.get(keyUpper) || 0
            });
          }
        }
        projectsList = Array.from(pMap.values());
      }
    } catch (_) {}
  }

  if (projectsList.length === 0) {
    const currentKeys = (getJiraConfig().projectKey || 'ORD').split(',').map(k => k.trim());
    projectsList = currentKeys.map(k => {
      const keyUpper = k.toUpperCase();
      return {
        key: k,
        name: `پروژه ${k}`,
        id: k,
        epicCount: epicCountsMap.get(keyUpper) || 0
      };
    });
  }

  return projectsList;
}

module.exports = {
  get isConfigured() {
    return getJiraConfig().isConfigured;
  },
  getJiraConfig,
  jiraSearch,
  fetchEpics,
  fetchTasksForEpic,
  fetchAllJiraProjects,
  parseTaskIssue
};
