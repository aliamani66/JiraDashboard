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

const multiComponentTasks = [
  // 🏛️ Architecture
  { key: 'ORD-2', compLabel: 'comp:architecture', summary: 'طراحی معماری پایپ‌لاین CI/CD' },
  { key: 'ORD-14', compLabel: 'comp:architecture', summary: 'طراحی معماری شبکه Istio' },
  
  // 🛡️ Security
  { key: 'ORD-4', compLabel: 'comp:security', summary: 'یکپارچه‌سازی امنیتی با HashiCorp Vault' },
  { key: 'ORD-10', compLabel: 'comp:security', summary: 'پیاده‌سازی مکانیزم احراز هویت TLS' },

  // 🌐 Infrastructure
  { key: 'ORD-6', compLabel: 'comp:infrastructure', summary: 'راه‌اندازی کلاستر کوبرنتیز' },
  { key: 'ORD-16', compLabel: 'comp:infrastructure', summary: 'پیکربندی استوریج متمرکز کلاستر' },

  // 🔬 Research
  { key: 'ORD-22', compLabel: 'comp:research', summary: 'تحقیق و لبه دانش eBPF و Cilium' },
  { key: 'ORD-15', compLabel: 'comp:research', summary: 'ارزیابی سیستم‌های رمزنگاری پیشرفته' },

  // 🧪 QA-Testing
  { key: 'ORD-5', compLabel: 'comp:testing', summary: 'تست‌های کارایی و بار بارگذاری' },
  { key: 'ORD-13', compLabel: 'comp:testing', summary: 'سناریوهای تست نفوذ پذیری' },

  // 📝 Documentation
  { key: 'ORD-9', compLabel: 'comp:documentation', summary: 'مستندسازی دفترچه راهنمای عملیاتی' },
  { key: 'ORD-17', compLabel: 'comp:documentation', summary: 'تهیه شناسنامه فنی سرویس‌ها' },
];

async function run() {
  console.log('🏷️ Adding 7 dynamic R&D components (Architecture, Security, Infrastructure, Research, Testing, Documentation, Dev) to Jira Cloud...');

  for (const item of multiComponentTasks) {
    try {
      const issueRes = await client.get(`/rest/api/3/issue/${item.key}`);
      const currentLabels = issueRes.data.fields?.labels || [];

      // Filter out existing comp: labels and add new one
      const cleanLabels = currentLabels.filter(l => !l.startsWith('comp:'));
      const finalLabels = [...cleanLabels, item.compLabel];

      await client.put(`/rest/api/3/issue/${item.key}`, {
        fields: {
          labels: finalLabels
        }
      });
      console.log(`✅ Updated Jira Task ${item.key} with component label: ${item.compLabel}`);
    } catch (e) {
      console.error(`Failed to update ${item.key}:`, e.message);
    }
  }

  console.log('\nDynamic Jira component labeling complete!');
}

run();
