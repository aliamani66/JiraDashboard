require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db/database');
const { initCron, syncFromJira } = require('./services/cacheService');
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
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize Database then start server
async function start() {
  await initDb();
  console.log('Database ready.');

  // If Jira is configured, perform initial sync automatically
  if (jiraService.isConfigured) {
    console.log('Jira configured. Running initial sync from Jira Cloud...');
    await syncFromJira();
  }

  // Initialize Cache Sync Cron
  initCron();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
