const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const dbPath = path.join(__dirname, '..', 'database.sqlite');

async function seed() {
  const SQL = await initSqlJs();
  let db;

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Ensure tables
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'In Progress',
      total_estimate_hours REAL DEFAULT 0,
      total_spent_hours REAL DEFAULT 0,
      total_tasks INTEGER DEFAULT 0,
      completed_tasks INTEGER DEFAULT 0,
      progress INTEGER DEFAULT 0,
      last_synced TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'To Do',
      project_id TEXT,
      estimate_hours REAL DEFAULT 0,
      spent_hours REAL DEFAULT 0,
      assignee TEXT,
      sprint_name TEXT,
      due_date TEXT,
      start_date TEXT,
      is_waiting INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS task_estimate_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      old_estimate REAL DEFAULT 0,
      new_estimate REAL DEFAULT 0,
      delta_hours REAL DEFAULT 0,
      changed_at TEXT NOT NULL
    );
  `);

  const nowStr = new Date().toISOString();
  const now = new Date();

  // Insert base epics
  db.run("INSERT OR REPLACE INTO projects (id, title, status) VALUES ('OPS-101', 'سامانه مدیریت عملیات R&D', 'In Progress')");
  db.run("INSERT OR REPLACE INTO projects (id, title, status) VALUES ('ORD-202', 'پلتفرم جدید سفارش‌گیری آنلاین', 'In Progress')");
  db.run("INSERT OR REPLACE INTO projects (id, title, status) VALUES ('DEV-303', 'ارتقا بهینه مانیتورینگ بک‌اند', 'In Progress')");

  // Insert seed tasks with all 5 audit categories
  const insertTask = db.prepare(`
    INSERT OR REPLACE INTO tasks (
      id, title, status, project_id, estimate_hours, spent_hours, assignee, sprint_name, due_date, start_date, is_waiting
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Orphan tasks (No epic / project_id not in projects)
  insertTask.run(['ORD-901', 'بررسی زیرساخت‌های پایگاه داده و مانیتورینگ عمومی', 'In Progress', 'ORPHAN_EPIC_01', 16, 12.5, 'علی امانی', 'Sprint 14', '2026-08-25', '2026-08-01', 0]);
  insertTask.run(['OPS-902', 'بهینه‌سازی فایل‌های کش بورد و رندر فرانت‌اند', 'To Do', 'ORPHAN_EPIC_02', 24, 18.0, 'رضا محمدی', 'Sprint 14', '2026-08-30', '2026-08-05', 0]);

  // 2. No Sprint tasks
  insertTask.run(['DEV-903', 'پیاده‌سازی ماژول اکسپورت PDF گزارشات مدیریتی', 'In Progress', 'OPS-101', 20, 8.5, 'سارا احمدی', null, '2026-09-05', '2026-08-10', 0]);
  insertTask.run(['ORD-904', 'اصلاح استایل‌های حالت تاریک و تم دراکولا', 'Done', 'ORD-202', 12, 12.0, 'محمد کاظمی', '', '2026-08-15', '2026-08-02', 0]);

  // 3. No Estimate tasks
  insertTask.run(['OPS-905', 'پایش خطاهای سرور و رفع باگ 504 در تایم‌اوت API', 'In Progress', 'OPS-101', 0, 14.0, 'علی امانی', 'Sprint 14', '2026-08-28', '2026-08-08', 0]);
  insertTask.run(['DEV-906', 'مستندسازی کامپوننت‌های فرانت‌اند و فیلترهای سرچ', 'To Do', 'DEV-303', 0, 0, 'رضا محمدی', 'Sprint 15', '2026-09-10', '2026-08-12', 0]);

  // 4. No Due Date tasks
  insertTask.run(['ORD-907', 'تست یکپارچه‌سازی سرویس‌های جیرا و بانک اطلاعاتی', 'In Progress', 'ORD-202', 18, 9.0, 'سارا احمدی', 'Sprint 14', null, '2026-08-05', 0]);
  insertTask.run(['OPS-908', 'بازبینی دسترسی‌های کاربران و نقش‌های سیستمی', 'To Do', 'OPS-101', 10, 2.0, 'محمد کاظمی', 'Sprint 15', '', '2026-08-11', 0]);

  // 5. Multi-issue Task (Orphan + No Sprint + Revised)
  insertTask.run(['DEV-909', 'توسعه الگوریتم محاسبه تاخیر و ریسک پروژه‌ها', 'In Progress', 'ORPHAN_EPIC_03', 30, 22.0, 'علی امانی', null, null, '2026-08-01', 0]);

  // Clear & Insert Estimate History
  db.run("DELETE FROM task_estimate_history");
  const insertHist = db.prepare(`
    INSERT INTO task_estimate_history (task_id, old_estimate, new_estimate, delta_hours, changed_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Increased Estimates
  insertHist.run(['ORD-901', 8, 12, 4, new Date(now.getTime() - 86400000 * 6).toISOString()]);
  insertHist.run(['ORD-901', 12, 16, 4, new Date(now.getTime() - 86400000 * 2).toISOString()]);
  insertHist.run(['DEV-903', 10, 20, 10, new Date(now.getTime() - 86400000 * 4).toISOString()]);
  insertHist.run(['OPS-908', 5, 10, 5, new Date(now.getTime() - 86400000 * 3).toISOString()]);

  // Decreased Estimates
  insertHist.run(['OPS-902', 30, 24, -6, new Date(now.getTime() - 86400000 * 5).toISOString()]);
  insertHist.run(['DEV-909', 40, 35, -5, new Date(now.getTime() - 86400000 * 7).toISOString()]);
  insertHist.run(['DEV-909', 35, 30, -5, new Date(now.getTime() - 86400000 * 1).toISOString()]);

  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
  console.log('Local SQLite database seeded successfully with comprehensive manager report demo tasks!');
}

seed().catch(console.error);
