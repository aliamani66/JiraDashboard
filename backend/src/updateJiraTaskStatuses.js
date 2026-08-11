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

// Define desired status transitions
const taskTransitions = {
  // 🟢 Done Tasks (انجام شده)
  'ORD-2': '41', // Done
  'ORD-6': '41', // Done
  'ORD-10': '41', // Done
  'ORD-16': '41', // Done
  'OPM-4': '41',  // Done

  // 🟦 In Progress Tasks (در حال انجام)
  'ORD-3': '31', // In Progress
  'ORD-7': '31', // In Progress
  'ORD-11': '31', // In Progress
  'ORD-14': '31', // In Progress
  'ORD-18': '31', // In Progress
  'ORD-19': '31', // In Progress
  'OPM-6': '31',  // In Progress

  // 🟧 Waiting / OnHolding Tasks (در انتظار / آن‌هولد)
  // ORD-4, ORD-8, ORD-12, ORD-15, OPM-2, OPM-3, OPM-7 have waiting labels & issue links
};

async function run() {
  console.log('🔄 Transitioning Jira Task Statuses in Jira Cloud...');

  for (const [taskKey, transitionId] of Object.entries(taskTransitions)) {
    try {
      // Get available transitions for this task
      const transRes = await client.get(`/rest/api/3/issue/${taskKey}/transitions`);
      const transitions = transRes.data.transitions || [];
      
      const targetTrans = transitions.find(t => t.id === transitionId) || 
                          transitions.find(t => t.name.toLowerCase().includes(transitionId === '41' ? 'done' : 'progress'));

      if (targetTrans) {
        await client.post(`/rest/api/3/issue/${taskKey}/transitions`, {
          transition: { id: targetTrans.id }
        });
        console.log(`✅ Transitioned ${taskKey} -> ${targetTrans.name} (ID: ${targetTrans.id})`);
      } else {
        console.log(`⚠️ Transition ID ${transitionId} not found for ${taskKey}. Available: ${transitions.map(t => `${t.name}(${t.id})`).join(', ')}`);
      }
    } catch (err) {
      console.error(`❌ Failed to transition ${taskKey}:`, err.response?.data?.errorMessages || err.message);
    }
  }

  console.log('\nStatus transitions complete!');
}

run();
