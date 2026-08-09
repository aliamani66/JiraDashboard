const { initDb, getDb } = require('./db/database');

async function run() {
  await initDb();
  const db = getDb();
  const tasks = db.prepare("SELECT id, title, status, is_waiting, waiting_for_team, waiting_reason FROM tasks WHERE project_id = 'ORD-1'").all();
  console.log('ORD-1 TASKS:', JSON.stringify(tasks, null, 2));
}

run();
