require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');
const { initDb, getDb } = require('./db/database');
const { syncJiraData } = require('./services/cacheService');

const BASE_URL = process.env.JIRA_BASE_URL || 'https://aliamani6.atlassian.net';
const USERNAME = process.env.JIRA_USERNAME || 'aliamani66@gmail.com';
const TOKEN = process.env.JIRA_TOKEN;
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY || 'ORD';

const auth = 'Basic ' + Buffer.from(`${USERNAME}:${TOKEN}`).toString('base64');
const headers = { 
  Authorization: auth, 
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

const quarters = ['1405Q1', '1405Q2', '1405Q3', '1404Q4'];

async function requestWithRetry(fn, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.log(`[Attempt ${i + 1}/${retries}] Failed: ${err.code || err.message}`);
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function main() {
  console.log('=== Adding Quarter Labels to Jira Cloud Issues ===');
  await initDb();
  const db = getDb();

  // 1. Search for issues in Jira Cloud
  const isCloud = BASE_URL.includes('.atlassian.net');
  const searchUrl = isCloud 
    ? `${BASE_URL}/rest/api/3/search/jql` 
    : `${BASE_URL}/rest/api/2/search`;

  const jql = `project = ${PROJECT_KEY} ORDER BY created ASC`;
  console.log(`Searching JQL: ${jql}`);

  let issues = [];
  try {
    const res = await requestWithRetry(() => axios.post(searchUrl, {
      jql,
      fields: ['summary', 'labels', 'issuetype'],
      maxResults: 50
    }, { headers, timeout: 15000 }));
    issues = res.data.issues || [];
  } catch (err) {
    console.error('Failed to search Jira Cloud online:', err.message);
  }

  if (issues.length > 0) {
    console.log(`Found ${issues.length} issues in Jira Cloud.`);
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      const selectedQuarter = quarters[i % quarters.length];
      const existingLabels = issue.fields.labels || [];

      if (!existingLabels.includes(selectedQuarter)) {
        const newLabels = Array.from(new Set([...existingLabels, selectedQuarter]));
        console.log(`Updating ${issue.key} (${issue.fields.summary}) -> Labels: ${newLabels.join(', ')}`);

        const updateUrl = isCloud
          ? `${BASE_URL}/rest/api/3/issue/${issue.key}`
          : `${BASE_URL}/rest/api/2/issue/${issue.key}`;

        try {
          await requestWithRetry(() => axios.put(updateUrl, {
            fields: { labels: newLabels }
          }, { headers, timeout: 15000 }));
          console.log(`✅ Successfully updated ${issue.key}`);
        } catch (updateErr) {
          console.error(`❌ Failed to update ${issue.key}:`, updateErr.message);
        }
      } else {
        console.log(`ℹ️ ${issue.key} already has quarter label ${selectedQuarter}`);
      }
    }
  } else {
    console.log('No online issues fetched. Updating local SQLite database tasks with quarter labels for showcase...');
    const tasks = db.prepare('SELECT id, labels FROM tasks').all();
    tasks.forEach((t, idx) => {
      const q = quarters[idx % quarters.length];
      let lArr = [];
      try { lArr = JSON.parse(t.labels || '[]'); } catch { lArr = []; }
      if (!lArr.includes(q)) {
        lArr.push(q);
        db.prepare('UPDATE tasks SET labels = ? WHERE id = ?').run(JSON.stringify(lArr), t.id);
      }
    });
    console.log(`✅ Updated ${tasks.length} local tasks with quarter labels.`);
  }

  // Sync / Refresh local DB
  try {
    console.log('Running syncJiraData...');
    await syncJiraData();
    console.log('Sync finished successfully.');
  } catch (e) {
    console.log('Sync finished or skipped:', e.message);
  }
}

main().catch(console.error);
