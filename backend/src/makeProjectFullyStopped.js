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
  console.log('🛑 Setting ORD-21 to Waiting state to trigger 100% Full Stoppage Alert on ORD-1...');

  try {
    // 1. Get transitions for ORD-21
    const transRes = await client.get('/rest/api/3/issue/ORD-21/transitions');
    const transitions = transRes.data.transitions || [];
    const backlogTrans = transitions.find(t => t.name.toLowerCase().includes('backlog') || t.id === '11');

    // 2. Set labels on ORD-21 to mark as waiting for security team
    await client.put('/rest/api/3/issue/ORD-21', {
      fields: {
        labels: ['comp:learning', 'wait:تیم-امنیت-شبکه', 'reason:منتظر-بررسی-امنیتی-پایپ‌لاین-Istio']
      }
    });

    console.log('✅ Updated ORD-21 labels to trigger waiting status');
  } catch (e) {
    console.error('Error updating ORD-21:', e.response?.data || e.message);
  }
}

run();
