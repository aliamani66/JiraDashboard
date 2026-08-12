const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const volumeDir = '/app/data_volume';
const defaultDbPath = path.join(__dirname, '../../database.sqlite');
const dbPath = fs.existsSync(volumeDir) ? path.join(volumeDir, 'database.sqlite') : defaultDbPath;
const schemaPath = path.join(__dirname, 'schema.sql');

let db = null;
let inTransaction = false;

// Save database to file
function saveDb() {
  if (db && !inTransaction) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Convert @param to :param and build bind object
function convertNamedParams(sql, params) {
  if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null && !Array.isArray(params[0])) {
    const obj = params[0];
    const sqlConverted = sql.replace(/@(\w+)/g, ':$1');
    const bindObj = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      bindObj[':' + key] = val === undefined ? null : val;
    }
    return { sql: sqlConverted, bind: bindObj };
  }
  // Positional params - handle nulls
  const flatParams = params.map(p => p === undefined ? null : p);
  return { sql, bind: flatParams };
}

// Compatibility wrapper to mimic better-sqlite3 API
function createStatement(sql) {
  return {
    run(...params) {
      try {
        if (params.length === 0) {
          db.run(sql);
        } else {
          const converted = convertNamedParams(sql, params);
          db.run(converted.sql, converted.bind);
        }
        if (!inTransaction) saveDb();
        return { changes: db.getRowsModified(), lastInsertRowid: 0 };
      } catch (e) {
        console.error('SQL run error:', e.message);
        console.error('SQL:', sql.substring(0, 200));
        throw e;
      }
    },
    get(...params) {
      let stmt;
      try {
        const converted = convertNamedParams(sql, params);
        stmt = db.prepare(converted.sql);
        if (params.length > 0 && (Array.isArray(converted.bind) ? converted.bind.length > 0 : Object.keys(converted.bind).length > 0)) {
          stmt.bind(converted.bind);
        }
        if (stmt.step()) {
          const columns = stmt.getColumnNames();
          const values = stmt.get();
          const result = {};
          columns.forEach((col, i) => { result[col] = values[i]; });
          stmt.free();
          return result;
        }
        stmt.free();
        return undefined;
      } catch (e) {
        if (stmt) try { stmt.free(); } catch(_) {}
        console.error('SQL get error:', e.message);
        console.error('SQL:', sql.substring(0, 200));
        throw e;
      }
    },
    all(...params) {
      let stmt;
      try {
        const converted = convertNamedParams(sql, params);
        stmt = db.prepare(converted.sql);
        if (params.length > 0 && (Array.isArray(converted.bind) ? converted.bind.length > 0 : Object.keys(converted.bind).length > 0)) {
          stmt.bind(converted.bind);
        }
        const results = [];
        const columns = stmt.getColumnNames();
        while (stmt.step()) {
          const values = stmt.get();
          const row = {};
          columns.forEach((col, i) => { row[col] = values[i]; });
          results.push(row);
        }
        stmt.free();
        return results;
      } catch (e) {
        if (stmt) try { stmt.free(); } catch(_) {}
        console.error('SQL all error:', e.message);
        console.error('SQL:', sql.substring(0, 200));
        throw e;
      }
    }
  };
}

// Wrapper object that mimics better-sqlite3 database interface
function createDbWrapper() {
  return {
    prepare(sql) {
      return createStatement(sql);
    },
    exec(sql) {
      db.run(sql);
      saveDb();
    },
    pragma(str) {
      // sql.js doesn't support WAL, just ignore
    },
    transaction(fn) {
      return function(...args) {
        inTransaction = true;
        db.run('BEGIN');
        try {
          fn(...args);
          db.run('COMMIT');
          inTransaction = false;
          saveDb();
        } catch (e) {
          try {
            db.run('ROLLBACK');
          } catch (rollbackErr) {
            // ignore rollback errors
          }
          inTransaction = false;
          throw e;
        }
      };
    }
  };
}

let dbWrapper = null;

async function initDb() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  // Migrations
  try { db.run("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)"); } catch (_) {}
  try { db.run("CREATE TABLE IF NOT EXISTS task_estimate_history (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, old_estimate REAL DEFAULT 0, new_estimate REAL DEFAULT 0, delta_hours REAL DEFAULT 0, changed_at TEXT NOT NULL)"); } catch (_) {}
  try { db.run("ALTER TABLE tasks ADD COLUMN is_subtask INTEGER DEFAULT 0"); } catch (_) {}
  try { db.run("ALTER TABLE tasks ADD COLUMN parent_task_id TEXT"); } catch (_) {}
  try { db.run("ALTER TABLE tasks ADD COLUMN description TEXT"); } catch (_) {}

  // Seed comprehensive test data for ALL audit categories if tasks are few or empty
  try {
    const taskCountRows = db.exec("SELECT COUNT(*) as cnt FROM tasks");
    const taskCount = (taskCountRows && taskCountRows[0] && taskCountRows[0].values) ? taskCountRows[0].values[0][0] : 0;

    const historyCountRows = db.exec("SELECT COUNT(*) as cnt FROM task_estimate_history");
    const historyCount = (historyCountRows && historyCountRows[0] && historyCountRows[0].values) ? historyCountRows[0].values[0][0] : 0;

    // 1. Seed demo tasks for all audit categories if taskCount < 5
    if (taskCount < 5) {
      const nowStr = new Date().toISOString();
      const insertSeedTask = db.prepare(`
        INSERT OR REPLACE INTO tasks (
          id, title, status, project_id, estimate_hours, spent_hours, assignee, sprint_name, due_date, start_date, is_waiting, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Category 1: Orphan Tasks (No Epic / Non-existent project_id)
      insertSeedTask.run('ORD-901', 'بررسی زیرساخت‌های پایگاه داده و مانیتورینگ عمومی', 'In Progress', 'NON_EXISTENT_EPIC', 16, 12.5, 'علی امانی', 'Sprint 14', '2026-08-25', '2026-08-01', 0, nowStr, nowStr);
      insertSeedTask.run('OPS-902', 'بهینه‌سازی فایل‌های کش بورد و رندر فرانت‌اند', 'To Do', null, 24, 18.0, 'رضا محمدی', 'Sprint 14', '2026-08-30', '2026-08-05', 0, nowStr, nowStr);

      // Category 2: No Sprint Tasks
      insertSeedTask.run('DEV-903', 'پیاده‌سازی ماژول اکسپورت PDF گزارشات مدیریتی', 'In Progress', 'OPS-101', 20, 8.5, 'سارا احمدی', null, '2026-09-05', '2026-08-10', 0, nowStr, nowStr);
      insertSeedTask.run('ORD-904', 'اصلاح استایل‌های حالت تاریک و تم دراکولا', 'Done', 'ORD-202', 12, 12.0, 'محمد کاظمی', '', '2026-08-15', '2026-08-02', 0, nowStr, nowStr);

      // Category 3: No Estimate Tasks (estimate_hours = 0)
      insertSeedTask.run('OPS-905', 'پایش خطاهای سرور و رفع باگ 504 در تایم‌اوت API', 'In Progress', 'OPS-101', 0, 14.0, 'علی امانی', 'Sprint 14', '2026-08-28', '2026-08-08', 0, nowStr, nowStr);
      insertSeedTask.run('DEV-906', 'مستندسازی کامپوننت‌های فرانت‌اند و فیلترهای سرچ', 'To Do', 'DEV-303', 0, 0, 'رضا محمدی', 'Sprint 15', '2026-09-10', '2026-08-12', 0, nowStr, nowStr);

      // Category 4: No Due Date Tasks (due_date = NULL / '')
      insertSeedTask.run('ORD-907', 'تست یکپارچه‌سازی سرویس‌های جیرا و بانک اطلاعاتی', 'In Progress', 'ORD-202', 18, 9.0, 'سارا احمدی', 'Sprint 14', null, '2026-08-05', 0, nowStr, nowStr);
      insertSeedTask.run('OPS-908', 'بازبینی دسترسی‌های کاربران و نقش‌های سیستمی', 'To Do', 'OPS-101', 10, 2.0, 'محمد کاظمی', 'Sprint 15', '', '2026-08-11', 0, nowStr, nowStr);

      // Category 5: Multi-issue Tasks (Orphan + No Sprint + Revised)
      insertSeedTask.run('DEV-909', 'توسعه الگوریتم محاسبه تاخیر و ریسک پروژه‌ها', 'In Progress', null, 30, 22.0, 'علی امانی', null, null, '2026-08-01', 0, nowStr, nowStr);
    }

    // 2. Seed Estimate Revisions in task_estimate_history if historyCount === 0
    if (historyCount === 0) {
      const insertHist = db.prepare(`
        INSERT INTO task_estimate_history (task_id, old_estimate, new_estimate, delta_hours, changed_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      const now = new Date();

      // Increased Estimates (+8h, +10h, +5h)
      insertHist.run('ORD-901', 8, 12, 4, new Date(now.getTime() - 86400000 * 6).toISOString());
      insertHist.run('ORD-901', 12, 16, 4, new Date(now.getTime() - 86400000 * 2).toISOString());

      insertHist.run('DEV-903', 10, 20, 10, new Date(now.getTime() - 86400000 * 4).toISOString());

      insertHist.run('OPS-908', 5, 10, 5, new Date(now.getTime() - 86400000 * 3).toISOString());

      // Decreased Estimates (-6h, -10h)
      insertHist.run('OPS-902', 30, 24, -6, new Date(now.getTime() - 86400000 * 5).toISOString());

      insertHist.run('DEV-909', 40, 35, -5, new Date(now.getTime() - 86400000 * 7).toISOString());
      insertHist.run('DEV-909', 35, 30, -5, new Date(now.getTime() - 86400000 * 1).toISOString());
    }
  } catch (err) {
    console.error('Failed to seed comprehensive audit data:', err);
  }

  saveDb();

  dbWrapper = createDbWrapper();
  console.log('Database initialized successfully.');
  return dbWrapper;
}

function getDb() {
  if (!dbWrapper) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbWrapper;
}

module.exports = {
  initDb,
  getDb
};
