const { getDb, initDb } = require('./db/database');
const { hashPassword } = require('./services/authService');

async function run() {
  await initDb();
  const db = getDb();

  try {
    db.prepare("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[\"dashboard\",\"overall_timeline\",\"waiting_tasks\",\"user_management\",\"project_detail\"]'").run();
  } catch (e) {}

  console.log('Creating test user with ONLY waiting_tasks permissions...');

  const username = 'waiting_user';
  const password = '123456';
  const displayName = 'کاربر تستی (فقط تسک‌های منتظر)';
  const role = 'viewer';
  const permissions = JSON.stringify(['waiting_tasks']);

  const passwordHash = await hashPassword(password);

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);

  if (existing) {
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, display_name = ?, role = ?, permissions = ? 
      WHERE username = ?
    `).run(passwordHash, displayName, role, permissions, username);
  } else {
    db.prepare(`
      INSERT INTO users (username, password_hash, display_name, role, permissions)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, passwordHash, displayName, role, permissions);
  }

  console.log('✅ Test user "waiting_user" successfully created!');
  console.log('Credentials:');
  console.log('  Username: waiting_user');
  console.log('  Password: 123456');
  console.log('  Permissions: ONLY waiting_tasks');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
