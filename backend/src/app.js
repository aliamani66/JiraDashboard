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
const databaseManagerRoutes = require('./routes/databaseManager');

const path = require('path');
const fs = require('fs');

const logger = require('./utils/logger');
const { errorHandler, requestLogger } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(requestLogger);

// Health Check Endpoint for PM2 / Docker / Nginx
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', projectRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jira', jiraSettingsRoutes);
app.use('/api/db', databaseManagerRoutes);

// Static frontend serving (Direct Node.js web server without Nginx)
const possibleFrontendPaths = [
  path.join(__dirname, '../../frontend/dist'),
  path.join(__dirname, '../public'),
  path.join(__dirname, '../../dist'),
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), '../frontend/dist'),
  path.join(process.cwd(), 'dist')
];

let activeFrontendPath = possibleFrontendPaths.find(p => fs.existsSync(path.join(p, 'index.html')));

if (activeFrontendPath) {
  console.log(`🚀 Serving static React frontend directly from: ${activeFrontendPath}`);
  app.use(express.static(activeFrontendPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health' || req.path === '/api/health') return next();
    res.sendFile(path.join(activeFrontendPath, 'index.html'));
  });
} else {
  console.log('ℹ️ No prebuilt frontend dist found, running in API-only mode.');
}

// Global Error Handlers to prevent process exit loops on server
process.on('uncaughtException', (err) => {
  logger.error(`CRITICAL Uncaught Exception: ${err.message}`, err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`CRITICAL Unhandled Rejection: ${reason instanceof Error ? reason.message : reason}`, reason);
});

// Centralized Global Error Handler
app.use(errorHandler);

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

    const allPermsList = [
      "dashboard", "sprints", "overall_timeline", "manager_reports", "waiting_tasks", "database_manager", "jira_settings", "user_management",
      "jira_config", "jira_diagnostics", "jira_mapping", "jira_sync_range", "db_rebuild", "system_tests", "system_logs",
      "db_explorer", "db_query"
    ];
    const allPerms = JSON.stringify(allPermsList);

    const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!existingAdmin) {
      const hashed = await hashPassword('admin123');
      db.prepare('INSERT INTO users (username, password_hash, display_name, role, permissions) VALUES (?, ?, ?, ?, ?)').run(
        'admin', hashed, 'مدیر سیستم', 'admin', allPerms
      );
      console.log('Created admin user (admin / admin123).');
    } else {
      // Ensure existing admin user has full permissions
      db.prepare('UPDATE users SET permissions = ? WHERE username = ?').run(allPerms, 'admin');
    }
  } catch (adminErr) {
    console.error('Error ensuring admin user:', adminErr.message);
  }

  // Start HTTP Server FIRST so API endpoints & login are immediately available
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  // Initialize Cache Sync Cron (runs only at configured intervals, not unconditionally on startup)
  initCron();
  return server;
}

if (require.main === module) {
  start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, start };
