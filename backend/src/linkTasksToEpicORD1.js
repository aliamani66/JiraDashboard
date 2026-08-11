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
  console.log('🔗 Linking new 20 tasks (ORD-27 to ORD-46) to Epic ORD-1...');

  for (let id = 27; id <= 46; id++) {
    const key = `ORD-${id}`;
    try {
      await client.put(`/rest/api/3/issue/${key}`, {
        fields: {
          parent: { key: 'ORD-1' }
        }
      });
      console.log(`✅ Linked ${key} to parent Epic ORD-1`);
    } catch (e) {
      console.error(`Failed linking ${key}:`, e.response?.data || e.message);
    }
  }

  console.log('Linking complete!');
}

run();
