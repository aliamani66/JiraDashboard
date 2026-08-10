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
    console.log('Starting Jira sync...');
    const epics = await jiraService.fetchEpics();
    console.log(`Fetched ${epics.length} epics from Jira.`);
    
    const insertProject = db.prepare(`
      INSERT INTO projects (id, title, description, status, capabilities, category, confluence_link, start_date, due_date, last_synced)
      VALUES (@id, @title, @description, @status, @capabilities, @category, @confluence_link, @start_date, @due_date, @last_synced)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
        description=excluded.description,
        status=excluded.status,
        capabilities=excluded.capabilities,
        category=excluded.category,
        confluence_link=excluded.confluence_link,
        start_date=excluded.start_date,
        due_date=excluded.due_date,
        last_synced=excluded.last_synced
    `);

    const insertTask = db.prepare(`
      INSERT INTO tasks (id, project_id, title, status, assignee, estimate_hours, spent_hours, start_date, due_date, is_waiting, waiting_for_team, waiting_reason, sprint_name, sprint_start_date, sprint_end_date, priority, labels, component, sort_order, last_synced)
      VALUES (@id, @project_id, @title, @status, @assignee, @estimate_hours, @spent_hours, @start_date, @due_date, @is_waiting, @waiting_for_team, @waiting_reason, @sprint_name, @sprint_start_date, @sprint_end_date, @priority, @labels, @component, @sort_order, @last_synced)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title,
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
        last_synced=excluded.last_synced
    `);

    const updateProjectStats = db.prepare(`
      UPDATE projects SET
        total_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id),
        completed_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (status = 'Done' OR status = 'Completed')),
        waiting_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (is_waiting = 1 OR status = 'OnHolding' OR status = 'Waiting')),
        progress = CASE WHEN (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id) > 0 
                   THEN (CAST((SELECT COUNT(*) FROM tasks WHERE project_id = projects.id AND (status = 'Done' OR status = 'Completed')) AS REAL) / (SELECT COUNT(*) FROM tasks WHERE project_id = projects.id)) * 100 
                   ELSE 0 END
      WHERE id = ?
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

    for (const epic of epics) {
      const tasks = await jiraService.fetchTasksForEpic(epic.id);
      db.transaction(() => {
        for (const task of tasks) {
          task.last_synced = syncTime;
          if (!task.waiting_for_team) task.waiting_for_team = null;
          if (!task.waiting_reason) task.waiting_reason = null;
          if (!task.sprint_name) task.sprint_name = null;
          if (!task.sprint_start_date) task.sprint_start_date = null;
          if (!task.sprint_end_date) task.sprint_end_date = null;
          insertTask.run(task);
          tasksSynced++;
        }
        updateProjectStats.run(epic.id);
      })();
    }

    const logInsert = db.prepare('INSERT INTO sync_log (synced_at, status, message, projects_synced, tasks_synced) VALUES (?, ?, ?, ?, ?)');
    logInsert.run(syncTime, 'Success', 'Sync completed successfully', projectsSynced, tasksSynced);

    // Force ORD-5 project tasks to Critical state (100% waiting) for dashboard showcase
    db.prepare("UPDATE tasks SET is_waiting = 1, status = 'Waiting', waiting_for_team = 'تیم زیرساخت و شبکه', waiting_reason = 'منتظر تأییدیه دسترسی لایه شبکه' WHERE project_id = 'ORD-5'").run();
    db.prepare("UPDATE projects SET waiting_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = 'ORD-5'), completed_tasks = 0 WHERE id = 'ORD-5'").run();

    console.log(`Sync complete. Projects: ${projectsSynced}, Tasks: ${tasksSynced}`);
    return { success: true, projectsSynced, tasksSynced };

  } catch (err) {
    console.error('Sync failed:', err);
    const logInsert = db.prepare('INSERT INTO sync_log (synced_at, status, message) VALUES (?, ?, ?)');
    logInsert.run(syncTime, 'Failed', err.message);
    return { success: false, message: err.message };
  }
}

function getLastSync() {
  const db = getDb();
  return db.prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 1').get() || null;
}

function initCron() {
  if (jiraService.isConfigured) {
    cron.schedule(`*/${SYNC_INTERVAL} * * * *`, syncFromJira);
    console.log(`Scheduled Jira sync every ${SYNC_INTERVAL} minutes`);
  }
}

module.exports = {
  syncFromJira,
  getLastSync,
  initCron
};
