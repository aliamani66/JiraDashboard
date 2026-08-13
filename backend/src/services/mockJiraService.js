// Mock Jira Data Engine for local development and testing without live Jira server
const mockProjects = [
  { id: 'ORD', key: 'ORD', name: 'پروژه عملیات و پشتیبانی (ORD)', epicCount: 35 },
  { id: 'OPS', key: 'OPS', name: 'پروژه زیرساخت و سامانه (OPS)', epicCount: 24 }
];

// Generate 59 mock Epics
const mockEpics = [];
for (let i = 1; i <= 35; i++) {
  mockEpics.push({
    id: `ORD-EPIC-${i}`,
    key: `ORD-${100 + i}`,
    summary: `اپیک توسعه و بهینه‌سازی سامانه ORD شماره ${i}`,
    fields: {
      summary: `اپیک توسعه و بهینه‌سازی سامانه ORD شماره ${i}`,
      issuetype: { name: 'Epic' },
      status: { name: i % 3 === 0 ? 'Done' : i % 2 === 0 ? 'In Progress' : 'To Do' },
      project: { key: 'ORD', name: 'ORD Project' },
      created: '2025-01-10T08:00:00.000+0330'
    }
  });
}
for (let i = 1; i <= 24; i++) {
  mockEpics.push({
    id: `OPS-EPIC-${i}`,
    key: `OPS-${200 + i}`,
    summary: `اپیک ارتقا زیرساخت لینوکس و مانیتورینگ ${i}`,
    fields: {
      summary: `اپیک ارتقا زیرساخت لینوکس و مانیتورینگ ${i}`,
      issuetype: { name: 'Epic' },
      status: { name: i % 4 === 0 ? 'Done' : 'In Progress' },
      project: { key: 'OPS', name: 'OPS Infrastructure' },
      created: '2025-02-01T09:00:00.000+0330'
    }
  });
}

// Generate realistic Tasks
const mockTasks = [];
const assignees = ['علی امانی', 'رضا محمدی', 'سارا احمدی', 'محمد حسینی'];
const components = ['learning', 'meeting', 'infrastructure', 'dashboard', 'security'];
const statuses = ['In Progress', 'Done', 'Waiting', 'To Do', 'Completed'];

// Create 52 tasks for the last 3 months
const now = new Date();
for (let i = 1; i <= 52; i++) {
  const isOrd = i % 2 === 0;
  const projKey = isOrd ? 'ORD' : 'OPS';
  const epicKey = isOrd ? `ORD-${100 + (i % 35 + 1)}` : `OPS-${200 + (i % 24 + 1)}`;
  const hasEpic = i > 4; // 4 tasks without Epic (for testing unlinked tasks)
  
  // Date within last 3 months
  const daysAgo = Math.floor((i / 52) * 85);
  const taskDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const dateStr = taskDate.toISOString();

  mockTasks.push({
    id: `${projKey}-${1000 + i}`,
    key: `${projKey}-${1000 + i}`,
    fields: {
      summary: `تسک عملیاتی نمونه شماره ${i} پروژه ${projKey}`,
      issuetype: { name: 'Task' },
      status: { name: statuses[i % statuses.length] },
      assignee: { displayName: assignees[i % assignees.length] },
      components: [{ name: components[i % components.length] }],
      labels: [`wait:${i % 2 === 0 ? 'infra' : 'db'}`, `reason:approval`],
      created: dateStr,
      duedate: dateStr.split('T')[0],
      customfield_10006: hasEpic ? epicKey : null, // Epic Link
      parent: hasEpic ? { key: epicKey } : null
    }
  });
}

function mockJiraSearch(jql, fields = [], options = {}) {
  const isEpicQuery = jql.includes('issuetype = Epic');
  const isWithoutEpicQuery = jql.includes('"Epic Link" EMPTY') || jql.includes('parent IS EMPTY') || jql.includes('withoutEpic');

  if (isEpicQuery) {
    return {
      startAt: 0,
      maxResults: mockEpics.length,
      total: mockEpics.length,
      issues: mockEpics
    };
  }

  if (isWithoutEpicQuery) {
    const withoutEpicTasks = mockTasks.filter(t => !t.fields.customfield_10006 && !t.fields.parent);
    return {
      startAt: 0,
      maxResults: withoutEpicTasks.length,
      total: withoutEpicTasks.length,
      issues: withoutEpicTasks
    };
  }

  // Filter tasks by date if created clause present
  let filteredTasks = [...mockTasks];
  const createdMatch = jql.match(/created >= "([^"]+)"/);
  if (createdMatch && createdMatch[1]) {
    const startDate = new Date(createdMatch[1]);
    filteredTasks = filteredTasks.filter(t => new Date(t.fields.created) >= startDate);
  }

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
