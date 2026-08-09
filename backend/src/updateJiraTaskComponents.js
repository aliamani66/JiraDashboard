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

const taskComponents = [
  { key: 'ORD-3', comp: 'Learning', label: 'comp:learning' },
  { key: 'ORD-4', comp: 'OpsSupport', label: 'comp:support' },
  { key: 'ORD-7', comp: 'Meeting', label: 'comp:meeting' },
  { key: 'ORD-8', comp: 'OpsSupport', label: 'comp:support' },
  { key: 'ORD-11', comp: 'Learning', label: 'comp:learning' },
  { key: 'ORD-12', comp: 'OpsSupport', label: 'comp:support' },
  { key: 'ORD-15', comp: 'Learning', label: 'comp:learning' },
  { key: 'ORD-18', comp: 'Development', label: 'comp:dev' },
  { key: 'ORD-19', comp: 'Development', label: 'comp:dev' },
  { key: 'ORD-20', comp: 'Meeting', label: 'comp:meeting' },
];

async function run() {
  console.log('🏷️ Assigning Components & Labels to Tasks in Jira Cloud...');

  for (const item of taskComponents) {
    try {
      const issueRes = await client.get(`/rest/api/3/issue/${item.key}`);
      const currentLabels = issueRes.data.fields?.labels || [];
      const newLabels = [...new Set([...currentLabels, item.label])];

      await client.put(`/rest/api/3/issue/${item.key}`, {
        fields: {
          labels: newLabels
        }
      });
      console.log(`✅ Updated ${item.key} with component label: ${item.label}`);
    } catch (e) {
      console.error(`Failed ${item.key}:`, e.message);
    }
  }

  console.log('Component assignment complete!');
}

run();
