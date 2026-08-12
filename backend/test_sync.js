const { initDb, getDb, saveDb } = require('./src/db/database');
const jiraService = require('./src/services/jiraService');
const cacheService = require('./src/services/cacheService');

(async () => {
  await initDb();
  const db = getDb();

  console.log('Jira configured:', jiraService.isConfigured);
  const cfg = jiraService.getJiraConfig();
  console.log('Project key:', cfg.projectKey);

  // Count before
  const tasksBefore = db.prepare('SELECT COUNT(*) as cnt FROM tasks').get();
  const projectsBefore = db.prepare('SELECT COUNT(*) as cnt FROM projects').get();
  console.log('Tasks before:', tasksBefore.cnt, '| Projects before:', projectsBefore.cnt);

  // Test sync for current month only
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  const startStr = `${y}-${m}-01 00:00`;
  const endStr = `${y}-${m}-${lastDay} 23:59`;

  console.log('\nTesting syncSingleMonthFromJira for', startStr, '-', endStr);

  try {
    const result = await cacheService.syncSingleMonthFromJira({
      startStr, endStr, monthLabel: 'Test Month', monthIndex: 1
    });
    console.log('\nResult:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('syncSingleMonthFromJira ERROR:', e.message, e.stack);
  }

  const tasksAfter = db.prepare('SELECT COUNT(*) as cnt FROM tasks').get();
  const projectsAfter = db.prepare('SELECT COUNT(*) as cnt FROM projects').get();
  console.log('\nTasks after:', tasksAfter.cnt, '| Projects after:', projectsAfter.cnt);

  if (tasksAfter.cnt > 0) {
    const sample = db.prepare('SELECT id, project_id, title FROM tasks LIMIT 5').all();
    console.log('Sample tasks:', sample);
  }
})();
