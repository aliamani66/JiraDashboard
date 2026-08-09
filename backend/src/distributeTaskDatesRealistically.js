const { initDb, getDb } = require('./db/database');

// Staggered realistic start & end dates spanning April to September 2026
const taskDatesMap = {
  // Sprint 1 (April / Ordibehesht)
  'ORD-27': { start: '2026-04-15', due: '2026-05-10' },
  'ORD-28': { start: '2026-04-20', due: '2026-05-18' },
  'ORD-2':  { start: '2026-04-25', due: '2026-05-25' },

  // Sprint 2 (May / Khordad)
  'ORD-29': { start: '2026-05-02', due: '2026-06-05' },
  'ORD-30': { start: '2026-05-10', due: '2026-06-15' },
  'ORD-3':  { start: '2026-05-18', due: '2026-06-25' },

  // Sprint 3 (June / Khordad-Tir)
  'ORD-31': { start: '2026-06-01', due: '2026-07-02' },
  'ORD-32': { start: '2026-06-08', due: '2026-07-10' },
  'ORD-4':  { start: '2026-06-15', due: '2026-07-18' },

  // Sprint 4 (June-July / Tir)
  'ORD-33': { start: '2026-06-22', due: '2026-07-22' },
  'ORD-34': { start: '2026-06-28', due: '2026-07-28' },

  // Sprint 5 (July / Tir-Mordad)
  'ORD-35': { start: '2026-07-02', due: '2026-08-04' },
  'ORD-36': { start: '2026-07-08', due: '2026-08-10' },

  // Sprint 6 (July-Aug / Mordad)
  'ORD-37': { start: '2026-07-12', due: '2026-08-14' },
  'ORD-38': { start: '2026-07-18', due: '2026-08-20' },

  // Sprint 7 (Aug / Mordad)
  'ORD-39': { start: '2026-07-22', due: '2026-08-24' },
  'ORD-40': { start: '2026-07-26', due: '2026-08-28' },

  // Sprint 8 (Aug / Mordad-Shahrivar)
  'ORD-41': { start: '2026-08-01', due: '2026-09-02' },
  'ORD-42': { start: '2026-08-04', due: '2026-09-05' },

  // Sprint 9 (Aug / Shahrivar)
  'ORD-43': { start: '2026-08-08', due: '2026-09-10' },
  'ORD-44': { start: '2026-08-12', due: '2026-09-12' },

  // Sprint 10 (Current)
  'ORD-45': { start: '2026-08-15', due: '2026-09-18' },
  'ORD-46': { start: '2026-08-18', due: '2026-09-22' },
  'ORD-21': { start: '2026-08-20', due: '2026-09-25' }
};

async function run() {
  await initDb();
  console.log('📅 Distributing unique start & due dates across all tasks in SQLite...');
  const db = getDb();

  const updateStmt = db.prepare(`
    UPDATE tasks 
    SET start_date = ?, due_date = ? 
    WHERE id = ?
  `);

  let updatedCount = 0;
  for (const [taskId, dates] of Object.entries(taskDatesMap)) {
    updateStmt.run(dates.start, dates.due, taskId);
    updatedCount++;
    console.log(`  ✅ Staggered ${taskId}: Start=${dates.start} -> Due=${dates.due}`);
  }

  // Also update any remaining tasks with staggered dates based on sort_order
  const remaining = db.prepare('SELECT id, sort_order FROM tasks WHERE start_date IS NULL OR start_date = "2026-08-09"').all();
  for (let i = 0; i < remaining.length; i++) {
    const t = remaining[i];
    const m = (i % 4) + 5; // Month 5, 6, 7, 8
    const d = (i * 3 % 20) + 1;
    const startStr = `2026-0${m}-${d < 10 ? '0' + d : d}`;
    const dueStr = `2026-0${m + 1}-${d < 10 ? '0' + d : d}`;
    updateStmt.run(startStr, dueStr, t.id);
  }

  console.log(`\n🎉 Staggered start dates applied to all tasks successfully!`);
}

run();
