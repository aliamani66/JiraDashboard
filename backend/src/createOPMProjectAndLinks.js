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
  console.log('🚀 Creating OPM Project, Epics, Tasks, and Linking to ORD Tasks in Jira Cloud...');

  let userAccountId = '5fa3ff420b4e3a006be6174e';
  try {
    const myself = await client.get('/rest/api/3/myself');
    userAccountId = myself.data.accountId;
  } catch (e) {}

  // 1. Create Project OPM if it doesn't exist
  try {
    await client.get('/rest/api/3/project/OPM');
    console.log('✅ Project OPM already exists.');
  } catch (e) {
    if (e.response?.status === 404) {
      console.log('Creating Project OPM...');
      try {
        await client.post('/rest/api/3/project', {
          key: 'OPM',
          name: 'Operations Management',
          projectTypeKey: 'software',
          projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic',
          leadAccountId: userAccountId
        });
        console.log('✅ Created Project OPM in Jira Cloud!');
      } catch (createErr) {
        console.error('❌ Failed to create project OPM:', createErr.response?.data || createErr.message);
      }
    }
  }

  // Get Issue Link Types available in Jira
  let linkTypeName = 'Blocks';
  try {
    const linkTypes = await client.get('/rest/api/3/issueLinkType');
    console.log('Available Issue Link Types:', linkTypes.data.issueLinkTypes?.map(t => `${t.name} (inward: ${t.inward}, outward: ${t.outward})`));
    if (linkTypes.data.issueLinkTypes?.length > 0) {
      linkTypeName = linkTypes.data.issueLinkTypes[0].name;
    }
  } catch (e) {}

  // 2. Create Epics in OPM
  const opmEpics = [
    {
      summary: 'مدیریت نگهداری و پشتیبانی سرویس‌های عملیاتی (Ops Services Management)',
      description: 'پشتیبانی، پایش زنده و مدیریت حوادث سرویس‌های عملیاتی سازمان. مستندات: https://confluence.example.com/display/OPS/Ops-Management',
      categoryLabel: 'infrastructure',
      capabilities: ['cap:مدیریت-حوادث-۲۴-۷', 'cap:پایش-پایداری-سرویس‌ها'],
      dueDate: '2026-10-30',
      tasks: [
        {
          summary: 'پایش و رفع خطای کلاستر Vault (منتظر تیم امنیت)',
          status: 'Waiting',
          estimateHours: 40,
          spentHours: 15,
          dueDate: '2026-09-15',
          labels: ['wait:تیم-امنیت', 'reason:منتظر-ارائه-توکن-جدید-دسترسی'],
          linkToOrdKey: 'ORD-15'
        },
        {
          summary: 'ارتقاء فایروال شبکه و تایید گواهی‌های SSL (آن‌هولد)',
          status: 'OnHolding',
          estimateHours: 30,
          spentHours: 5,
          dueDate: '2026-09-25',
          labels: ['wait:تیم-شبکه', 'reason:در-انتظار-خرید-تجهیزات-جدید'],
          linkToOrdKey: 'ORD-8'
        },
        {
          summary: 'بررسی لود کلاستر کوبرنتیز و بهینه‌سازی منابع (انجام شده)',
          status: 'Done',
          estimateHours: 50,
          spentHours: 50,
          dueDate: '2026-08-10',
          labels: [],
          linkToOrdKey: 'ORD-10'
        }
      ]
    },
    {
      summary: 'مدیریت تغییرات و انتشار نسخه‌ها (Release & Change Control)',
      description: 'مدیریت فرایند انتشار، تغییرات زیرساختی و کنترل کیفیت دیپلوی‌ها. مستندات: https://confluence.example.com/display/OPS/Release-Control',
      categoryLabel: 'devops',
      capabilities: ['cap:کنترل-تغییرات-خودکار', 'cap:دیپلوی-بدون-خاموشی'],
      dueDate: '2026-11-15',
      tasks: [
        {
          summary: 'تست یکپارچگی Runnerهای CI/CD در محیط عملیات (در حال انجام)',
          status: 'In Progress',
          estimateHours: 35,
          spentHours: 20,
          dueDate: '2026-08-28',
          labels: [],
          linkToOrdKey: 'ORD-3'
        },
        {
          summary: 'ارزیابی امنیتی پکیج‌های Artifact قبل از دیپلوی (منتظر)',
          status: 'Waiting',
          estimateHours: 25,
          spentHours: 8,
          dueDate: '2026-09-18',
          labels: ['wait:تیم-توسعه-هسته', 'reason:در-انتظار-ارسال-سورس-تست‌شده'],
          linkToOrdKey: 'ORD-4'
        }
      ]
    }
  ];

  for (const epicData of opmEpics) {
    try {
      const epicRes = await client.post('/rest/api/3/issue', {
        fields: {
          project: { key: 'OPM' },
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
      console.log(`\n✨ Created OPM Epic: ${epicKey} - ${epicData.summary}`);

      for (const taskData of epicData.tasks) {
        try {
          const taskRes = await client.post('/rest/api/3/issue', {
            fields: {
              project: { key: 'OPM' },
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
          console.log(`   ├─ 📋 Created OPM Task: ${taskKey} (${taskData.status}) - ${taskData.summary}`);

          // Worklog
          if (taskData.spentHours > 0) {
            try {
              await client.post(`/rest/api/3/issue/${taskKey}/worklog`, {
                timeSpentSeconds: taskData.spentHours * 3600,
                comment: {
                  type: 'doc',
                  version: 1,
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: `ثبت کارکرد روی ${taskKey}` }] }]
                }
              });
            } catch (wErr) {}
          }

          // Link to ORD Task if specified
          if (taskData.linkToOrdKey) {
            try {
              await client.post('/rest/api/3/issueLink', {
                type: { name: linkTypeName },
                inwardIssue: { key: taskKey },
                outwardIssue: { key: taskData.linkToOrdKey }
              });
              console.log(`   │  🔗 Linked ${taskKey} -> ${taskData.linkToOrdKey} (${linkTypeName})`);
            } catch (linkErr) {
              console.log(`   │  ⚠️ Linking note for ${taskKey} -> ${taskData.linkToOrdKey}:`, linkErr.response?.data?.errorMessages || linkErr.message);
            }
          }

        } catch (taskErr) {
          console.error(`   ├─ ❌ Task failed:`, taskErr.response?.data || taskErr.message);
        }
      }

    } catch (epicErr) {
      console.error(`❌ Epic failed:`, epicErr.response?.data || epicErr.message);
    }
  }

  console.log('\n✅ OPM Project creation & Issue linking complete!');
}

run();
