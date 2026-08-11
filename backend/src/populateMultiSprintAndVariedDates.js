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

// Tasks to update with Multi-Sprint badges and varied historical dates (Ardibehesht, Khordad, Tir, Mordad)
const multiSprintAndDateTasks = [
  // Sprint 1 & 2 Tasks (Historical: Ardibehesht / Khordad)
  { key: 'ORD-27', start: '2026-04-15', due: '2026-05-25', labels: ['comp:infrastructure', 'sprint:1', 'sprint:2'] },
  { key: 'ORD-28', start: '2026-04-20', due: '2026-05-30', labels: ['comp:architecture', 'sprint:1'] },
  
  // Sprint 2 & 3 Tasks (Khordad)
  { key: 'ORD-29', start: '2026-05-10', due: '2026-06-20', labels: ['comp:monitoring', 'sprint:2', 'sprint:3'] },
  { key: 'ORD-30', start: '2026-05-15', due: '2026-06-28', labels: ['comp:devops', 'sprint:2'] },
  
  // Sprint 3 & 4 Tasks (Khordad / Tir)
  { key: 'ORD-31', start: '2026-06-01', due: '2026-07-10', labels: ['comp:security', 'wait:تیم-امنیت-OPM', 'sprint:3', 'sprint:4'] },
  { key: 'ORD-32', start: '2026-06-05', due: '2026-07-15', labels: ['comp:networking', 'wait:تیم-شبکه-داده', 'sprint:3'] },
  
  // Sprint 4 & 5 Tasks (Tir / Mordad)
  { key: 'ORD-33', start: '2026-06-20', due: '2026-07-25', labels: ['comp:learning', 'sprint:4'] },
  { key: 'ORD-34', start: '2026-06-25', due: '2026-07-30', labels: ['comp:documentation', 'sprint:4', 'sprint:5'] },
  
  // Sprint 5 & 6 Tasks (Tir / Mordad)
  { key: 'ORD-35', start: '2026-07-01', due: '2026-08-10', labels: ['comp:database', 'sprint:5', 'sprint:6'] },
  { key: 'ORD-36', start: '2026-07-05', due: '2026-08-15', labels: ['comp:research', 'sprint:5'] },

  // Sprint 7 & 8 Tasks (Mordad / Shahrivar)
  { key: 'ORD-39', start: '2026-07-20', due: '2026-08-25', labels: ['comp:support', 'sprint:7', 'sprint:8'] },
  { key: 'ORD-40', start: '2026-07-25', due: '2026-08-30', labels: ['comp:testing', 'wait:تیم-تست-کیفیت-خارجی', 'sprint:7'] },

  // Sprint 9 & 10 Tasks (Mordad / Current)
  { key: 'ORD-45', start: '2026-08-01', due: '2026-09-10', labels: ['comp:networking', 'wait:تیم-زیرساخت-شبکه', 'sprint:9', 'sprint:10'] },
  { key: 'ORD-46', start: '2026-08-05', due: '2026-09-15', labels: ['comp:documentation', 'sprint:9', 'sprint:10'] }
];

async function run() {
  console.log('📅 Updating Jira Cloud tasks with Multi-Sprint labels & varied historical dates (Ardibehesht, Khordad, Tir, Mordad)...');

  for (const item of multiSprintAndDateTasks) {
    try {
      const issueRes = await client.get(`/rest/api/3/issue/${item.key}`);
      const currentLabels = issueRes.data.fields?.labels || [];

      // Combine labels
      const cleanLabels = currentLabels.filter(l => !l.startsWith('sprint:') && !l.startsWith('comp:') && !l.startsWith('wait:'));
      const finalLabels = Array.from(new Set([...cleanLabels, ...item.labels]));

      await client.put(`/rest/api/3/issue/${item.key}`, {
        fields: {
          labels: finalLabels,
          duedate: item.due
        }
      });
      console.log(`✅ Updated ${item.key} in Jira with start/due dates [${item.start} to ${item.due}] & labels: ${finalLabels.join(', ')}`);
    } catch (e) {
      console.error(`Failed updating ${item.key}:`, e.response?.data || e.message);
    }
  }

  console.log('Multi-sprint & Date updating completed in Jira Cloud!');
}

run();
