const mockProjects = [
  { id: 'ORD', key: 'ORD', name: 'پروژه عملیات و پشتیبانی (ORD)', epicCount: 60 },
  { id: 'OPS', key: 'OPS', name: 'پروژه زیرساخت و سامانه (OPS)', epicCount: 40 },
  { id: 'OPM', key: 'OPM', name: 'پروژه مدیریت عملیات پلتفرم (OPM)', epicCount: 50 },
  { id: 'DEV', key: 'DEV', name: 'پروژه توسعه نرم‌افزار و فریم‌ورک (DEV)', epicCount: 25 },
  { id: 'INFRA', key: 'INFRA', name: 'پروژه کلود و دیتاسنتر (INFRA)', epicCount: 18 },
  { id: 'CORE', key: 'CORE', name: 'پلتفرم پایه و هسته اصلی (CORE)', epicCount: 32 },
  { id: 'SEC', key: 'SEC', name: 'امنیت اطلاعات و احراز هویت (SEC)', epicCount: 14 }
];

const mockEpics = [];
// Generate 60 ORD Epics across 5 years
for (let i = 1; i <= 60; i++) {
  const key = `ORD-${100 + i}`;
  const daysAgo = Math.floor((i / 60) * 1800);
  const createdDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  mockEpics.push({
    id: key,
    key: key,
    summary: `اپیک توسعه و بهینه‌سازی سامانه ORD شماره ${i}`,
    fields: {
      summary: `اپیک توسعه و بهینه‌سازی سامانه ORD شماره ${i}`,
      description: `توضیحات اپیک شماره ${i} پروژه ORD`,
      issuetype: { name: 'Epic' },
      status: { name: i % 3 === 0 ? 'Done' : i % 2 === 0 ? 'In Progress' : 'To Do' },
      project: { key: 'ORD', name: 'پروژه ORD' },
      created: createdDate,
      duedate: '2026-12-29'
    }
  });
}
// Generate 40 OPS Epics across 5 years
for (let i = 1; i <= 40; i++) {
  const key = `OPS-${200 + i}`;
  const daysAgo = Math.floor((i / 40) * 1800);
  const createdDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  mockEpics.push({
    id: key,
    key: key,
    summary: `اپیک ارتقا زیرساخت لینوکس و مانیتورینگ ${i}`,
    fields: {
      summary: `اپیک ارتقا زیرساخت لینوکس و مانیتورینگ ${i}`,
      description: `توضیحات اپیک شماره ${i} پروژه OPS`,
      issuetype: { name: 'Epic' },
      status: { name: i % 4 === 0 ? 'Done' : 'In Progress' },
      project: { key: 'OPS', name: 'پروژه OPS' },
      created: createdDate,
      duedate: '2026-12-29'
    }
  });
}
// Generate 50 OPM Epics across 5 years
for (let i = 1; i <= 50; i++) {
  const key = `OPM-${300 + i}`;
  const daysAgo = Math.floor((i / 50) * 1800);
  const createdDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  mockEpics.push({
    id: key,
    key: key,
    summary: `اپیک مدیریت عملیات و نظارت پلتفرم OPM شماره ${i}`,
    fields: {
      summary: `اپیک مدیریت عملیات و نظارت پلتفرم OPM شماره ${i}`,
      description: `توضیحات اپیک شماره ${i} پروژه OPM`,
      issuetype: { name: 'Epic' },
      status: { name: i % 3 === 0 ? 'Done' : 'In Progress' },
      project: { key: 'OPM', name: 'پروژه OPM' },
      created: createdDate,
      duedate: '2026-12-29'
    }
  });
}
// Generate 25 DEV Epics across 5 years
for (let i = 1; i <= 25; i++) {
  const key = `DEV-${400 + i}`;
  const daysAgo = Math.floor((i / 25) * 1800);
  const createdDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  mockEpics.push({
    id: key,
    key: key,
    summary: `اپیک توسعه ماژول‌های نرم‌افزاری DEV شماره ${i}`,
    fields: {
      summary: `اپیک توسعه ماژول‌های نرم‌افزاری DEV شماره ${i}`,
      description: `توضیحات اپیک شماره ${i} پروژه DEV`,
      issuetype: { name: 'Epic' },
      status: { name: i % 2 === 0 ? 'Done' : 'In Progress' },
      project: { key: 'DEV', name: 'پروژه DEV' },
      created: createdDate,
      duedate: '2026-12-29'
    }
  });
}

// Generate 500 Tasks distributed evenly across 5 years (1825 days)
const mockTasks = [];
const assignees = ['علی امانی', 'رضا محمدی', 'سارا احمدی', 'محمد حسینی', 'مریم کریمی'];
const components = ['learning', 'meeting', 'infrastructure', 'dashboard', 'security', 'database'];
const statuses = ['In Progress', 'Done', 'Waiting', 'To Do', 'Completed'];

const now = new Date();
for (let i = 1; i <= 500; i++) {
  const isOrd = i % 2 === 0;
  const projKey = isOrd ? 'ORD' : 'OPS';
  const ordIndex = (Math.floor((i - 1) / 2) % 60) + 1;
  const opsIndex = (Math.floor((i - 1) / 2) % 40) + 1;
  const epicKey = isOrd ? `ORD-${100 + ordIndex}` : `OPS-${200 + opsIndex}`;
  const hasEpic = true;

  // Distribute creation dates evenly across the last 1800 days (~5 years)
  const daysAgo = Math.floor(((500 - i) / 500) * 1800);
  const taskDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const dateStr = taskDate.toISOString();

  const issueLinks = [];
  if (i % 3 === 0) {
    const linkedNum = Math.max(1, i - 1);
    const linkedProj = linkedNum % 2 === 0 ? 'ORD' : 'OPS';
    issueLinks.push({
      type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' },
      inwardIssue: {
        key: `${linkedProj}-${1000 + linkedNum}`,
        fields: {
          summary: `تسک وابسته شماره ${linkedNum} پروژه ${linkedProj}`,
          status: { name: 'In Progress' },
          assignee: { displayName: assignees[linkedNum % assignees.length] },
          created: dateStr,
          duedate: dateStr.split('T')[0]
        }
      }
    });
  }

  const isSubtaskItem = i % 5 === 0;
  const parentTaskKey = isSubtaskItem ? `${projKey}-${1000 + Math.max(1, i - 1)}` : null;

  mockTasks.push({
    id: `${projKey}-${1000 + i}`,
    key: `${projKey}-${1000 + i}`,
    fields: {
      summary: isSubtaskItem ? `زیرتسک عملیاتی ${i} پروژه ${projKey}` : `تسک عملیاتی نمونه شماره ${i} پروژه ${projKey}`,
      description: `توضیحات کامل تسک شماره ${i}`,
      issuetype: isSubtaskItem ? { name: 'Sub-task', subtask: true } : { name: 'Task', subtask: false },
      status: { name: statuses[i % statuses.length] },
      assignee: { displayName: assignees[i % assignees.length] },
      components: [{ name: components[i % components.length] }],
      labels: [`wait:${i % 2 === 0 ? 'infra' : 'db'}`, `reason:approval`],
      created: dateStr,
      duedate: dateStr.split('T')[0],
      project: { key: projKey, name: projKey },
      customfield_10006: hasEpic ? epicKey : null,
      parent: isSubtaskItem ? { key: parentTaskKey, fields: { summary: `تسک مادر ${parentTaskKey}`, issuetype: { name: 'Task' } } } : (hasEpic ? { key: epicKey, fields: { issuetype: { name: 'Epic' } } } : null),
      issuelinks: issueLinks
    }
  });
}

function mockJiraSearch(jql, fields = [], options = {}) {
  const isEpicQuery = jql.toLowerCase().includes('issuetype=epic') || jql.toLowerCase().includes('issuetype = epic') || jql.toLowerCase().includes('issuetype in (epic');
  const isWithoutEpicQuery = jql.includes('"Epic Link" EMPTY') || jql.includes('parent IS EMPTY') || jql.includes('withoutEpic');

  // Extract project filter from JQL
  let projKeys = null;
  const inMatch = jql.match(/project IN \(([^)]+)\)/i);
  const eqMatch = jql.match(/project = "?([A-Z0-9_]+)"?/i);
  if (inMatch && inMatch[1]) {
    projKeys = inMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '').toUpperCase());
  } else if (eqMatch && eqMatch[1]) {
    projKeys = [eqMatch[1].trim().replace(/['"]/g, '').toUpperCase()];
  }

  // Extract Date Filters from JQL (handles created >=, updated >=, created <=, etc.)
  let filterStartDate = null;
  let filterEndDate = null;

  const startMatches = jql.match(/(?:created|updated)\s*>=\s*"([^"]+)"/gi);
  if (startMatches) {
    for (const sm of startMatches) {
      const valMatch = sm.match(/"([^"]+)"/);
      if (valMatch && valMatch[1]) {
        const d = new Date(valMatch[1]);
        if (!isNaN(d.getTime())) {
          if (!filterStartDate || d < filterStartDate) {
            filterStartDate = d;
          }
        }
      }
    }
  }

  const endMatches = jql.match(/(?:created|updated)\s*<=\s*"([^"]+)"/gi);
  if (endMatches) {
    for (const em of endMatches) {
      const valMatch = em.match(/"([^"]+)"/);
      if (valMatch && valMatch[1]) {
        const d = new Date(valMatch[1]);
        if (!isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          if (!filterEndDate || d > filterEndDate) {
            filterEndDate = d;
          }
        }
      }
    }
  }

  const checkDateMatch = (item) => {
    if (!filterStartDate && !filterEndDate) return true;
    const cDate = item.fields?.created ? new Date(item.fields.created) : null;
    const uDate = item.fields?.updated ? new Date(item.fields.updated) : cDate;

    if (filterStartDate) {
      const matchStart = (cDate && cDate >= filterStartDate) || (uDate && uDate >= filterStartDate);
      if (!matchStart) return false;
    }
    if (filterEndDate) {
      const matchEnd = (cDate && cDate <= filterEndDate) || (uDate && uDate <= filterEndDate);
      if (!matchEnd) return false;
    }
    return true;
  };

  if (isEpicQuery) {
    let filteredEpics = [...mockEpics];
    if (projKeys && projKeys.length > 0) {
      filteredEpics = filteredEpics.filter(e => {
        const pKey = (e.fields?.project?.key || e.key?.split('-')[0] || '').toUpperCase();
        return projKeys.includes(pKey);
      });
    }
    filteredEpics = filteredEpics.filter(checkDateMatch);

    return {
      startAt: 0,
      maxResults: filteredEpics.length,
      total: filteredEpics.length,
      issues: filteredEpics
    };
  }

  let filteredTasks = [...mockTasks];
  if (projKeys && projKeys.length > 0) {
    filteredTasks = filteredTasks.filter(t => {
      const pKey = (t.fields?.project?.key || t.key?.split('-')[0] || '').toUpperCase();
      return projKeys.includes(pKey);
    });
  }

  if (isWithoutEpicQuery) {
    filteredTasks = filteredTasks.filter(t => !t.fields.customfield_10006 && !t.fields.parent);
  }

  const isWithEpicQuery = jql.includes('"Epic Link" NOT EMPTY') || jql.includes('withEpic');
  if (isWithEpicQuery) {
    filteredTasks = filteredTasks.filter(t => Boolean(t.fields.customfield_10006 || t.fields.parent));
  }

  filteredTasks = filteredTasks.filter(checkDateMatch);

  return {
    startAt: 0,
    maxResults: filteredTasks.length,
    total: filteredTasks.length,
    issues: filteredTasks
  };
}

function getMockProjects() {
  return mockProjects;
}

module.exports = {
  mockJiraSearch,
  getMockProjects,
  mockEpics,
  mockTasks
};
