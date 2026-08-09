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

async function run() {
  console.log('🏃 Creating Agile Boards & Sprints in Jira Cloud...');

  let boardId;
  try {
    const boards = await client.get('/rest/agile/1.0/board');
    console.log('Available Boards:', boards.data.values?.map(b => `${b.id}: ${b.name}`));
    if (boards.data.values?.length > 0) {
      boardId = boards.data.values[0].id;
    }
  } catch (e) {
    console.error('Error fetching boards:', e.message);
  }

  if (boardId) {
    // Create Sprint 23 & Sprint 24 in Jira Agile
    const now = new Date();
    const startDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const sprintRes = await client.post('/rest/agile/1.0/sprint', {
        name: 'Sprint 23 (اسپرینت فعلی)',
        startDate,
        endDate,
        originBoardId: boardId,
        goal: 'تکمیل پایپ‌لاین‌های CI/CD و سیستم مانیتورینگ'
      });
      console.log('✅ Created Jira Agile Sprint:', sprintRes.data.id, sprintRes.data.name);
    } catch (e) {
      console.log('Sprint creation note:', e.response?.data?.message || e.message);
    }
  }

  console.log('Agile Sprint creation script finished!');
}

run();
