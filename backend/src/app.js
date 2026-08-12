require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb, getDb } = require('./db/database');
const { initCron, syncFromJira } = require('./services/cacheService');
const { hashPassword } = require('./services/authService');
const jiraService = require('./services/jiraService');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const syncRoutes = require('./routes/sync');
const userRoutes = require('./routes/users');
const jiraSettingsRoutes = require('./routes/jiraSettings');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', projectRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jira', jiraSettingsRoutes);

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'خطای سرور' });
});

async function start() {
  await initDb();
  console.log('Database ready.');

  // Always ensure admin user exists with full permissions
  try {
    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(users)").all();
    const hasPermissions = columns.some(c => c.name === 'permissions');
    if (!hasPermissions) {
      db.prepare("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[\"dashboard\",\"overall_timeline\",\"waiting_tasks\",\"user_management\",\"jira_settings\"]'").run();
    }

    const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!existingAdmin) {
      const hashed = await hashPassword('admin123');
      const allPerms = JSON.stringify(["dashboard", "overall_timeline", "waiting_tasks", "user_management", "jira_settings"]);
      db.prepare('INSERT INTO users (username, password_hash, display_name, role, permissions) VALUES (?, ?, ?, ?, ?)').run(
        'admin', hashed, 'مدیر سیستم', 'admin', allPerms
      );
      console.log('Created admin user (admin / admin123).');
    }
  } catch (adminErr) {
    console.error('Error ensuring admin user:', adminErr.message);
  }

  // Start HTTP Server FIRST so API endpoints & login are immediately available
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  // If Jira is configured, perform initial sync asynchronously in background without blocking login
  if (jiraService.isConfigured) {
    console.log('Jira configured. Running initial background sync from Jira...');
    syncFromJira().catch(syncErr => {
      console.error('Initial background Jira sync failed (server remains running):', syncErr.message);
    });
  }

  // Initialize Cache Sync Cron
  initCron();
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
