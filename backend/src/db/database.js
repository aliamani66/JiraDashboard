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

  // Seed sample estimate revision history if table is empty
  try {
    const historyCount = db.exec("SELECT COUNT(*) as cnt FROM task_estimate_history");
    const count = (historyCount && historyCount[0] && historyCount[0].values && historyCount[0].values[0]) ? historyCount[0].values[0][0] : 0;

    if (count === 0) {
      const taskRows = db.exec("SELECT id, estimate_hours FROM tasks LIMIT 15");
      if (taskRows && taskRows[0] && taskRows[0].values) {
        const rows = taskRows[0].values;
        const now = new Date();

        if (rows.length >= 1) {
          const t1 = rows[0][0]; // Task 1 -> Increased estimate (+8h)
          const currentEst = rows[0][1] || 15;
          db.run("INSERT INTO task_estimate_history (task_id, old_estimate, new_estimate, delta_hours, changed_at) VALUES (?, ?, ?, ?, ?)",
            [t1, Math.max(1, currentEst - 8), Math.max(1, currentEst - 3), 5, new Date(now.getTime() - 86400000 * 5).toISOString()]);
          db.run("INSERT INTO task_estimate_history (task_id, old_estimate, new_estimate, delta_hours, changed_at) VALUES (?, ?, ?, ?, ?)",
            [t1, Math.max(1, currentEst - 3), currentEst, 3, new Date(now.getTime() - 86400000 * 2).toISOString()]);
        }

        if (rows.length >= 2) {
          const t2 = rows[1][0]; // Task 2 -> Decreased estimate (-4h)
          const currentEst = rows[1][1] || 10;
          db.run("INSERT INTO task_estimate_history (task_id, old_estimate, new_estimate, delta_hours, changed_at) VALUES (?, ?, ?, ?, ?)",
            [t2, currentEst + 4, currentEst, -4, new Date(now.getTime() - 86400000 * 4).toISOString()]);
        }

        if (rows.length >= 3) {
          const t3 = rows[2][0]; // Task 3 -> Increased estimate (+10h)
          const currentEst = rows[2][1] || 25;
          db.run("INSERT INTO task_estimate_history (task_id, old_estimate, new_estimate, delta_hours, changed_at) VALUES (?, ?, ?, ?, ?)",
            [t3, Math.max(1, currentEst - 10), currentEst, 10, new Date(now.getTime() - 86400000 * 3).toISOString()]);
        }

        if (rows.length >= 4) {
          const t4 = rows[3][0]; // Task 4 -> Decreased estimate (-10h)
          const currentEst = rows[3][1] || 12;
          db.run("INSERT INTO task_estimate_history (task_id, old_estimate, new_estimate, delta_hours, changed_at) VALUES (?, ?, ?, ?, ?)",
            [t4, currentEst + 10, currentEst + 4, -6, new Date(now.getTime() - 86400000 * 6).toISOString()]);
          db.run("INSERT INTO task_estimate_history (task_id, old_estimate, new_estimate, delta_hours, changed_at) VALUES (?, ?, ?, ?, ?)",
            [t4, currentEst + 4, currentEst, -4, new Date(now.getTime() - 86400000 * 1).toISOString()]);
        }

        if (rows.length >= 5) {
          const t5 = rows[4][0]; // Task 5 -> Increased estimate (+7h)
          const currentEst = rows[4][1] || 18;
          db.run("INSERT INTO task_estimate_history (task_id, old_estimate, new_estimate, delta_hours, changed_at) VALUES (?, ?, ?, ?, ?)",
            [t5, Math.max(1, currentEst - 7), currentEst, 7, new Date(now.getTime() - 86400000 * 2).toISOString()]);
        }
      }
    }
  } catch (err) {
    console.error('Failed to seed estimate history:', err);
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
