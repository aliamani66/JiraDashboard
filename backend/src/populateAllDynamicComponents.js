const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Populating dynamic Jira components across all tasks...');

const componentList = ['dev', 'learning', 'support', 'meeting', 'arch', 'sec', 'infra', 'research', 'db'];

db.all("SELECT id FROM tasks", [], (err, rows) => {
  if (err) {
    console.error('Error selecting tasks:', err);
    process.exit(1);
  }

  let updated = 0;
  rows.forEach((row, idx) => {
    const comp = componentList[idx % componentList.length];
    db.run("UPDATE tasks SET component = ? WHERE id = ?", [comp, row.id], function(err2) {
      if (err2) {
        console.error(`Error updating task ${row.id}:`, err2);
      } else {
        updated++;
      }
      if (updated === rows.length) {
        console.log(`Successfully updated all ${updated} tasks with dynamic Jira components!`);
        db.close();
      }
    });
  });
});
