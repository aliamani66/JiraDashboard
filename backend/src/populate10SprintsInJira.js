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

// Definition of 10 Sprints with realistic operational tasks, components, and waiting statuses
const tenSprintsData = [
  {
    sprintName: 'Sprint 1 - فاز زیرساخت اولیه',
    tasks: [
      { summary: 'تاسیس مخزن کد اصلی و خط‌لوله GitLab', comp: 'comp:infrastructure', assignee: 'Ali Amani', status: 'Done', spent: 16, est: 16 },
      { summary: 'تعریف ساختار اولیه معماری سیستم R&D', comp: 'comp:architecture', assignee: 'Ali Amani', status: 'Done', spent: 20, est: 20 }
    ]
  },
  {
    sprintName: 'Sprint 2 - توسعه و مانیتورینگ',
    tasks: [
      { summary: 'نصب پرومتیوس و گرافانا روی کلاستر توسعه', comp: 'comp:monitoring', assignee: 'Ali Amani', status: 'Done', spent: 24, est: 24 },
      { summary: 'طراحی پایپ‌لاین CI/CD سرویس‌های تست', comp: 'comp:devops', assignee: 'Ali Amani', status: 'Done', spent: 18, est: 18 }
    ]
  },
  {
    sprintName: 'Sprint 3 - امنیت و دسترسی‌ها',
    tasks: [
      { summary: 'ارزیابی امنیتی پورت‌های ورودی کلاستر', comp: 'comp:security', assignee: 'Ali Amani', status: 'Waiting', waitTeam: 'تیم-امنیت-OPM', spent: 10, est: 30 },
      { summary: 'دریافت مجوزهای شبکه اختصاصی سرویس‌ها', comp: 'comp:networking', assignee: 'Ali Amani', status: 'Waiting', waitTeam: 'تیم-شبکه-داده', spent: 8, est: 25 }
    ]
  },
  {
    sprintName: 'Sprint 4 - آموزش و یادگیری',
    tasks: [
      { summary: 'برگزاری کارگاه آموزشی Kubernetes برای تیم Ops', comp: 'comp:learning', assignee: 'Ali Amani', status: 'Done', spent: 14, est: 14 },
      { summary: 'مستندسازی استاندارد دیپلوی سرویس‌ها', comp: 'comp:documentation', assignee: 'Ali Amani', status: 'Done', spent: 12, est: 12 }
    ]
  },
  {
    sprintName: 'Sprint 5 - دیتابیس و ذخیره‌سازی',
    tasks: [
      { summary: 'راه اندازی پایگاه داده PostgreSQL HA کلاستر', comp: 'comp:database', assignee: 'Ali Amani', status: 'Done', spent: 30, est: 30 },
      { summary: 'تحقیق روی ذخیره‌ساز توزیع شده Ceph', comp: 'comp:research', assignee: 'Ali Amani', status: 'Done', spent: 16, est: 16 }
    ]
  },
  {
    sprintName: 'Sprint 6 - هوش مصنوعی و مدل‌ها',
    tasks: [
      { summary: 'دیپلوی مدل هوش مصنوعی پردازش متن روی GPU', comp: 'comp:ai', assignee: 'Ali Amani', status: 'Done', spent: 28, est: 28 },
      { summary: 'برگزاری جلسه هماهنگی با تیم محصول', comp: 'comp:meeting', assignee: 'Ali Amani', status: 'Done', spent: 8, est: 8 }
    ]
  },
  {
    sprintName: 'Sprint 7 - پشتیبانی و نگهداری',
    tasks: [
      { summary: 'پشتیبانی از سرورهای عملیاتی فاز اول', comp: 'comp:support', assignee: 'Ali Amani', status: 'Done', spent: 40, est: 40 },
      { summary: 'اجرای تست‌های نفوذ پذیری و بار روی سرویس‌ها', comp: 'comp:testing', assignee: 'Ali Amani', status: 'Waiting', waitTeam: 'تیم-تست-کیفیت-خارجی', spent: 12, est: 35 }
    ]
  },
  {
    sprintName: 'Sprint 8 - توسعه قابلیت‌های پیشرفته',
    tasks: [
      { summary: 'توسعه ماژول خودکارسازی بک‌آپ دیتابیس‌ها', comp: 'comp:dev', assignee: 'Ali Amani', status: 'Done', spent: 22, est: 22 },
      { summary: 'بررسی لایسنس‌ها و توکن‌های اتصال سیستم', comp: 'comp:security', assignee: 'Ali Amani', status: 'Waiting', waitTeam: 'تیم-امور-قراردادها', spent: 6, est: 20 }
    ]
  },
  {
    sprintName: 'Sprint 9 - بهینه‌سازی کلاستر',
    tasks: [
      { summary: 'بهینه‌سازی منابع پردازشی کلاستر k8s', comp: 'comp:infrastructure', assignee: 'Ali Amani', status: 'Done', spent: 25, est: 25 },
      { summary: 'تنظیم هشدارهای پیشگیرانه مانیتورینگ', comp: 'comp:monitoring', assignee: 'Ali Amani', status: 'Done', spent: 15, est: 15 }
    ]
  },
  {
    sprintName: 'Sprint 10 - اسپرینت جاری عملیاتی',
    tasks: [
      { summary: 'ارتقای روترهای لبه شبکه عملیات', comp: 'comp:networking', assignee: 'Ali Amani', status: 'Waiting', waitTeam: 'تیم-زیرساخت-شبکه-ارتباطات', spent: 8, est: 40 },
      { summary: 'تکمیل فاز نهایی مستندات تحویل سیستم', comp: 'comp:documentation', assignee: 'Ali Amani', status: 'In Progress', spent: 18, est: 36 }
    ]
  }
];

async function run() {
  console.log('🚀 Starting creation of 10 Sprints & Realistic Test Tasks in Jira Cloud...');

  const projectKey = process.env.JIRA_PROJECT_KEY || 'ORD';

  for (let sIdx = 0; sIdx < tenSprintsData.length; sIdx++) {
    const sprint = tenSprintsData[sIdx];
    console.log(`\n📌 Creating tasks for ${sprint.sprintName}...`);

    for (const t of sprint.tasks) {
      const labels = [
        t.comp,
        `sprint:${sprint.sprintName.split(' ')[1]}` // e.g. sprint:1
      ];

      if (t.status === 'Waiting' && t.waitTeam) {
        labels.push(`wait:${t.waitTeam}`);
      }

      try {
        const issuePayload = {
          fields: {
            project: { key: projectKey },
            summary: `[${sprint.sprintName.split(' - ')[0]}] ${t.summary}`,
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: `تسک عملیاتی متعلق به ${sprint.sprintName}` }]
                }
              ]
            },
            issuetype: { name: 'Task' },
            labels: labels,
            timetracking: {
              originalEstimate: `${t.est}h`
            }
          }
        };

        const createRes = await client.post('/rest/api/3/issue', issuePayload);
        const newKey = createRes.data.key;
        console.log(`  ✅ Created ${newKey}: ${t.summary} (${t.comp})`);

        // Add worklog if spent > 0
        if (t.spent > 0) {
          await client.post(`/rest/api/3/issue/${newKey}/worklog`, {
            timeSpentSeconds: t.spent * 3600,
            comment: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: `ثبت ${t.spent} ساعت کارکرد عملیاتی` }]
                }
              ]
            }
          });
        }

        // Transition status if Done or Waiting
        if (t.status === 'Done') {
          // Attempt transition to Done
          const transitionsRes = await client.get(`/rest/api/3/issue/${newKey}/transitions`);
          const doneTrans = transitionsRes.data.transitions.find(tr => tr.name.toLowerCase().includes('done') || tr.name.toLowerCase().includes('complete'));
          if (doneTrans) {
            await client.post(`/rest/api/3/issue/${newKey}/transitions`, {
              transition: { id: doneTrans.id }
            });
          }
        }
      } catch (err) {
        console.error(`  ❌ Error creating task "${t.summary}":`, err.response?.data || err.message);
      }
    }
  }

  console.log('\n🎉 All 10 Sprints & Tasks populated in Jira Cloud!');
}

run();
