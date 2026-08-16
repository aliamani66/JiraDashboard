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
  try { require('dotenv').config({ path: require('path').join(__dirname, '../../.env') }); } catch (_) {}
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
  
  const mockMode = process.env.ENABLE_LOCAL_MOCK === 'true' || dbSettingMap['JIRA_MOCK_MODE'] === 'true';
  const isConfigured = mockMode || !!(baseUrl && token);
  const currentMapping = (config && config.jira && config.jira.mapping) || jiraMapping;

  let statusMappingObj = currentMapping.statusMapping || {};
  if (dbSettingMap['JIRA_STATUS_MAPPING']) {
    try {
      const rawSm = dbSettingMap['JIRA_STATUS_MAPPING'];
      statusMappingObj = typeof rawSm === 'object' ? rawSm : JSON.parse(rawSm);
    } catch (_) {}
  }

  const effectiveMapping = {
    ...currentMapping,
    statusMapping: statusMappingObj,
    customFields: {
      ...currentMapping.customFields,
      epicLinkField: dbSettingMap['JIRA_EPIC_LINK_FIELD'] || currentMapping.customFields?.epicLinkField || 'customfield_10006',
      sprintField: dbSettingMap['JIRA_SPRINT_FIELD'] || currentMapping.customFields?.sprintField || 'customfield_10004',
      waitingTeamField: dbSettingMap['JIRA_WAITING_TEAM_FIELD'] || currentMapping.customFields?.waitingTeamField || '',
      waitingReasonField: dbSettingMap['JIRA_WAITING_REASON_FIELD'] || currentMapping.customFields?.waitingReasonField || '',
      confluenceLinkField: dbSettingMap['JIRA_CONFLUENCE_LINK_FIELD'] || currentMapping.customFields?.confluenceLinkField || '',
      capabilitiesField: dbSettingMap['JIRA_CAPABILITIES_FIELD'] || currentMapping.customFields?.capabilitiesField || '',
      categoryField: dbSettingMap['JIRA_CATEGORY_FIELD'] || currentMapping.customFields?.categoryField || ''
    }
  };

  return {
    baseUrl: mockMode ? 'https://mock.jira.local (حالت داده تستی / ماک)' : baseUrl,
    username,
    token,
    projectKey,
    mockMode,
    isConfigured,
    mapping: effectiveMapping
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
  if (cfg.mockMode) {
    const mockJiraService = require('./mockJiraService');
    return mockJiraService.mockJiraSearch(jql, fields, options);
  }
  const authVariants = getAuthHeaderVariants(cfg.username, cfg.token);
  
  // Build lean fields list including custom mapped fields (replaces heavy '*all')
  const activeLeanFields = [
    'summary',
    'description',
    'status',
    'issuetype',
    'parent',
    'project',
    'assignee',
    'created',
    'duedate',
    'timeoriginalestimate',
    'timespent',
    'aggregatetimeoriginalestimate',
    'aggregatetimespent',
    'priority',
    'labels',
    'components',
    'issuelinks',
    'sprint',
    'customfield_10004',
    'customfield_10020',
    'customfield_10006',
    'customfield_10014',
    'customfield_10008',
    'epic'
  ];
  const customFields = cfg.mapping?.customFields || {};
  const dateMapping = cfg.mapping?.dateMapping || {};
  for (const f of [
    customFields.sprintField,
    customFields.waitingTeamField,
    customFields.waitingReasonField,
    customFields.confluenceLinkField,
    customFields.capabilitiesField,
    customFields.categoryField,
    dateMapping.taskStartDateField,
    dateMapping.taskDueDateField,
    dateMapping.epicStartDateField,
    dateMapping.epicDueDateField
  ]) {
    if (f && !activeLeanFields.includes(f)) {
      activeLeanFields.push(f);
    }
  }

  const validFields = (fields && fields.length > 0) ? fields.filter(Boolean) : activeLeanFields;
  const isCloud = cfg.baseUrl && cfg.baseUrl.includes('.atlassian.net');

  const pageSize = options.maxResults || 500;
  const timeout = options.timeout || 30000;
  const retries = options.retries || 2;

  let lastError = null;

  for (const authHeader of authVariants) {
    let headers = { 
      Authorization: authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    let startAt = 0;
    let authSuccess = false;
    let allIssues = [];
    let totalCount = 0;

    while (true) {
      let pageData = null;

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const endpoint = `${cfg.baseUrl}/rest/api/2/search`;
          const postBody = { jql, fields: validFields, maxResults: pageSize, startAt };

          let response;
          try {
            response = await axios.post(endpoint, postBody, { headers, httpsAgent, timeout });
          } catch (postErr) {
            // Fallback to GET method if POST fails
            const getUrl = `${cfg.baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${pageSize}&startAt=${startAt}`;
            response = await axios.get(getUrl, { headers, httpsAgent, timeout });
          }

          pageData = response.data;
          authSuccess = true;
          break;
        } catch (err) {
          lastError = err;
          if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            break;
          }
          const jiraMsg = err.response?.data?.errorMessages?.join(', ') || (err.response?.data?.errors ? JSON.stringify(err.response.data.errors) : '') || '';
          console.log(`[JiraSearch Attempt ${attempt + 1}/${retries}] Error: ${err.code || err.message} ${jiraMsg ? `(Jira: ${jiraMsg})` : ''} - JQL: "${jql}"`);
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

// Fetch all epics (or recent epics if days is provided) from the configured project(s)
async function fetchEpics(days = null) {
  const cfg = getJiraConfig();
  if (!cfg.isConfigured) return [];
  const mapping = cfg.mapping || jiraMapping;
  const customFields = mapping.customFields || {};
  try {
    const projKeyStr = cfg.projectKey || '';
    const configuredProjKeysList = (projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*')
      ? projKeyStr.split(',').map(p => p.trim().toUpperCase().replace(/["']/g, '')).filter(Boolean)
      : [];

    let dateFilter = '';
    if (days && typeof days === 'number' && days > 0) {
      const pastDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      const pastDateStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}`;
      dateFilter = `AND (created >= "${pastDateStr}" OR updated >= "${pastDateStr}")`;
    }

    const fields = [
      '*navigable',
      'summary', 
      'description', 
      'status', 
      'duedate', 
      'created',
      'labels', 
      'components',
      'issuelinks',
      'assignee',
      'priority',
      'project',
      'issuetype',
      mapping.dateMapping.epicStartDateField, 
      mapping.dateMapping.epicDueDateField,
      customFields.confluenceLinkField,
      customFields.capabilitiesField,
      customFields.categoryField
    ].filter(Boolean);

    let allIssues = [];

    if (configuredProjKeysList.length > 1) {
      // Fetch epics for each configured project individually
      const epicPromises = configuredProjKeysList.map(async (pKey) => {
        const jqlSingle = `project = "${pKey}" AND issuetype = Epic ${dateFilter} ORDER BY created DESC`;
        try {
          const res = await jiraSearch(jqlSingle, fields, { maxResults: 2000 });
          return res.issues || [];
        } catch (err) {
          console.warn(`[fetchEpics] Warning fetching epics for ${pKey}:`, err.message);
          return [];
        }
      });

      const results = await Promise.all(epicPromises);
      const seenKeys = new Set();
      for (const issueList of results) {
        for (const iss of issueList) {
          if (iss && iss.key && !seenKeys.has(iss.key.toUpperCase())) {
            seenKeys.add(iss.key.toUpperCase());
            allIssues.push(iss);
          }
        }
      }
    } else {
      let projectFilter = '';
      if (configuredProjKeysList.length === 1) {
        projectFilter = `project = "${configuredProjKeysList[0]}" AND `;
      }
      const jql = `${projectFilter}issuetype = Epic ${dateFilter} ORDER BY created DESC`;
      try {
        const data = await jiraSearch(jql, fields, { maxResults: 2000 });
        allIssues = data.issues || [];
      } catch (err) {
        console.warn('[fetchEpics] Warning fetching epics:', err.message);
        allIssues = [];
      }
    }

    const filteredIssues = allIssues.filter(issue => {
      const issueKey = (issue.key || '').trim().toUpperCase();
      if (!/^[A-Z0-9_]+-\d+$/i.test(issueKey)) return false;
      const issueProjKey = (issue.fields?.project?.key || issueKey.split('-')[0] || '').toUpperCase();
      const issueTypeName = (issue.fields?.issuetype?.name || '').toLowerCase().trim();
      const isEpicType = issueTypeName === 'epic' || issueTypeName === 'اپیک' || !!issue.fields?.['customfield_10008'] || !!issue.fields?.['Epic Name'] || !!issue.fields?.[customFields.epicNameField];
      const isConfiguredProj = configuredProjKeysList.length > 0 ? configuredProjKeysList.includes(issueProjKey) : true;
      return isEpicType && isConfiguredProj;
    });

    return filteredIssues.map(issue => {
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

      // 5. Extract Full Labels (from standard 'labels' field AND any custom multi-select / label fields)
      const labelSet = new Set();
      if (Array.isArray(issue.fields?.labels)) {
        for (const l of issue.fields.labels) {
          if (typeof l === 'string' && l.trim()) labelSet.add(l.trim());
          else if (l && typeof l === 'object') {
            const val = l.value || l.name || l.label;
            if (val) labelSet.add(String(val).trim());
          }
        }
      }
      // Inspect all fields on the issue for any custom multi-select labels
      if (issue.fields && typeof issue.fields === 'object') {
        for (const [fKey, fVal] of Object.entries(issue.fields)) {
          if (fKey.startsWith('customfield_') && fVal) {
            if (Array.isArray(fVal)) {
              for (const item of fVal) {
                if (typeof item === 'string' && item.trim()) {
                  labelSet.add(item.trim());
                } else if (item && typeof item === 'object') {
                  const val = item.value || item.name || item.label;
                  if (val && typeof val === 'string' && val.trim()) {
                    labelSet.add(val.trim());
                  }
                }
              }
            } else if (typeof fVal === 'string' && (/\d{4}/.test(fVal) || /Q[1-4]/i.test(fVal) || /فصل|بهار|تابستان|پاییز|زمستان/.test(fVal))) {
              labelSet.add(fVal.trim());
            } else if (typeof fVal === 'object' && fVal.value) {
              labelSet.add(String(fVal.value).trim());
            }
          }
        }
      }
      const labels = Array.from(labelSet);
      const rawLinks = Array.isArray(issue.fields?.issuelinks) ? issue.fields.issuelinks : (Array.isArray(issue.fields?.linkedIssues) ? issue.fields.linkedIssues : []);
      const linkedTasks = [];
      const relationsToSave = [];

      for (const link of rawLinks) {
        const relType = link.type?.name || link.type || 'Related';
        const candidates = [
          { item: link.inwardIssue || link.inward, rel: link.type?.inward || link.inward || 'is related to', dir: 'inward' },
          { item: link.outwardIssue || link.outward, rel: link.type?.outward || link.outward || 'relates to', dir: 'outward' },
          { item: link.otherIssue || link.issue || link.target, rel: relType, dir: 'other' }
        ];

        for (const cand of candidates) {
          const target = cand.item;
          if (target && typeof target === 'object' && target.key) {
            if (!linkedTasks.some(lt => lt.key === target.key)) {
              const linkTitle = target.fields?.summary || target.summary || target.key;
              const linkStatus = target.fields?.status?.name || (typeof target.status === 'object' ? target.status?.name : target.status) || 'To Do';
              const linkAssignee = target.fields?.assignee ? (target.fields.assignee.displayName || target.fields.assignee.name) : (typeof target.assignee === 'object' ? target.assignee.displayName : target.assignee) || null;
              const linkStartDate = target.fields?.created ? target.fields.created.split('T')[0] : null;
              const linkDueDate = target.fields?.duedate || target.duedate || null;

              linkedTasks.push({
                key: target.key,
                type: relType,
                linkType: relType,
                relationship: cand.rel,
                direction: cand.dir,
                title: linkTitle,
                status: linkStatus,
                assignee: linkAssignee,
                start_date: linkStartDate,
                due_date: linkDueDate
              });

              relationsToSave.push({
                task_id: issue.key,
                linked_task_id: target.key.toUpperCase(),
                relation_type: relType,
                relationship: cand.rel,
                title: linkTitle,
                status: linkStatus,
                assignee: linkAssignee,
                start_date: linkStartDate,
                due_date: linkDueDate
              });
            }
          }
        }
      }

      return {
        id: issue.key,
        title: issue.fields?.summary || issue.key,
        description: parseJiraDescription(issue.fields?.description),
        status: mappedStatus,
        category,
        capabilities,
        confluence_link: confluenceLink,
        start_date: startDate,
        due_date: dueDate,
        labels: JSON.stringify(labels),
        assignee: issue.fields?.assignee ? issue.fields.assignee.displayName : null,
        priority: issue.fields?.priority?.name || 'Medium',
        linked_tasks: JSON.stringify(linkedTasks),
        raw_relations: relationsToSave
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
    const cleanEpicKey = epicKey.trim().toUpperCase();
    const customEpicField = customFields.epicLinkField || 'customfield_10006';
    
    // Robust JQL to capture ALL issues linked to this Epic in Jira (Epic Link, Parent, customfield, or Linked Issues)
    const jqlCandidates = [
      `("Epic Link" = "${cleanEpicKey}" OR parent = "${cleanEpicKey}" OR "${customEpicField}" = "${cleanEpicKey}" OR issue in linkedIssues("${cleanEpicKey}")) ORDER BY created ASC`,
      `("Epic Link" = "${cleanEpicKey}" OR parent = "${cleanEpicKey}") ORDER BY created ASC`,
      `parent = "${cleanEpicKey}" ORDER BY created ASC`
    ];

    const fields = [
      '*navigable',
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
      'issuelinks',
      mapping.dateMapping.taskStartDateField,
      mapping.dateMapping.taskDueDateField,
      customFields.sprintField,
      customFields.waitingTeamField,
      customFields.waitingReasonField
    ].filter(Boolean);

    let allIssues = [];
    for (const jql of jqlCandidates) {
      try {
        const data = await jiraSearch(jql, fields, { maxResults: 1000, timeout: 10000 });
        if (data && Array.isArray(data.issues) && data.issues.length > 0) {
          allIssues = data.issues;
          break;
        }
      } catch (_) {}
    }

    return allIssues.map((issue, index) => {
      const rawStatus = issue.fields?.status?.name || 'To Do';
      const mappedStatus = mapping.statusMapping[rawStatus] || rawStatus;

      const statusLower = (rawStatus || '').toLowerCase().trim();
      const mappedLower = (mappedStatus || '').toLowerCase().trim();
      const isDoneStatus = [
        'done', 'closed', 'resolved', 'complete', 'completed', 'finished', 'انجام شده', 'بسته شده', 'تکمیل شده', 'خاتمه یافته'
      ].includes(statusLower) || [
        'done', 'closed', 'resolved', 'complete', 'completed', 'finished', 'انجام شده', 'بسته شده', 'تکمیل شده', 'خاتمه یافته'
      ].includes(mappedLower);

      const isExplicitWaiting = mapping.waitingStatuses.some(ws => 
        statusLower === ws.toLowerCase() || mappedLower === ws.toLowerCase()
      ) || ['waiting', 'onholding', 'on hold', 'on_holding', 'blocked', 'منتظر', 'متوقف', 'توقف'].includes(statusLower) || ['waiting', 'onholding', 'on hold', 'on_holding', 'blocked', 'منتظر', 'متوقف', 'توقف'].includes(mappedLower);

      let isWaiting = (!isDoneStatus && isExplicitWaiting) ? 1 : 0;

      // Issue links check - Collect ALL linked issues, projects, and teams
      const issueLinks = issue.fields?.issuelinks || [];
      const linkedTeamsSet = new Set();
      const linkedReasonsList = [];
      const linkedTasks = [];

      for (const link of issueLinks) {
        const linkType = link.type || {};
        const rel = linkType.inward || linkType.outward || linkType.name || 'relates to';
        const linkedIssue = link.inwardIssue || link.outwardIssue || link.otherIssue || null;

        if (linkedIssue && linkedIssue.key) {
          const lFields = linkedIssue.fields || linkedIssue;
          const linkTitle = lFields?.summary || linkedIssue.summary || linkedIssue.key;
          const linkStatus = lFields?.status?.name || (typeof lFields?.status === 'object' ? lFields.status.name : lFields?.status) || null;
          const linkAssignee = lFields?.assignee ? (lFields.assignee.displayName || lFields.assignee.name) : null;
          const linkProjectName = lFields?.project?.name || (lFields?.project?.key ? `پروژه ${lFields.project.key}` : `پروژه ${linkedIssue.key.split('-')[0]}`);
          const linkProjectKey = (lFields?.project?.key || linkedIssue.key.split('-')[0]).toUpperCase();

          linkedTasks.push({
            key: linkedIssue.key,
            title: linkTitle,
            linkType: linkType.name || 'Relates',
            relationship: rel,
            direction: link.inwardIssue ? 'inward' : 'outward',
            status: linkStatus,
            assignee: linkAssignee,
            project_key: linkProjectKey,
            project_name: linkProjectName,
            start_date: lFields?.created ? lFields.created.split('T')[0] : null,
            due_date: lFields?.duedate || null
          });

          // Always add team & project dependencies from linked issue
          const teamLabel = linkAssignee ? `${linkAssignee} (${linkProjectKey})` : linkProjectName;
          linkedTeamsSet.add(teamLabel);
          linkedReasonsList.push(`${rel}: ${linkedIssue.key} (${linkTitle})`);
        }
      }

      let startDate = extractDateField(issue, mapping.dateMapping.taskStartDateField) || (issue.fields?.created ? issue.fields.created.split('T')[0] : null);
      let dueDate = extractDateField(issue, mapping.dateMapping.taskDueDateField) || extractDateField(issue, 'duedate');

      // Sprint Extraction (Custom Field or Default Field)
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
            const startMatch = sprint.match(/startDate=([^,\]]+)/);
            if (startMatch && startMatch[1] && startMatch[1] !== '<null>') {
              sprintStartDate = startMatch[1].split('T')[0];
            }
            const endMatch = sprint.match(/endDate=([^,\]]+)/);
            if (endMatch && endMatch[1] && endMatch[1] !== '<null>') {
              sprintEndDate = endMatch[1].split('T')[0];
            }
          } else if (typeof sprint === 'object') {
            sprintName = sprint.name || null;
            sprintStartDate = sprint.startDate ? sprint.startDate.split('T')[0] : null;
            sprintEndDate = sprint.endDate ? sprint.endDate.split('T')[0] : null;
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

      const allExtractedTeams = [];
      if (waitingForTeam) allExtractedTeams.push(waitingForTeam);
      for (const lt of linkedTeamsSet) {
        if (!allExtractedTeams.includes(lt)) allExtractedTeams.push(lt);
      }
      if (allExtractedTeams.length > 0) {
        waitingForTeam = allExtractedTeams.join(', ');
      }

      const allExtractedReasons = [];
      if (waitingReason) allExtractedReasons.push(waitingReason);
      for (const lr of linkedReasonsList) {
        if (!allExtractedReasons.includes(lr)) allExtractedReasons.push(lr);
      }
      if (allExtractedReasons.length > 0) {
        waitingReason = allExtractedReasons.join(' | ');
      }

      let finalStatus = mappedStatus;

      // Fully Dynamic Jira Component extraction (preserves all Jira components)
      let component = 'dev';
      const jiraComponents = issue.fields?.components || [];
      const labelsArr = issue.fields?.labels || [];

      if (jiraComponents.length > 0) {
        component = jiraComponents.map(c => (c.name || '').toLowerCase().trim()).filter(Boolean).join(', ');
      } else {
        const compLabels = labelsArr.filter(l => typeof l === 'string' && l.startsWith('comp:'));
        if (compLabels.length > 0) {
          component = compLabels.map(l => l.replace('comp:', '').toLowerCase().trim()).join(', ');
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
function parseTaskIssue(issue, epicKeyOverride = null, index = 0, knownEpicKeysSet = null) {
  if (!issue || !issue.fields) return null;
  const issueKey = (issue.key || '').trim().toUpperCase();
  if (!/^[A-Z0-9_]+-\d+$/i.test(issueKey)) {
    // Issue key MUST match PROJECT-NUMBER pattern (e.g. ORD-1001), otherwise ignore completely!
    return null;
  }
  let issueTypeName = '';
  if (issue.fields?.issuetype) {
    if (typeof issue.fields.issuetype === 'string') {
      issueTypeName = issue.fields.issuetype.toLowerCase().trim();
    } else if (typeof issue.fields.issuetype === 'object') {
      issueTypeName = (issue.fields.issuetype.name || issue.fields.issuetype.value || '').toLowerCase().trim();
    }
  }

  const isEpicType = (issueTypeName === 'epic' || issueTypeName === 'اپیک') && !issueTypeName.includes('request') && !issueTypeName.includes('internal') && !issueTypeName.includes('درخواست');
  if (isEpicType) {
    // Epics are saved into projects table only, NEVER into tasks table!
    return null;
  }
  const cfg = getJiraConfig();
  const mapping = cfg.mapping || jiraMapping;
  const customFields = mapping.customFields || {};

  let epicKey = epicKeyOverride;
  if (!epicKey) {
    // Strictly check the configured Epic Link field (e.g. customfield_10006) or standard Jira Epic fields
    const configuredEpicField = customFields.epicLinkField || 'customfield_10006';

    if (issue.fields?.[configuredEpicField]) {
      const val = issue.fields[configuredEpicField];
      epicKey = String(typeof val === 'object' ? (val.key || val.value) : val).toUpperCase();
    } else if (issue.fields?.customfield_10006) {
      const v = issue.fields.customfield_10006;
      epicKey = String(typeof v === 'object' ? (v.key || v.value) : v).toUpperCase();
    } else if (issue.fields?.epic?.key) {
      epicKey = String(issue.fields.epic.key).toUpperCase();
    } else if (issue.fields?.customfield_10014) {
      const v = issue.fields.customfield_10014;
      epicKey = String(typeof v === 'object' ? (v.key || v.value) : v).toUpperCase();
    } else if (issue.fields?.customfield_10008) {
      const v = issue.fields.customfield_10008;
      epicKey = String(typeof v === 'object' ? (v.key || v.value) : v).toUpperCase();
    } else if (issue.fields?.parent?.key && (issue.fields.parent?.fields?.issuetype?.name === 'Epic' || issue.fields.parent?.type === 'Epic')) {
      epicKey = String(issue.fields.parent.key).toUpperCase();
    }
  }

  const rawStatus = issue.fields?.status?.name || 'To Do';
  const mappedStatus = mapping.statusMapping[rawStatus] || rawStatus;
  const statusLower = (rawStatus || '').toLowerCase().trim();
  const mappedLower = (mappedStatus || '').toLowerCase().trim();

  // Strict check: Done / Closed tasks must NEVER be marked as waiting
  const isDoneStatus = [
    'done', 'closed', 'resolved', 'complete', 'completed', 'finished', 'انجام شده', 'بسته شده', 'تکمیل شده', 'خاتمه یافته'
  ].includes(statusLower) || [
    'done', 'closed', 'resolved', 'complete', 'completed', 'finished', 'انجام شده', 'بسته شده', 'تکمیل شده', 'خاتمه یافته'
  ].includes(mappedLower);

  // Strict check: A task is waiting ONLY if its status is explicitly Waiting/OnHolding/Blocked
  const isExplicitWaiting = mapping.waitingStatuses.some(ws => 
    statusLower === ws.toLowerCase() || mappedLower === ws.toLowerCase()
  ) || ['waiting', 'onholding', 'on hold', 'on_holding', 'blocked', 'منتظر', 'متوقف', 'توقف'].includes(statusLower) || ['waiting', 'onholding', 'on hold', 'on_holding', 'blocked', 'منتظر', 'متوقف', 'توقف'].includes(mappedLower);

  const isWaiting = (!isDoneStatus && isExplicitWaiting) ? 1 : 0;

  const issueLinks = issue.fields?.issuelinks || issue.fields?.linkedIssues || [];
  const linkedTeamsSet = new Set();
  const linkedReasonsList = [];
  const linkedTasks = [];

  for (const link of issueLinks) {
    const linkType = link.type || {};
    const typeName = linkType.name || link.type || 'Relates';

    const candidates = [
      { item: link.inwardIssue || link.inward, rel: linkType.inward || link.inward || 'is related to', dir: 'inward' },
      { item: link.outwardIssue || link.outward, rel: linkType.outward || link.outward || 'relates to', dir: 'outward' },
      { item: link.otherIssue || link.issue || link.target, rel: linkType.name || typeName, dir: 'other' }
    ];

    for (const cand of candidates) {
      const targetObj = cand.item;
      if (targetObj && typeof targetObj === 'object' && targetObj.key) {
        if (!linkedTasks.some(lt => lt.key === targetObj.key)) {
          const fields = targetObj.fields || targetObj;
          const linkTitle = fields?.summary || targetObj.summary || targetObj.key;
          const linkStatus = fields?.status?.name || (typeof fields?.status === 'object' ? fields.status.name : fields?.status) || (typeof targetObj.status === 'object' ? targetObj.status.name : targetObj.status) || null;
          const linkAssignee = fields?.assignee ? (fields.assignee.displayName || fields.assignee.name) : (typeof targetObj.assignee === 'object' ? targetObj.assignee.displayName : targetObj.assignee) || null;
          const linkProjectName = fields?.project?.name || (fields?.project?.key ? `پروژه ${fields.project.key}` : `پروژه ${targetObj.key.split('-')[0]}`);
          const linkProjectKey = (fields?.project?.key || targetObj.key.split('-')[0]).toUpperCase();
          const linkStartDate = fields?.created ? fields.created.split('T')[0] : null;
          const linkDueDate = fields?.duedate || targetObj.duedate || null;

          linkedTasks.push({
            key: targetObj.key,
            title: linkTitle,
            linkType: typeName,
            relationship: cand.rel,
            direction: cand.dir,
            status: linkStatus,
            assignee: linkAssignee,
            project_key: linkProjectKey,
            project_name: linkProjectName,
            start_date: linkStartDate,
            due_date: linkDueDate
          });

          // Always add team & project dependencies from linked issue
          const teamLabel = linkAssignee ? `${linkAssignee} (${linkProjectKey})` : linkProjectName;
          linkedTeamsSet.add(teamLabel);
          linkedReasonsList.push(`${cand.rel}: ${targetObj.key} (${linkTitle})`);
        }
      }
    }
  }

  // Check custom fields that may contain linked Jira issue objects or arrays
  if (issue.fields && typeof issue.fields === 'object') {
    for (const [fKey, fVal] of Object.entries(issue.fields)) {
      if (fKey.startsWith('customfield_') && fVal) {
        const checkItem = (item) => {
          if (item && typeof item === 'object' && item.key && /^[A-Z][A-Z0-9_]*-\d+$/i.test(item.key)) {
            if (!linkedTasks.some(lt => lt.key === item.key)) {
              linkedTasks.push({
                key: item.key,
                title: item.fields?.summary || item.summary || item.key,
                linkType: 'CustomField',
                relationship: 'linked via ' + fKey,
                direction: 'outward',
                status: item.fields?.status?.name || null,
                assignee: item.fields?.assignee?.displayName || null,
                start_date: item.fields?.created ? item.fields.created.split('T')[0] : null,
                due_date: item.fields?.duedate || null
              });
            }
          }
        };
        if (Array.isArray(fVal)) {
          fVal.forEach(checkItem);
        } else if (typeof fVal === 'object') {
          checkItem(fVal);
        }
      }
    }
  }

  // Include subtasks array if Jira provides issue.fields.subtasks
  const rawSubtasks = issue.fields?.subtasks || [];
  for (const st of rawSubtasks) {
    if (st && st.key && !linkedTasks.some(lt => lt.key === st.key)) {
      linkedTasks.push({
        key: st.key,
        title: st.fields?.summary || st.key,
        linkType: 'Subtask',
        relationship: 'subtask of',
        direction: 'subtask',
        status: st.fields?.status?.name || null,
        assignee: st.fields?.assignee ? (st.fields.assignee.displayName || st.fields.assignee.name) : null,
        start_date: st.fields?.created ? st.fields.created.split('T')[0] : null,
        due_date: st.fields?.duedate || null
      });
    }
  }

  // Include parent issue if present as a linked relation
  if (issue.fields?.parent?.key) {
    const pKey = issue.fields.parent.key;
    if (!linkedTasks.some(lt => lt.key === pKey)) {
      linkedTasks.push({
        key: pKey,
        title: issue.fields.parent.fields?.summary || pKey,
        linkType: 'Parent',
        relationship: 'parent task',
        direction: 'parent',
        status: issue.fields.parent.fields?.status?.name || null,
        assignee: issue.fields.parent.fields?.assignee ? issue.fields.parent.fields.assignee.displayName : null,
        start_date: issue.fields.parent.fields?.created ? issue.fields.parent.fields.created.split('T')[0] : null,
        due_date: issue.fields.parent.fields?.duedate || null
      });
    }
  }

  let createdAt = extractDateField(issue, 'created');
  let startDate = extractDateField(issue, mapping.dateMapping.taskStartDateField) || createdAt;
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

  const allExtractedTeams = [];
  if (waitingForTeam) allExtractedTeams.push(waitingForTeam);
  for (const lt of linkedTeamsSet) {
    if (!allExtractedTeams.includes(lt)) allExtractedTeams.push(lt);
  }
  if (allExtractedTeams.length > 0) {
    waitingForTeam = allExtractedTeams.join(', ');
  }

  const allExtractedReasons = [];
  if (waitingReason) allExtractedReasons.push(waitingReason);
  for (const lr of linkedReasonsList) {
    if (!allExtractedReasons.includes(lr)) allExtractedReasons.push(lr);
  }
  if (allExtractedReasons.length > 0) {
    waitingReason = allExtractedReasons.join(' | ');
  }

  let finalStatus = mappedStatus;

  let component = 'dev';
  const jiraComponents = issue.fields?.components || [];
  const labelsArr = issue.fields?.labels || [];

  if (jiraComponents.length > 0) {
    component = jiraComponents.map(c => (c.name || '').toLowerCase().trim()).filter(Boolean).join(', ');
  } else {
    const compLabels = labelsArr.filter(l => typeof l === 'string' && l.startsWith('comp:'));
    if (compLabels.length > 0) {
      component = compLabels.map(l => l.replace('comp:', '').toLowerCase().trim()).join(', ');
    } else {
      component = 'dev';
    }
  }

  const estSec = issue.fields?.aggregatetimeoriginalestimate || issue.fields?.timeoriginalestimate || 0;
  const spentSec = issue.fields?.aggregatetimespent || issue.fields?.timespent || 0;

  // Extract raw parent key from any possible representation in Jira payload
  let rawParentKey = null;
  if (issue.fields?.parent) {
    const p = issue.fields.parent;
    if (typeof p === 'string' && /^[A-Z][A-Z0-9_]*-\d+$/i.test(p)) {
      rawParentKey = p.toUpperCase();
    } else if (typeof p === 'object') {
      const k = p.key || p.value || p.name;
      if (k && /^[A-Z][A-Z0-9_]*-\d+$/i.test(k)) {
        rawParentKey = String(k).toUpperCase();
      }
    }
  }
  if (!rawParentKey && issue.fields?.parentKey && /^[A-Z][A-Z0-9_]*-\d+$/i.test(issue.fields.parentKey)) {
    rawParentKey = String(issue.fields.parentKey).toUpperCase();
  }
  if (!rawParentKey && issue.fields?.parent_key && /^[A-Z][A-Z0-9_]*-\d+$/i.test(issue.fields.parent_key)) {
    rawParentKey = String(issue.fields.parent_key).toUpperCase();
  }

  const parentTypeIsEpic = issue.fields?.parent?.fields?.issuetype?.name === 'Epic' || issue.fields?.parent?.type === 'Epic';
  
  // If parentTypeIsEpic, rawParentKey is actually an Epic key
  if (parentTypeIsEpic && rawParentKey && !epicKey) {
    epicKey = rawParentKey;
  }

  const isSubtask = (
    issue.fields?.issuetype?.subtask || 
    issueTypeName.includes('sub-task') || 
    issueTypeName.includes('subtask') || 
    issueTypeName.includes('sub task') || 
    issueTypeName.includes('زیرتسک') || 
    (rawParentKey && rawParentKey !== (epicKey || '').toUpperCase() && !parentTypeIsEpic)
  ) ? 1 : 0;

  const actualProjectKey = (issue.fields?.project?.key || (issue.key || '').split('-')[0] || 'ORD').toUpperCase();

  // 1. parent_key: STRICTLY for Sub-tasks! Stores parent task issue key (e.g. ORD-1480).
  let parentKey = null;
  if (rawParentKey && rawParentKey !== (epicKey || '').toUpperCase() && !parentTypeIsEpic) {
    parentKey = rawParentKey;
  } else if (isSubtask && rawParentKey && !parentTypeIsEpic) {
    parentKey = rawParentKey;
  }

  const isRealEpicKey = epicKey && /^[A-Z][A-Z0-9_]*-\d+$/i.test(epicKey) && epicKey.toUpperCase() !== (issue.key || '').toUpperCase() && epicKey.toUpperCase() !== (parentKey || '');
  
  // 2. parent_task_id / epic_id: STRICTLY for Epics! Stores the EPIC key (e.g. ORD-101), NEVER a parent task key!
  const parentTaskId = isRealEpicKey ? epicKey.toUpperCase() : null;

  return {
    id: issue.key,
    project_id: actualProjectKey,
    title: issue.fields?.summary || issue.key,
    description: parseJiraDescription(issue.fields?.description),
    status: finalStatus,
    assignee: issue.fields?.assignee ? issue.fields.assignee.displayName : null,
    estimate_hours: estSec ? Math.round((estSec / 3600) * 100) / 100 : 0,
    spent_hours: spentSec ? Math.round((spentSec / 3600) * 100) / 100 : 0,
    start_date: startDate,
    created_at: createdAt || startDate,
    due_date: dueDate,
    is_waiting: isWaiting,
    waiting_for_team: waitingForTeam,
    waiting_reason: waitingReason,
    sprint_name: sprintName,
    sprint_start_date: sprintStartDate,
    sprint_end_date: sprintEndDate,
    priority: issue.fields?.priority ? issue.fields.priority.name : 'Medium',
    labels: (() => {
      const taskLabelSet = new Set();
      if (Array.isArray(issue.fields?.labels)) {
        for (const l of issue.fields.labels) {
          if (typeof l === 'string' && l.trim()) taskLabelSet.add(l.trim());
          else if (l && typeof l === 'object') {
            const val = l.value || l.name || l.label;
            if (val) taskLabelSet.add(String(val).trim());
          }
        }
      }
      if (issue.fields && typeof issue.fields === 'object') {
        for (const [fKey, fVal] of Object.entries(issue.fields)) {
          if (!fVal || fKey === 'summary' || fKey === 'description' || fKey === 'comment' || fKey === 'worklog') continue;
          if (fKey.startsWith('customfield_')) {
            if (Array.isArray(fVal)) {
              for (const item of fVal) {
                if (typeof item === 'string' && item.trim()) {
                  taskLabelSet.add(item.trim());
                } else if (item && typeof item === 'object') {
                  const val = item.value || item.name || item.label;
                  if (val && typeof val === 'string' && val.trim()) {
                    taskLabelSet.add(val.trim());
                  }
                }
              }
            } else if (typeof fVal === 'string' && (/\b(13\d\d|14\d\d|20\d\d)\b/.test(fVal) || /Q[1-4]/i.test(fVal) || /فصل|بهار|تابستان|پاییز|زمستان/.test(fVal))) {
              taskLabelSet.add(fVal.trim());
            } else if (typeof fVal === 'object' && fVal.value && typeof fVal.value === 'string') {
              taskLabelSet.add(String(fVal.value).trim());
            }
          }
        }
      }
      return JSON.stringify(Array.from(taskLabelSet));
    })(),
    component: component,
    sort_order: index,
    is_subtask: isSubtask,
    parent_task_id: parentTaskId,
    epic_id: parentTaskId,
    parent_key: parentKey,
    linked_tasks: JSON.stringify(linkedTasks)
  };
}

async function fetchAllJiraProjects() {
  const cfg = getJiraConfig();
  if (cfg.mockMode) {
    const mockJiraService = require('./mockJiraService');
    return mockJiraService.getMockProjects();
  }
  const { baseUrl, username, token } = cfg;
  if (!baseUrl || !token) throw new Error('تنظیمات آدرس یا توکن جیرا وارد نشده است.');

  // 1. Fetch live Epics count across ALL projects from Jira directly
  const jiraEpicsCountMap = new Map();
  try {
    const epicSearchRes = await jiraSearch('issuetype = Epic', ['project'], { maxResults: 2000, timeout: 8000, singlePage: true }).catch(() => null);
    if (epicSearchRes && Array.isArray(epicSearchRes.issues)) {
      for (const ep of epicSearchRes.issues) {
        const pKey = ep.fields?.project?.key ? ep.fields.project.key.toUpperCase() : (ep.key ? ep.key.split('-')[0].toUpperCase() : '');
        if (pKey) {
          jiraEpicsCountMap.set(pKey, (jiraEpicsCountMap.get(pKey) || 0) + 1);
        }
      }
    }
  } catch (_) {}

  // 2. Fallback / supplement with DB cached epic counts
  let dbEpicCountsMap = new Map();
  try {
    const { getDb } = require('../db/database');
    const db = getDb();
    const rows = db.prepare("SELECT id FROM projects WHERE id LIKE '%-%'").all();
    for (const row of rows) {
      const pKey = row.id ? String(row.id).split('-')[0].toUpperCase() : '';
      if (pKey) {
        dbEpicCountsMap.set(pKey, (dbEpicCountsMap.get(pKey) || 0) + 1);
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
          const epicCount = jiraEpicsCountMap.has(keyUpper) 
            ? jiraEpicsCountMap.get(keyUpper) 
            : (dbEpicCountsMap.get(keyUpper) || 0);
          return {
            key: p.key,
            name: p.name || p.key,
            id: p.id || p.key,
            epicCount
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
            const epicCount = jiraEpicsCountMap.has(keyUpper) 
              ? jiraEpicsCountMap.get(keyUpper) 
              : (dbEpicCountsMap.get(keyUpper) || 0);
            pMap.set(p.key, {
              key: p.key,
              name: p.name || p.key,
              id: p.id || p.key,
              epicCount
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
      const epicCount = jiraEpicsCountMap.has(keyUpper) 
        ? jiraEpicsCountMap.get(keyUpper) 
        : (dbEpicCountsMap.get(keyUpper) || 0);
      return {
        key: k,
        name: `پروژه ${k}`,
        id: k,
        epicCount
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
