const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const volumeDir = '/app/data_volume';
const defaultDbPath = path.join(__dirname, '../../database.sqlite');
const dbPath = fs.existsSync(volumeDir) ? path.join(volumeDir, 'database.sqlite') : defaultDbPath;
const schemaPath = path.join(__dirname, 'schema.sql');

let db = null;
let inTransaction = false;

// Save database to file safely
function saveDb() {
  if (db && !inTransaction) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(dbPath, buffer);
    } catch (err) {
      console.error('Error saving SQLite DB to disk:', err.message);
    }
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
  let SQL;
  try {
    const sqljsDir = path.dirname(require.resolve('sql.js'));
    SQL = await initSqlJs({
      locateFile: file => path.join(sqljsDir, file)
    });
  } catch (errLocate) {
    console.warn('Could not locate sql-wasm with require.resolve, falling back to default initSqlJs:', errLocate.message);
    SQL = await initSqlJs();
  }
  
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } catch (dbReadErr) {
      console.error('Database file corrupted or invalid SQLite binary. Resetting DB instance:', dbReadErr.message);
      db = new SQL.Database();
    }
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
  try { db.run("ALTER TABLE tasks ADD COLUMN created_at TEXT"); } catch (_) {}


  // Ensure Admin user always exists
  try {
    const existingAdminRows = db.exec("SELECT COUNT(*) FROM users WHERE username = 'admin'");
    const adminCount = (existingAdminRows && existingAdminRows[0] && existingAdminRows[0].values) ? existingAdminRows[0].values[0][0] : 0;
    if (adminCount === 0) {
      // bcrypt hash for 'admin123'
      const hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
      const allPerms = JSON.stringify(["dashboard", "overall_timeline", "waiting_tasks", "user_management", "jira_settings"]);
      db.run(
        "INSERT INTO users (username, password_hash, display_name, role, permissions) VALUES (?, ?, ?, ?, ?)",
        ['admin', hash, 'مدیر سیستم', 'admin', allPerms]
      );
      console.log('Seeded permanent admin user (admin / admin123).');
    }
  } catch (err) {
    console.error('Error ensuring admin user in database:', err.message);
  }

  // Permanent automatic purge of any legacy fake demo projects (ORD-1..8 / GTX / OPS-101 / ORD-202 / DEV-303)
  try {
    db.run("DELETE FROM tasks WHERE project_id IN ('ORD-1','ORD-2','ORD-3','ORD-4','ORD-5','ORD-6','ORD-7','ORD-8','GTX-1','GTX-2','GTX-3','GTX-4','GTX-5','GTX-6','GTX-7','GTX-8','OPS-101','ORD-202','DEV-303') OR id LIKE 'ORD-1-%' OR id LIKE 'ORD-2-%' OR id LIKE 'ORD-3-%' OR id LIKE 'ORD-4-%' OR id LIKE 'ORD-5-%' OR id LIKE 'ORD-6-%' OR id LIKE 'ORD-7-%' OR id LIKE 'ORD-8-%' OR id LIKE 'GTX-%' OR id LIKE 'OPS-101-%' OR id LIKE 'ORD-202-%' OR id LIKE 'DEV-303-%'");
    db.run("DELETE FROM projects WHERE id IN ('ORD-1','ORD-2','ORD-3','ORD-4','ORD-5','ORD-6','ORD-7','ORD-8','GTX-1','GTX-2','GTX-3','GTX-4','GTX-5','GTX-6','GTX-7','GTX-8','OPS-101','ORD-202','DEV-303') OR title IN ('پایپلاین CI/CD','استک مانیتورینگ','مهاجرت به کوبرنتیز','خودکارسازی امنیت','یکپارچه‌سازی AI با ورکفلوها','برنامه آموزش تیم‌ها','طرح بازیابی از بحران','مدیریت متمرکز لاگ‌ها','سامانه مدیریت عملیات R&D','پلتفرم جدید سفارش‌گیری آنلاین','ارتقا بهینه مانیتورینگ بک‌اند')");
  } catch (_) {}

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
  getDb,
  saveDb
};
