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

const epicsToCreate = [
  {
    summary: 'پایپ‌لاین جامع CI/CD تیم عملیات',
    description: 'پیاده‌سازی پایپ‌لاین‌های خودکارسازی تست، بیلد و دیپلوی سرویس‌ها. مستندات تکمیلی: https://confluence.example.com/display/OPS/CI-CD',
    categoryLabel: 'devops',
    capabilities: ['cap:خودکارسازی-دیپلوی', 'cap:کاهش-خطای-انسانی', 'cap:سرعت-تحویل-بالا'],
    tasks: [
      { summary: 'طراحی معماری GitLab CI/CD', estimate: 40, spent: 40, status: 'Done', labels: [] },
      { summary: 'راه‌اندازی Runnerهای اختصاصی کلاستر', estimate: 60, spent: 45, status: 'In Progress', labels: [] },
      { summary: 'یکپارچه‌سازی امنیتی با HashiCorp Vault', estimate: 30, spent: 10, status: 'To Do', labels: ['wait:تیم-امنیت', 'reason:نیازمند-اعطای-دسترسی-سکرت‌ها'] }
    ]
  },
  {
    summary: 'استک مانیتورینگ و هشدارهای پیشگیرانه',
    description: 'راه‌اندازی Prometheus، Grafana و سیستم الارتینگ هوشمند. مستندات: https://confluence.example.com/display/OPS/Monitoring',
    categoryLabel: 'monitoring',
    capabilities: ['cap:هشدارهای-پیشگیرانه', 'cap:داشبورد-متمرکز-لاگ', 'cap:کاهش-Downtime'],
    tasks: [
      { summary: 'استقرار Prometheus Operator در کلاستر', estimate: 50, spent: 50, status: 'Done', labels: [] },
      { summary: 'طراحی داشبوردهای مدیریتی Grafana', estimate: 40, spent: 25, status: 'In Progress', labels: [] },
      { summary: 'تنظیم کانال هشدارهای تلگرام و PagerDuty', estimate: 20, spent: 5, status: 'To Do', labels: ['wait:تیم-شبکه', 'reason:نیازمند-باز-کردن-پورت-فایروال'] }
    ]
  },
  {
    summary: 'مهاجرت سرویس‌های هسته به کلاستر کوبرنتیز',
    description: 'انتقال و استانداردسازی تمام سرویس‌های عملیاتی روی K8s. مستندات: https://confluence.example.com/display/OPS/K8s-Migration',
    categoryLabel: 'infrastructure',
    capabilities: ['cap:مقیاس‌پذیری-خودکار', 'cap:پایداری-۹۹.۹٪', 'cap:مدیریت-منابع-کلاستر'],
    tasks: [
      { summary: 'آماده‌سازی کلاستر K8s اولیه و Workerها', estimate: 80, spent: 80, status: 'Done', labels: [] },
      { summary: 'ایجاد و بهینه‌سازی Helm Chart سرویس‌ها', estimate: 60, spent: 30, status: 'In Progress', labels: [] },
      { summary: 'تنظیمات NGINX Ingress Controller و SSL', estimate: 25, spent: 5, status: 'To Do', labels: ['wait:تیم-زیرساخت', 'reason:نیازمند-تخصیص-IP-والید-و-ثبت-DNS'] }
    ]
  }
];

async function run() {
  console.log('Creating test Epics and Tasks in Jira Cloud project ORD...');
  
  for (const epicData of epicsToCreate) {
    try {
      const epicRes = await client.post('/rest/api/3/issue', {
        fields: {
          project: { key: 'ORD' },
          summary: epicData.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: epicData.description }]
              }
            ]
          },
          issuetype: { id: '10000' }, // Epic
          labels: [epicData.categoryLabel, ...epicData.capabilities]
        }
      });

      const epicKey = epicRes.data.key;
      console.log(`✅ Created Epic: ${epicKey} - ${epicData.summary}`);

      for (const taskData of epicData.tasks) {
        try {
          const taskRes = await client.post('/rest/api/3/issue', {
            fields: {
              project: { key: 'ORD' },
              parent: { key: epicKey }, // Link task to Epic
              summary: taskData.summary,
              issuetype: { id: '10010' }, // Task
              timetracking: {
                originalEstimate: `${taskData.estimate}h`,
                remainingEstimate: `${Math.max(0, taskData.estimate - taskData.spent)}h`
              },
              labels: taskData.labels
            }
          });
          console.log(`   └─ ✅ Created Task: ${taskRes.data.key} - ${taskData.summary}`);
        } catch (taskErr) {
          console.error(`   └─ ❌ Task creation failed:`, taskErr.response?.data || taskErr.message);
        }
      }

    } catch (epicErr) {
      console.error(`❌ Epic creation failed:`, epicErr.response?.data || epicErr.message);
    }
  }

  console.log('\nSeed script finished!');
}

run();
