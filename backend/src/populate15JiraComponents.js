const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const baseUrl = process.env.JIRA_BASE_URL || 'https://aliamani6.atlassian.net';
const auth = 'Basic ' + Buffer.from(`${process.env.JIRA_USERNAME}:${process.env.JIRA_TOKEN}`).toString('base64');

const client = axios.create({
  baseURL: baseUrl,
  headers: {
    Authorization: auth,
    'Content-Type': 'application/json'
  }
});

const fifteenComponentsTasks = [
  { key: 'ORD-2', compLabel: 'comp:architecture' },
  { key: 'ORD-3', compLabel: 'comp:learning' },
  { key: 'ORD-4', compLabel: 'comp:security' },
  { key: 'ORD-5', compLabel: 'comp:testing' },
  { key: 'ORD-6', compLabel: 'comp:infrastructure' },
  { key: 'ORD-7', compLabel: 'comp:meeting' },
  { key: 'ORD-8', compLabel: 'comp:support' },
  { key: 'ORD-9', compLabel: 'comp:documentation' },
  { key: 'ORD-10', compLabel: 'comp:devops' },
  { key: 'ORD-11', compLabel: 'comp:monitoring' },
  { key: 'ORD-12', compLabel: 'comp:ai' },
  { key: 'ORD-13', compLabel: 'comp:database' },
  { key: 'ORD-14', compLabel: 'comp:networking' },
  { key: 'ORD-15', compLabel: 'comp:research' },
  { key: 'ORD-16', compLabel: 'comp:dev' },
  { key: 'ORD-21', compLabel: 'comp:learning' },
  { key: 'ORD-22', compLabel: 'comp:research' },
  { key: 'ORD-23', compLabel: 'comp:meeting' },
  { key: 'ORD-24', compLabel: 'comp:devops' },
  { key: 'ORD-25', compLabel: 'comp:support' },
  { key: 'ORD-26', compLabel: 'comp:database' }
];

async function run() {
  console.log('🏷️ Assigning 15 distinct Jira components directly in Jira Cloud...');

  for (const item of fifteenComponentsTasks) {
    try {
      const issueRes = await client.get(`/rest/api/3/issue/${item.key}`);
      const currentLabels = issueRes.data.fields?.labels || [];

      // Replace old comp: labels with new dynamic comp: label
      const cleanLabels = currentLabels.filter(l => !l.startsWith('comp:'));
      const finalLabels = [...cleanLabels, item.compLabel];

      await client.put(`/rest/api/3/issue/${item.key}`, {
        fields: {
          labels: finalLabels
        }
      });
      console.log(`✅ Updated ${item.key} in Jira with component: ${item.compLabel}`);
    } catch (e) {
      console.error(`Failed ${item.key}:`, e.message);
    }
  }

  console.log('\n15 Jira Component labeling completed!');
}

run();
