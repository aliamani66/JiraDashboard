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

// Rich Test Data Configuration
const epicsToCreate = [
  {
    summary: 'ارتقاء و یکپارچه‌سازی امنیت ابری (Cloud Security Automation)',
    description: 'پیاده‌سازی اسکنرهای امنیتی خودکار (SAST/DAST)، مدیریت کلیدها در Vault و تعریف قوانین فایروال. مستندات کامل: https://confluence.example.com/display/OPS/Security-Automation',
    categoryLabel: 'security',
    capabilities: ['cap:اسکن-خودکار-کد', 'cap:مدیریت-امنیتی-سکرت‌ها', 'cap:انطباق-با-استاندارد-ISO27001'],
    dueDate: '2026-09-30',
    tasks: [
      {
        summary: 'پیاده‌سازی Trivy Container Scanner در پایپ‌لاین CI/CD',
        estimateHours: 40,
        spentHours: 35,
        dueDate: '2026-08-25',
        labels: [],
        worklogs: [{ timeSpentSeconds: 35 * 3600, comment: 'تست و انجام اسکن خودکار روی Imageها' }]
      },
      {
        summary: 'استقرار کلاستر متمرکز HashiCorp Vault برای کلیدها',
        estimateHours: 60,
        spentHours: 20,
        dueDate: '2026-09-10',
        labels: ['wait:تیم-امنیت-شبکه', 'reason:منتظر-تاییدیه-دسترسی-سکرت‌های-اصلی'],
        worklogs: [{ timeSpentSeconds: 20 * 3600, comment: 'راه‌اندازی اولیه کلاستر Vault روی محیط Staging' }]
      },
      {
        summary: 'خودکارسازی تست‌های SAST با SonarQube',
        estimateHours: 30,
        spentHours: 10,
        dueDate: '2026-09-20',
        labels: [],
        worklogs: [{ timeSpentSeconds: 10 * 3600, comment: 'کانفیگ اولیه پروژه در SonarQube' }]
      }
    ]
  },
  {
    summary: 'توسعه فریم‌ورک اختصاصی Go برای اتوماسیون عملیات (Ops Go Framework)',
    description: 'توسعه فریم‌ورک بومی به زبان Go جهت خودکارسازی ساخت پایپ‌لاین‌ها و مدیریت ابزارهای عملیاتی. مستندات: https://confluence.example.com/display/OPS/Go-Framework',
    categoryLabel: 'devops',
    capabilities: ['cap:فریم‌ورک-اختصاصی-Go', 'cap:خودکارسازی-ورکفلوهای-عملیات', 'cap:یکپارچه‌سازی-ابزارهای-داخلی'],
    dueDate: '2026-10-15',
    tasks: [
      {
        summary: 'طراحی Core Engine و CLI اینترفیس فریم‌ورک',
        estimateHours: 80,
        spentHours: 80,
        dueDate: '2026-08-15',
        labels: [],
        worklogs: [{ timeSpentSeconds: 80 * 3600, comment: 'پیاده‌سازی کامل هسته اصلی فریم‌ورک Go' }]
      },
      {
        summary: 'توسعه ماژول خودکارساز کلاستر کوبرنتیز',
        estimateHours: 70,
        spentHours: 40,
        dueDate: '2026-09-05',
        labels: [],
        worklogs: [{ timeSpentSeconds: 40 * 3600, comment: 'توسعه کتابخانه ارتباطی با K8s API به زبان Go' }]
      },
      {
        summary: 'آموزش و تحویل فریم‌ورک به تیم‌های توسعه و عملیات',
        estimateHours: 40,
        spentHours: 5,
        dueDate: '2026-10-01',
        labels: ['wait:تیم‌های-عملیات-و-توسعه', 'reason:هماهنگی-زمان‌بندی-کارگاه-آموزشی'],
        worklogs: [{ timeSpentSeconds: 5 * 3600, comment: 'تهیه اسلایدها و سرفصل‌های دوره آموزشی' }]
      }
    ]
  }
];

async function enrichJira() {
  console.log('🚀 Starting Jira Data Enrichment...');

  // 1. Update existing epics/tasks with duedates if needed
  try {
    const epicsRes = await client.post('/rest/api/3/search/jql', {
      jql: 'project = ORD ORDER BY created ASC',
      fields: ['summary', 'duedate', 'issuetype']
    });

    const issues = epicsRes.data.issues || [];
    console.log(`Found ${issues.length} existing issues in project ORD.`);

    // Set DueDates for existing issues if not set
    let dayOffset = 10;
    for (const issue of issues) {
      if (!issue.fields?.duedate) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + dayOffset);
        const dateStr = futureDate.toISOString().split('T')[0];

        try {
          await client.put(`/rest/api/3/issue/${issue.key}`, {
            fields: { duedate: dateStr }
          });
          console.log(`  📅 Updated DueDate for ${issue.key} -> ${dateStr}`);
        } catch (e) {
          console.error(`  ❌ Failed to set duedate for ${issue.key}:`, e.response?.data || e.message);
        }
        dayOffset += 7;
      }
    }
  } catch (err) {
    console.error('Error updating existing issues:', err.message);
  }

  // 2. Create new rich Epics, Tasks, Worklogs
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
          duedate: epicData.dueDate,
          labels: [epicData.categoryLabel, ...epicData.capabilities]
        }
      });

      const epicKey = epicRes.data.key;
      console.log(`\n✨ Created Rich Epic: ${epicKey} - ${epicData.summary} (Due: ${epicData.dueDate})`);

      for (const taskData of epicData.tasks) {
        try {
          const taskRes = await client.post('/rest/api/3/issue', {
            fields: {
              project: { key: 'ORD' },
              parent: { key: epicKey },
              summary: taskData.summary,
              issuetype: { id: '10010' }, // Task
              duedate: taskData.dueDate,
              timetracking: {
                originalEstimate: `${taskData.estimateHours}h`,
                remainingEstimate: `${Math.max(0, taskData.estimateHours - taskData.spentHours)}h`
              },
              labels: taskData.labels
            }
          });

          const taskKey = taskRes.data.key;
          console.log(`   ├─ 📋 Created Task: ${taskKey} - ${taskData.summary} (Due: ${taskData.dueDate})`);

          // Add Worklogs to task
          for (const wl of taskData.worklogs) {
            try {
              await client.post(`/rest/api/3/issue/${taskKey}/worklog`, {
                timeSpentSeconds: wl.timeSpentSeconds,
                comment: {
                  type: 'doc',
                  version: 1,
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: wl.comment }]
                    }
                  ]
                }
              });
              console.log(`   │  ⏱️ Added Worklog: ${wl.timeSpentSeconds / 3600}h spent on ${taskKey}`);
            } catch (wlErr) {
              console.error(`   │  ❌ Failed Worklog for ${taskKey}:`, wlErr.response?.data || wlErr.message);
            }
          }

        } catch (taskErr) {
          console.error(`   ├─ ❌ Failed Task creation:`, taskErr.response?.data || taskErr.message);
        }
      }

    } catch (epicErr) {
      console.error(`❌ Failed Epic creation:`, epicErr.response?.data || epicErr.message);
    }
  }

  console.log('\n✅ Data enrichment complete!');
}

enrichJira();
