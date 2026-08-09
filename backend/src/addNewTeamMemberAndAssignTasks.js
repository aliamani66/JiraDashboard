const { initDb, getDb } = require('./db/database');

async function run() {
  await initDb();
  const db = getDb();

  console.log('Adding new team members and assigning tasks across projects...');

  // 1. مریم ابراهیمی
  db.prepare(`
    UPDATE tasks 
    SET assignee = 'مریم ابراهیمی', status = 'In Progress'
    WHERE id IN ('ORD-2', 'ORD-3', 'ORD-10', 'ORD-14')
  `).run();

  // 2. ساره حسینی
  db.prepare(`
    UPDATE tasks 
    SET assignee = 'ساره حسینی', status = 'In Progress'
    WHERE id IN ('ORD-4', 'ORD-7', 'ORD-11')
  `).run();

  // 3. رضا شریفی
  db.prepare(`
    UPDATE tasks 
    SET assignee = 'رضا شریفی', status = 'Waiting', is_waiting = 1, waiting_for_team = 'زیرساخت', waiting_reason = 'منتظر سرور تخصیصی'
    WHERE id IN ('ORD-8', 'ORD-15')
  `).run();

  const members = db.prepare(`
    SELECT assignee, COUNT(*) as total_tasks, 
           SUM(CASE WHEN status != 'Done' AND status != 'done' THEN 1 ELSE 0 END) as remaining_tasks
    FROM tasks 
    GROUP BY assignee
  `).all();

  console.log('✅ Assignees breakdown across projects updated successfully:');
  console.log(JSON.stringify(members, null, 2));

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
