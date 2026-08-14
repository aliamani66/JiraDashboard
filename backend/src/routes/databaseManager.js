const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const isValidEpicKey = (k) => k && /^[A-Z][A-Z0-9_]*-\d+$/i.test(k);

// GET /api/db/tables
// Returns list of all tables in SQLite database with row counts and schema
router.get('/tables', (req, res) => {
  try {
    const db = getDb();
    const tablesList = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC").all();

    const tables = tablesList.map(t => {
      const name = t.name;
      let count = 0;
      let columns = [];
      try {
        count = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get()?.c || 0;
      } catch (_) {}
      try {
        const pragma = db.prepare(`PRAGMA table_info("${name}")`).all();
        columns = pragma.map(c => ({ name: c.name, type: c.type, pk: c.pk === 1 }));
      } catch (_) {}
      return { name, count, columns };
    });

    res.json({ success: true, tables });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در دریافت لیست جداول: ' + err.message });
  }
});

// GET /api/db/data/:tableName
// Returns paginated rows from a specified table with search and filtering
router.get('/data/:tableName', (req, res) => {
  try {
    const db = getDb();
    const tableName = req.params.tableName;

    // Validate table existence
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
    if (!exists) {
      return res.status(404).json({ success: false, message: `جدول '${tableName}' یافت نشد.` });
    }

    const pragma = db.prepare(`PRAGMA table_info("${tableName}")`).all();
    const columns = pragma.map(c => ({ name: c.name, type: c.type, pk: c.pk === 1 }));

    const search = (req.query.search || '').trim();
    const filterCategory = req.query.category || 'all'; // 'all', 'with_epic', 'without_epic', 'subtasks'
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(10, Math.min(200, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    let allRows = [];
    if (tableName === 'tasks') {
      allRows = db.prepare(`SELECT id, project_id, epic_id, parent_task_id, parent_key, linked_tasks, title, status, is_subtask, is_waiting, assignee, sprint_name, created_at, start_date, due_date FROM tasks ORDER BY id DESC`).all() || [];

      if (filterCategory === 'with_epic') {
        allRows = allRows.filter(t => isValidEpicKey(t.parent_task_id));
      } else if (filterCategory === 'without_epic') {
        allRows = allRows.filter(t => !isValidEpicKey(t.parent_task_id));
      } else if (filterCategory === 'subtasks') {
        allRows = allRows.filter(t => t.is_subtask === 1);
      }
    } else {
      allRows = db.prepare(`SELECT * FROM "${tableName}" ORDER BY rowid DESC`).all() || [];
    }

    if (search) {
      const q = search.toLowerCase();
      allRows = allRows.filter(r => {
        return Object.values(r).some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(q));
      });
    }

    const totalRows = allRows.length;
    const paginatedRows = allRows.slice(offset, offset + limit);

    // Metadata counts for tasks table
    let stats = null;
    if (tableName === 'tasks') {
      const fullDbTasks = db.prepare(`SELECT project_id, parent_task_id, epic_id, is_subtask FROM tasks`).all() || [];
      const fullProjects = db.prepare(`SELECT id, title FROM projects`).all() || [];
      
      let withEpicCount = 0;
      let withoutEpicCount = 0;
      let subtasksCount = 0;
      const projectTaskMap = {};

      for (const t of fullDbTasks) {
        if (t.is_subtask === 1) subtasksCount++;
        const hasEpic = isValidEpicKey(t.epic_id) || isValidEpicKey(t.parent_task_id);
        if (hasEpic) withEpicCount++;
        else withoutEpicCount++;

        const pKey = (t.project_id || '').toUpperCase();
        if (pKey) {
          projectTaskMap[pKey] = (projectTaskMap[pKey] || 0) + 1;
        }
      }

      const projectBreakdown = {};
      for (const p of fullProjects) {
        const pKey = (p.id ? p.id.split('-')[0] : p.id).toUpperCase();
        if (!projectBreakdown[pKey]) {
          projectBreakdown[pKey] = { projectKey: pKey, epicCount: 0, taskCount: 0 };
        }
        projectBreakdown[pKey].epicCount++;
      }
      for (const [pKey, tCount] of Object.entries(projectTaskMap)) {
        if (!projectBreakdown[pKey]) {
          projectBreakdown[pKey] = { projectKey: pKey, epicCount: 0, taskCount: tCount };
        } else {
          projectBreakdown[pKey].taskCount = tCount;
        }
      }

      stats = {
        totalDbTasks: fullDbTasks.length,
        totalEpicsCount: fullProjects.length,
        withEpicCount,
        withoutEpicCount,
        subtasksCount,
        projectBreakdown: Object.values(projectBreakdown)
      };
    }

    res.json({
      success: true,
      tableName,
      columns,
      totalRows,
      page,
      limit,
      totalPages: Math.ceil(totalRows / limit) || 1,
      rows: paginatedRows,
      stats
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در بارگذاری داده‌های جدول: ' + err.message });
  }
});

// Helper: check db_query permission
function checkDbQueryPerm(req, res, next) {
  if (req.user && (req.user.role === 'admin' || (Array.isArray(req.user.permissions) && req.user.permissions.includes('db_query')))) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز: برای اجرای مستقیم کوئری SQL نیاز به مجوز «کنسول اجرای SQL (db_query)» یا نقش مدیر سیستم دارید.' });
}

// POST /api/db/query
// Executes custom read-only SQL queries
router.post('/query', checkDbQueryPerm, (req, res) => {
  try {
    const db = getDb();
    const { sql } = req.body;

    if (!sql || typeof sql !== 'string' || !sql.trim()) {
      return res.status(400).json({ success: false, message: 'لطفاً کوئری SQL را وارد فرمایید.' });
    }

    const trimmedSql = sql.trim();
    // Safety check: allow SELECT, PRAGMA, EXPLAIN
    if (!/^(SELECT|PRAGMA|EXPLAIN)\s/i.test(trimmedSql)) {
      return res.status(400).json({ success: false, message: 'تنها کوئری‌های خواندنی (SELECT) مجاز می‌باشند.' });
    }

    const startTime = Date.now();
    const rows = db.prepare(trimmedSql).all() || [];
    const executionTimeMs = Date.now() - startTime;

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    res.json({
      success: true,
      sql: trimmedSql,
      rowCount: rows.length,
      executionTimeMs,
      columns,
      rows
    });
  } catch (err) {
    res.status(400).json({ success: false, message: 'خطای اجرای SQL: ' + err.message });
  }
});

module.exports = router;
