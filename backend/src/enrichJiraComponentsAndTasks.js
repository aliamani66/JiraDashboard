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

// New test tasks for components
const newTestTasks = [
  // 📘 Learning Tasks
  {
    epicKey: 'ORD-1',
    summary: 'آموزش و کارگاه عملی معماری Istio Service Mesh',
    componentLabel: 'comp:learning',
    estimate: 40 * 3600,
    spent: 15 * 3600,
    dueDate: '2026-08-30'
  },
  {
    epicKey: 'ORD-9',
    summary: 'مطالعه و بررسی تکنولوژی eBPF و مانیتورینگ Cilium',
    componentLabel: 'comp:learning',
    estimate: 35 * 3600,
    spent: 20 * 3600,
    dueDate: '2026-09-15'
  },

  // 👥 Meeting Tasks
  {
    epicKey: 'ORD-5',
    summary: 'جلسه هماهنگی عارضه‌یابی مانیتورینگ با تیم شبکه',
    componentLabel: 'comp:meeting',
    estimate: 15 * 3600,
    spent: 10 * 3600,
    dueDate: '2026-09-05'
  },
  {
    epicKey: 'ORD-17',
    summary: 'جلسه بازبینی معمارانه فریم‌ورک اختصاصی Go',
    componentLabel: 'comp:meeting',
    estimate: 20 * 3600,
    spent: 8 * 3600,
    dueDate: '2026-10-10'
  },

  // 🛠️ OpsSupport Tasks
  {
    epicKey: 'ORD-9',
    summary: 'پشتیبانی عملیاتی رفع اختلال NGINX Ingress Controller',
    componentLabel: 'comp:support',
    estimate: 30 * 3600,
    spent: 12 * 3600,
    dueDate: '2026-09-20'
  },
  {
    epicKey: 'ORD-13',
    summary: 'پشتیبانی عملیاتی و تست بازگردانی بک‌آپ سرور Vault',
    componentLabel: 'comp:support',
    estimate: 25 * 3600,
    spent: 10 * 3600,
    dueDate: '2026-09-28'
  }
];

async function run() {
  console.log('🚀 Creating test tasks for Learning, Meeting, OpsSupport in Jira Cloud...');

  for (const item of newTestTasks) {
    try {
      const payload = {
        fields: {
          project: { key: 'ORD' },
          summary: item.summary,
          issuetype: { name: 'Task' },
          parent: { key: item.epicKey },
          labels: [item.componentLabel],
          duedate: item.dueDate,
          timetracking: {
            originalEstimate: `${item.estimate / 3600}h`
          }
        }
      };

      const res = await client.post('/rest/api/3/issue', payload);
      console.log(`✅ Created Jira Task: ${res.data.key} under ${item.epicKey} (${item.componentLabel})`);

      // Add worklog for spent time
      try {
        await client.post(`/rest/api/3/issue/${res.data.key}/worklog`, {
          timeSpentSeconds: item.spent,
          comment: {
            type: 'doc',
            version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ثبت لاگ کارکرد تستی در جیرا' }] }]
          }
        });
        console.log(`⏱️ Added worklog for ${res.data.key}`);
      } catch (wErr) {
        console.log(`Worklog note:`, wErr.message);
      }

    } catch (err) {
      console.error(`❌ Failed to create task under ${item.epicKey}:`, err.response?.data?.errors || err.response?.data || err.message);
    }
  }

  console.log('\nTest task creation complete!');
}

run();
