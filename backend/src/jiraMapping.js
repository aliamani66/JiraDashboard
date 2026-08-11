/**
 * Jira & Confluence Mapping Configuration
 * تنظیمات و مپینگ فیلدها، وضعیت‌ها، تاریخ‌ها، کاستوم فیلدها و اتصال کانفلوئنس
 */

require('dotenv').config();

module.exports = {
  // 1. وضعیت‌های تسک که نشان‌دهنده "منتظر / On Hold / Blocked" هستند
  waitingStatuses: (process.env.JIRA_WAITING_STATUSES || 'OnHolding,Waiting,Blocked,On Hold,In Review').split(',').map(s => s.trim()),

  // 2. تنظیمات اتصال به Confluence (مستندات سازمان)
  confluence: {
    baseUrl: process.env.CONFLUENCE_BASE_URL || 'https://10.100.71.140:8443/wiki',
    username: process.env.CONFLUENCE_USERNAME || process.env.JIRA_USERNAME || '',
    token: process.env.CONFLUENCE_TOKEN || process.env.JIRA_TOKEN || '',
    // الگو ساخت لینک مستقیم به مستندات کانفلوئنس در صورت عدم وجود لینک صریح
    defaultSpaceKey: process.env.CONFLUENCE_DEFAULT_SPACE || 'OPS'
  },

  // 3. تنظیمات فیلدهای تاریخ (Date Field Mapping)
  dateMapping: {
    epicStartDateField: process.env.JIRA_EPIC_START_DATE_FIELD || 'created', 
    epicDueDateField: process.env.JIRA_EPIC_DUE_DATE_FIELD || 'duedate',
    taskStartDateField: process.env.JIRA_TASK_START_DATE_FIELD || null,
    taskDueDateField: process.env.JIRA_TASK_DUE_DATE_FIELD || 'duedate',
  },

  // 4. پشتیبانی از کاستوم فیلدهای اختصاصی جیرا (Custom Fields Mapping)
  customFields: {
    sprintField: process.env.JIRA_SPRINT_FIELD || 'customfield_10020',
    waitingTeamField: process.env.JIRA_WAITING_TEAM_FIELD || 'customfield_16800', 
    waitingReasonField: process.env.JIRA_WAITING_REASON_FIELD || null,
    confluenceLinkField: process.env.JIRA_CONFLUENCE_LINK_FIELD || null,
    capabilitiesField: process.env.JIRA_CAPABILITIES_FIELD || null,
    categoryField: process.env.JIRA_CATEGORY_FIELD || null,
  },

  // 5. نگاشت وضعیت‌های جیرا به وضعیت‌های استاندارد داشبورد (Status Mapping)
  statusMapping: {
    'Done': 'Done',
    'Completed': 'Done',
    'Resolved': 'Done',
    'Closed': 'Done',
    'In Progress': 'In Progress',
    'In Development': 'In Progress',
    'Testing': 'In Progress',
    'QA': 'In Progress',
    'OnHolding': 'Waiting',
    'Waiting': 'Waiting',
    'Blocked': 'Waiting',
    'On Hold': 'Waiting',
    'Awaiting Approval': 'Waiting',
    'Pending External Vendor': 'Waiting',
    'Hold by Infra': 'Waiting',
    'منتظر تایید': 'Waiting',
    'در انتظار پیمانکار': 'Waiting',
    'To Do': 'To Do',
    'Backlog': 'To Do',
    'Open': 'To Do'
  },

  // 6. پیشوندهای لیبل‌ها در جیرا (Label Prefixes)
  labelPrefixes: {
    waitingTeam: process.env.JIRA_WAIT_TEAM_PREFIX || 'wait:',
    waitingReason: process.env.JIRA_WAIT_REASON_PREFIX || 'reason:',
    capability: process.env.JIRA_CAPABILITY_PREFIX || 'cap:',
  },

  // 7. نگاشت دسته‌بندی پروژه‌ها بر اساس Label های اپیک
  categoryMapping: {
    'devops': 'devops',
    'monitoring': 'monitoring',
    'infrastructure': 'infrastructure',
    'security': 'security',
    'ai': 'ai',
    'training': 'training'
  },

  // 8. ۳ کامپوننت پیش‌فرض برای دکمه‌های سریع داشبورد (Featured Quick Buttons)
  featuredComponents: (process.env.JIRA_FEATURED_COMPONENTS || 'learning,meeting,support').split(',').map(s => s.trim().toLowerCase())
};
