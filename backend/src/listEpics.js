// اسکریپت: دریافت اپیک‌های پروژه ORD از Jira Cloud
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const BASE_URL = process.env.JIRA_BASE_URL;
const USERNAME = process.env.JIRA_USERNAME;
const TOKEN = process.env.JIRA_TOKEN;
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY;

const auth = 'Basic ' + Buffer.from(`${USERNAME}:${TOKEN}`).toString('base64');

async function getEpics() {
  const jql = `project = ${PROJECT_KEY} AND issuetype = Epic ORDER BY created ASC`;
  const url = `${BASE_URL}/rest/api/3/search/jql`;

  const res = await axios.post(url, {
    jql,
    fields: ['summary', 'labels', 'status', 'issuetype'],
    maxResults: 50
  }, {
    headers: { Authorization: auth, 'Content-Type': 'application/json' }
  });

  const issues = res.data.issues || [];
  console.log(`\nتعداد اپیک‌ها: ${issues.length}\n`);
  issues.forEach((i, idx) => {
    console.log(`${idx + 1}. [${i.key}] ${i.fields.summary}`);
    console.log(`   وضعیت: ${i.fields.status?.name} | لیبل‌ها: ${JSON.stringify(i.fields.labels)}`);
  });

  return issues;
}

getEpics().catch(e => {
  console.error('خطا:', e.response?.data || e.message);
});
