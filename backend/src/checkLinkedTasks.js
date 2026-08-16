const { initDb, getDb } = require('./db/database');

async function main() {
  await initDb();
  const db = getDb();
const waitingTasks = db.prepare(`
  SELECT id, project_id, title, status, is_waiting, waiting_for_team, waiting_reason, linked_tasks 
  FROM tasks 
  WHERE is_waiting = 1 OR status = 'OnHolding' OR status = 'Waiting' OR (linked_tasks != '[]' AND linked_tasks IS NOT NULL)
  LIMIT 15
`).all();

console.log('--- FOUND TASKS ---');
waitingTasks.forEach(t => {
  console.log(`[${t.id}] (${t.status}) ${t.title}`);
  console.log(`  Waiting For: ${t.waiting_for_team} | Reason: ${t.waiting_reason}`);
  console.log(`  Linked Tasks: ${t.linked_tasks}`);
});
}

main();
