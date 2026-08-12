const { initDb, getDb, saveDb } = require('./src/db/database');

(async () => {
  await initDb();
  const db = getDb();

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, project_id, title, description, status, assignee, estimate_hours, spent_hours, start_date, due_date, is_waiting, waiting_for_team, waiting_reason, sprint_name, sprint_start_date, sprint_end_date, priority, labels, component, sort_order, is_subtask, parent_task_id, last_synced)
    VALUES (@id, @project_id, @title, @description, @status, @assignee, @estimate_hours, @spent_hours, @start_date, @due_date, @is_waiting, @waiting_for_team, @waiting_reason, @sprint_name, @sprint_start_date, @sprint_end_date, @priority, @labels, @component, @sort_order, @is_subtask, @parent_task_id, @last_synced)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title
  `);

  // Insert a test epic first
  db.prepare('INSERT OR IGNORE INTO projects (id, title) VALUES (?, ?)').run('OPS-101', 'Test Epic');

  const task = {
    id: 'OPS-501', project_id: 'OPS-101', title: 'Test Task',
    description: null, status: 'In Progress', assignee: 'Ali',
    estimate_hours: 8, spent_hours: 2, start_date: '2026-01-01', due_date: '2026-01-31',
    is_waiting: 0, waiting_for_team: null, waiting_reason: null,
    sprint_name: null, sprint_start_date: null, sprint_end_date: null,
    priority: 'Medium', labels: '[]', component: null, sort_order: 0,
    is_subtask: 0, parent_task_id: null, last_synced: new Date().toISOString()
  };

  try {
    insertTask.run(task);
    const saved = db.prepare('SELECT id, project_id FROM tasks WHERE id = ?').get('OPS-501');
    console.log('Task saved OK:', saved);
  } catch(e) {
    console.error('ERROR saving task:', e.message, e.stack);
  }

  // Now test with project_id = plain project key (OPS)
  const task2 = { ...task, id: 'OPS-502', project_id: 'OPS' };
  try {
    insertTask.run(task2);
    const saved2 = db.prepare('SELECT id, project_id FROM tasks WHERE id = ?').get('OPS-502');
    console.log('Task2 saved with plain project key:', saved2);
  } catch(e2) {
    console.error('ERROR saving task2:', e2.message);
  }

  // Check DB tasks table schema
  const schema = db.prepare("PRAGMA table_info(tasks)").all();
  console.log('Tasks table columns:', schema.map(c => c.name));

  saveDb();
})();
