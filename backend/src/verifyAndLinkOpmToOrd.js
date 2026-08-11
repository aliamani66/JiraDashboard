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

// Links: OPM task blocks ORD task
const linksToCreate = [
  { inwardKey: 'ORD-3', outwardKey: 'OPM-6', type: 'Blocks', team: 'پروژه صنعتی OPM', reason: 'نیازمند تکمیل تست یکپارچگی Runnerها در پروژه OPM' },
  { inwardKey: 'ORD-4', outwardKey: 'OPM-2', type: 'Blocks', team: 'تیم امنیت Vault (OPM)', reason: 'در انتظار تایید توکن‌ها و کلیدهای دسترسی پروژه OPM' },
  { inwardKey: 'ORD-8', outwardKey: 'OPM-3', type: 'Blocks', team: 'تیم زیرساخت شبکه (OPM)', reason: 'در انتظار باز شدن پورت‌های فایروال در پروژه OPM' },
  { inwardKey: 'ORD-12', outwardKey: 'OPM-4', type: 'Blocks', team: 'تیم سرور و کلاستر (OPM)', reason: 'در انتظار تخصیص IP و دامنه اختصاصی NGINX' },
  { inwardKey: 'ORD-15', outwardKey: 'OPM-7', type: 'Blocks', team: 'تیم ارزیابی امنیتی (OPM)', reason: 'در انتظار صدور گواهی ارزیابی امنیتی کلاستر Vault' },
];

async function run() {
  console.log('🔗 Creating Issue Links between OPM tasks and ORD tasks in Jira Cloud...');

  for (const item of linksToCreate) {
    try {
      await client.post('/rest/api/3/issueLink', {
        type: { name: 'Blocks' },
        inwardIssue: { key: item.inwardKey },   // ORD task is blocked by
        outwardIssue: { key: item.outwardKey }  // OPM task
      });
      console.log(`✅ Linked: ${item.inwardKey} IS BLOCKED BY ${item.outwardKey}`);

      // Also add explicit wait labels to ORD task for robust fallback
      const ordIssue = await client.get(`/rest/api/3/issue/${item.inwardKey}`);
      const currentLabels = ordIssue.data.fields?.labels || [];
      const newLabels = [
        ...new Set([
          ...currentLabels,
          `wait:${item.team.replace(/\s+/g, '-')}`,
          `reason:${item.reason.replace(/\s+/g, '-')}`
        ])
      ];

      await client.put(`/rest/api/3/issue/${item.inwardKey}`, {
        fields: { labels: newLabels }
      });
      console.log(`🏷️ Updated labels for ${item.inwardKey}`);

    } catch (err) {
      console.log(`Note for link ${item.inwardKey} -> ${item.outwardKey}:`, err.response?.data?.errorMessages || err.message);
    }
  }

  console.log('\nLinking complete!');
}

run();
