const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const baseUrl = process.env.JIRA_BASE_URL || 'https://10.100.71.140:8443';
const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_USERNAME}:${process.env.JIRA_TOKEN}`).toString('base64');

const client = axios.create({
  baseURL: baseUrl,
  headers: {
    Authorization: auth,
    'Content-Type': 'application/json'
  }
});

async function run() {
  console.log('🔍 Debugging Jira issues for ORD project...');

  // Search all issues in ORD project
  const res = await client.post('/rest/api/3/search/jql', {
    jql: 'project = ORD ORDER BY key ASC',
    fields: ['summary', 'parent', 'customfield_10014', 'issuetype', 'labels']
  });

  const issues = res.data.issues || [];
  console.log(`Total issues found in ORD project: ${issues.length}`);

  issues.forEach(i => {
    const parentKey = i.fields?.parent?.key || i.fields?.customfield_10014 || 'NONE';
    console.log(`${i.key} (${i.fields?.issuetype?.name}): ${i.fields?.summary} | Parent/Epic: ${parentKey}`);
  });
}

run();
