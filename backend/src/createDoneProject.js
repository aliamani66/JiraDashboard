const { getDb, initDb } = require('./db/database');

async function run() {
  await initDb();
  const db = getDb();

  console.log('Inserting a 100% Done / Completed Project into database...');

  const projectId = 'ORD-DONE-1';
  const projectTitle = 'استقرار و تحویل نهایی سامانه پایش آنی زیرساخت‌ها';
  const description = 'پروژه استقرار پلتفرم مانیتورینگ متمرکز و تحویل نهایی به تیم پشتیبانی عملیات';

  // Check if project exists
  const existing = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  
  if (existing) {
    db.prepare(`
      UPDATE projects 
      SET status = 'Done', progress = 100, total_tasks = 8, completed_tasks = 8, waiting_tasks = 0 
      WHERE id = ?
    `).run(projectId);
  } else {
    db.prepare(`
      INSERT INTO projects (id, title, description, status, capabilities, category, confluence_link, start_date, due_date, progress, total_tasks, completed_tasks, waiting_tasks)
      VALUES (?, ?, ?, 'Done', 'مستندات کامل,تست نفوذ,تحویل عملیاتی', 'monitoring', 'https://confluence.company.com/display/ORD/DoneProject', '2026-01-10', '2026-03-30', 100, 8, 8, 0)
    `).run(projectId, projectTitle, description);
  }

  // Add 8 Done tasks for this completed project
  const tasks = [
    { id: 'ORD-101', title: 'تست نفوذ و سخت‌سازی امنیت پایگاه داده', comp: 'sec' },
    { id: 'ORD-102', title: 'پیاده‌سازی داشبورد مانیتورینگ آنلاین', comp: 'monitoring' },
    { id: 'ORD-103', title: 'مستندسازی معماری سیستم و سناریوهای بازیابی', comp: 'documentation' },
    { id: 'ORD-104', title: 'تست بار و سنجش پایداری کلاستر', comp: 'testing' },
    { id: 'ORD-105', title: 'آموزش به تیم پشتیبانی عملیات', comp: 'learning' },
    { id: 'ORD-106', title: 'جلسه تحویل نهایی پروژه به ذینفعان', comp: 'meeting' },
    { id: 'ORD-107', title: 'راه‌اندازی پایپ‌لاین انتشار خودکار CI/CD', comp: 'devops' },
    { id: 'ORD-108', title: 'اتصال روترهای شبکه و پیاده‌سازی VPN سکیور', comp: 'networking' }
  ];

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const existingTask = db.prepare("SELECT id FROM tasks WHERE id = ?").get(t.id);
    if (!existingTask) {
      db.prepare(`
        INSERT INTO tasks (id, project_id, title, status, assignee, estimate_hours, spent_hours, start_date, due_date, is_waiting, sprint_name, component, sort_order)
        VALUES (?, ?, ?, 'Done', 'مهندس رضایی', 20, 20, '2026-01-15', '2026-03-25', 0, 'Sprint 1', ?, ?)
      `).run(t.id, projectId, t.title, t.comp, i);
    }
  }

  console.log('✅ Done Project successfully created and saved to database!');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
