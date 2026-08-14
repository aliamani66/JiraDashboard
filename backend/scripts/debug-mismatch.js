const { initDb, getDb } = require('../src/db/database');
const jiraService = require('../src/services/jiraService');

async function test() {
  await initDb();
  const db = getDb();
  const cfg = jiraService.getJiraConfig();
  console.log('cfg mockMode:', cfg.mockMode);
  console.log('cfg projectKey:', cfg.projectKey);

  const jql = 'project IN (OPS,ORD) AND created >= "2026-06-01" AND issuetype != Epic ORDER BY created ASC';
  const jRes = await jiraService.jiraSearch(jql, ['summary', 'status']);
  console.log('Jira mock tasks count:', jRes.issues?.length);
  if (jRes.issues?.length > 0) {
    console.log('Sample Jira mock tasks:', jRes.issues.slice(-3).map(i => i.key));
  }

  const now = new Date();
  const startMonthDate = new Date(now.getFullYear(), now.getMonth() - (3 - 1), 1);
  const startDateStr = `${startMonthDate.getFullYear()}-${String(startMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
  console.log('startDateStr:', startDateStr);

  const taskProjWhere = " AND (id LIKE 'OPS-%' OR id LIKE 'ORD-%')";
  const dbDateClause = ` AND (created_at >= '${startDateStr}' OR start_date >= '${startDateStr}' OR due_date >= '${startDateStr}')`;

  const dbTasks = db.prepare(`SELECT id, title FROM tasks WHERE 1=1${taskProjWhere}${dbDateClause}`).all();
  console.log('DB tasks matching filter count:', dbTasks.length);
  console.log('DB tasks sample:', dbTasks.slice(0, 5).map(t => t.id));
}

test().catch(err => console.error(err));
