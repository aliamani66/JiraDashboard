const { initDb, getDb } = require('./db/database');

async function run() {
  await initDb();
  const db = getDb();
  try {
    db.exec("ALTER TABLE tasks ADD COLUMN component TEXT DEFAULT 'dev'");
    console.log('✅ Added component column to tasks table');
  } catch (e) {
    console.log('Note:', e.message);
  }
}

run();
