const { initDb, getDb, saveDb } = require('../src/db/database');

async function main() {
  await initDb();
  const db = getDb();

  const nowStr = new Date().toISOString().split('T')[0];
  const insertTask = db.prepare(`
    INSERT OR REPLACE INTO tasks (
      id, title, description, status, priority, assignee, is_waiting, is_subtask, created_at, start_date, due_date, estimate_hours, spent_hours, project_id
    ) VALUES (
      @id, @title, @description, @status, @priority, @assignee, @is_waiting, @is_subtask, @created_at, @start_date, @due_date, @estimate_hours, @spent_hours, @project_id
    )
  `);

  insertTask.run({
    id: 'ORD-9991',
    title: 'تسک تستی لوکال: بهینه‌سازی کش سرور (اضافی در دیتابیس)',
    description: 'این تسک صرفاً برای تست اختلاف در دیتابیس محلی ثبت شده و در جیرا نیست',
    status: 'In Progress',
    priority: 'High',
    assignee: 'علی امانی',
    is_waiting: 0,
    is_subtask: 0,
    created_at: nowStr,
    start_date: nowStr,
    due_date: '2026-09-30',
    estimate_hours: 16,
    spent_hours: 4,
    project_id: 'ORD-101'
  });

  insertTask.run({
    id: 'OPS-9992',
    title: 'تسک تستی لوکال: بررسی پیکربندی فایروال (اضافی در دیتابیس)',
    description: 'این تسک برای تست نمایش مورد اضافه دیتابیس ایجاد شده است',
    status: 'To Do',
    priority: 'Medium',
    assignee: 'رضا محمدی',
    is_waiting: 0,
    is_subtask: 0,
    created_at: nowStr,
    start_date: nowStr,
    due_date: '2026-09-30',
    estimate_hours: 8,
    spent_hours: 0,
    project_id: 'OPS-201'
  });

  // Remove 2 tasks from SQLite to create JIRA_ONLY missing tasks
  db.prepare("DELETE FROM tasks WHERE id IN ('ORD-1500', 'OPS-1499')").run();

  saveDb();
  console.log('Test mismatch data successfully injected into local database.sqlite!');
}

main().catch(err => console.error(err));
