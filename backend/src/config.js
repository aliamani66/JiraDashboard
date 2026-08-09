require('dotenv').config();
const jiraMapping = require('./jiraMapping');

module.exports = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
  
  // 1. Jira Configuration
  jira: {
    baseUrl: process.env.JIRA_BASE_URL || '',
    username: process.env.JIRA_USERNAME || '',
    token: process.env.JIRA_TOKEN || '',
    projectKey: process.env.JIRA_PROJECT_KEY || 'OPS',
    isConfigured: !!(process.env.JIRA_BASE_URL && process.env.JIRA_TOKEN),
    mapping: jiraMapping
  },
  
  // 2. Confluence Configuration
  confluence: {
    baseUrl: process.env.CONFLUENCE_BASE_URL || '',
    username: process.env.CONFLUENCE_USERNAME || process.env.JIRA_USERNAME || '',
    token: process.env.CONFLUENCE_TOKEN || process.env.JIRA_TOKEN || '',
    isConfigured: !!(process.env.CONFLUENCE_BASE_URL && (process.env.CONFLUENCE_TOKEN || process.env.JIRA_TOKEN))
  },

  sync: {
    intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '60'),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  }
};
