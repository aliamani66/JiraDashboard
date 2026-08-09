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

// Epics test descriptions in Jira ADF format
const epicDescriptions = {
  'ORD-1': 'پیاده‌سازی متمرکز پایپ‌لاین‌های CI/CD جهت خودکارسازی تست‌ها، ایمیج‌سازی و استقرار امن برنامه‌ها روی کلاستر کوبرنتیز.',
  'ORD-5': 'استقرار فریم‌ورک پایش متمرکز شامل Prometheus و Grafana جهت مانیتورینگ عملکرد زیرساخت و سرویس‌ها.',
  'ORD-9': 'ایجاد زیرساخت کوبرنتیز و Helm جهت ارتقاء پایداری، مقیاس‌پذیری و مدیریت متمرکز کانتینرها.',
  'ORD-13': 'یکپارچه‌سازی ابزارهای اسکن امنیتی سورس‌کد و کانتینرها جهت شناسایی سریع آسیب‌پذیری‌ها در فرایند توسعه.',
  'ORD-17': 'توسعه ابزارها و اتوماسیون کلاستر K8s جهت مدیریت آسان‌تر منابع و تسهیل فرایند استقرار سرویس‌ها.',
  'OPM-1': 'مدیریت خدمات متمرکز عملیاتی و ارتقاء امنیت زیرساخت شبکه و سرویس‌های پایه آر‌انددی.',
  'OPM-5': 'ارزیابی پایداری کلاسترها و تست یکپارچگی ابزارهای CI/CD در محیط تست عملیاتی.'
};

function textToAdf(text) {
  return {
    version: 1,
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: text
          }
        ]
      }
    ]
  };
}

async function run() {
  console.log('📝 Updating Epic Descriptions in Jira Cloud...');

  for (const [epicKey, descText] of Object.entries(epicDescriptions)) {
    try {
      await client.put(`/rest/api/3/issue/${epicKey}`, {
        fields: {
          description: textToAdf(descText)
        }
      });
      console.log(`✅ Updated description for ${epicKey}`);
    } catch (err) {
      console.error(`❌ Failed to update ${epicKey}:`, err.response?.data?.errorMessages || err.message);
    }
  }

  console.log('\nEpic descriptions update complete!');
}

run();
