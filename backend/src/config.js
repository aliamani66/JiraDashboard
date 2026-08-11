require('dotenv').config();
const jiraMapping = require('./jiraMapping');

// تنظیم خودکار پرچم SSL برای سیستم‌های داخلی
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const defaultJiraUrl = 'https://10.100.71.140:8443';
const defaultJiraUser = 'm.ghafoory';

module.exports = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
  
  // 1. Jira Configuration
  jira: {
    baseUrl: process.env.JIRA_BASE_URL || defaultJiraUrl,
    username: process.env.JIRA_USERNAME || defaultJiraUser,
    token: process.env.JIRA_TOKEN || '',
    projectKey: process.env.JIRA_PROJECT_KEY || 'ORD',
    isConfigured: !!(process.env.JIRA_BASE_URL || defaultJiraUrl),
    mapping: jiraMapping
  },
  
  // 2. Confluence Configuration
  confluence: {
    baseUrl: process.env.CONFLUENCE_BASE_URL || `${defaultJiraUrl}/wiki`,
    username: process.env.CONFLUENCE_USERNAME || defaultJiraUser,
    token: process.env.CONFLUENCE_TOKEN || process.env.JIRA_TOKEN || '',
    isConfigured: true
  },

  sync: {
    intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '60'),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  }
};
