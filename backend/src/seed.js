const { initDb, getDb } = require('./db/database');
const { hashPassword } = require('./services/authService');

async function seed() {
  console.log('Seeding database...');
  await initDb();
  const db = getDb();

  // Seed Admin User
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    const hashed = await hashPassword('admin123');
    db.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)').run(
      'admin', hashed, 'مدیر سیستم', 'admin'
    );
    console.log('Created admin user.');
  }

  // Define Projects Key (defaults to process.env.JIRA_PROJECT_KEY or ORD)
  const pKey = (process.env.JIRA_PROJECT_KEY || 'ORD').split(',')[0].trim().toUpperCase() || 'ORD';

  // Define Projects
  const rawProjects = [
    {
      title: 'پایپلاین CI/CD',
      description: 'طراحی و پیاده‌سازی پایپلاین CI/CD برای خودکارسازی فرآیند بیلد، تست و دیپلوی اپلیکیشن‌ها. شامل GitLab CI، ArgoCD و Tekton.',
      category: 'devops', status: 'In Progress', progress: 70,
      capabilities: 'خودکارسازی دیپلوی|کاهش زمان انتشار از ۲ روز به ۳۰ دقیقه|استانداردسازی فرآیند انتشار|افزایش کیفیت کد با تست خودکار',
      confluence_link: 'https://confluence.example.com/display/OPS/Pipeline-CICD'
    },
    {
      title: 'استک مانیتورینگ',
      description: 'پیاده‌سازی استک مانیتورینگ جامع شامل Prometheus، Grafana، Alertmanager و Loki برای نظارت بر سلامت سرویس‌ها.',
      category: 'monitoring', status: 'In Progress', progress: 45,
      capabilities: 'مانیتورینگ Real-time|هشدارگذاری هوشمند|داشبورد متمرکز سلامت سرویس‌ها|تحلیل لاگ‌ها',
      confluence_link: 'https://confluence.example.com/display/OPS/Monitoring-Stack'
    },
    {
      title: 'مهاجرت به کوبرنتیز',
      description: 'مهاجرت سرویس‌های عملیاتی از محیط VM به Kubernetes. شامل Dockerize کردن اپلیکیشن‌ها، Helm Charts و مدیریت کلاستر.',
      category: 'infrastructure', status: 'In Progress', progress: 85,
      capabilities: 'مقیاس‌پذیری خودکار|Self-healing|مدیریت منابع بهینه|Zero-downtime deployment',
      confluence_link: 'https://confluence.example.com/display/OPS/K8s-Migration'
    },
    {
      title: 'خودکارسازی امنیت',
      description: 'پیاده‌سازی DevSecOps شامل اسکن آسیب‌پذیری خودکار، SAST/DAST، مدیریت secrets و compliance checking.',
      category: 'security', status: 'In Progress', progress: 30,
      capabilities: 'اسکن خودکار آسیب‌پذیری|مدیریت Secrets متمرکز|Compliance as Code|کاهش ریسک امنیتی',
      confluence_link: 'https://confluence.example.com/display/OPS/Security-Automation'
    },
    {
      title: 'یکپارچه‌سازی AI با ورکفلوها',
      description: 'بررسی و پیاده‌سازی ابزارهای هوش مصنوعی برای بهینه‌سازی ورکفلوهای عملیاتی. شامل AIOps، تحلیل پیش‌بینانه و Chatbot عملیاتی.',
      category: 'ai', status: 'To Do', progress: 15,
      capabilities: 'تحلیل پیش‌بینانه خرابی|AIOps|خودکارسازی پاسخ به حوادث|Chatbot عملیاتی',
      confluence_link: 'https://confluence.example.com/display/OPS/AI-Integration'
    },
    {
      title: 'برنامه آموزش تیم‌ها',
      description: 'طراحی و اجرای برنامه آموزشی برای تیم‌های عملیاتی شامل Kubernetes، CI/CD، مانیتورینگ و امنیت.',
      category: 'training', status: 'In Progress', progress: 60,
      capabilities: 'ارتقاء مهارت تیم‌ها|استانداردسازی دانش فنی|کاهش وابستگی به افراد کلیدی|مستندسازی بهتر',
      confluence_link: 'https://confluence.example.com/display/OPS/Training-Program'
    },
    {
      title: 'طرح بازیابی از بحران',
      description: 'طراحی و پیاده‌سازی Disaster Recovery Plan شامل بکاپ خودکار، Failover، تست‌های DR و مستندسازی runbook‌ها.',
      category: 'infrastructure', status: 'Done', progress: 95,
      capabilities: 'بکاپ خودکار|Failover خودکار|RTO کمتر از ۱ ساعت|مستندسازی Runbook',
      confluence_link: 'https://confluence.example.com/display/OPS/Disaster-Recovery'
    },
    {
      title: 'مدیریت متمرکز لاگ‌ها',
      description: 'پیاده‌سازی سیستم مدیریت متمرکز لاگ‌ها با ELK Stack و Fluentd برای جمع‌آوری، تحلیل و جستجوی لاگ‌ها.',
      category: 'monitoring', status: 'In Progress', progress: 55,
      capabilities: 'جمع‌آوری متمرکز لاگ|جستجوی سریع لاگ|تحلیل روند خطاها|هشدار بر اساس لاگ',
      confluence_link: 'https://confluence.example.com/display/OPS/Log-Management'
    }
  ];

  const projects = rawProjects.map((p, i) => ({
    id: `${pKey}-${i + 1}`,
    ...p
  }));

  // Task templates per project index (0-based)
  const taskSetsByIndex = [
    [
      { title: 'تحقیق و انتخاب ابزار CI/CD', status: 'Done', est: 16, spent: 14, priority: 'High' },
      { title: 'پیاده‌سازی GitLab Runner', status: 'Done', est: 8, spent: 8, priority: 'High' },
      { title: 'نوشتن Pipeline Template پایه', status: 'Done', est: 24, spent: 20, priority: 'High' },
      { title: 'یکپارچه‌سازی با ArgoCD', status: 'In Progress', est: 16, spent: 8, priority: 'High' },
      { title: 'تست و اعتبارسنجی Pipeline', status: 'In Progress', est: 12, spent: 4, priority: 'Medium' },
      { title: 'مستندسازی و آموزش تیم‌ها', status: 'To Do', est: 8, spent: 0, priority: 'Medium' },
      { title: 'راه‌اندازی Artifact Repository', status: 'OnHolding', est: 8, spent: 6, priority: 'Medium', waiting: true, waitingBy: 'تیم زیرساخت', waitingReason: 'نیاز به سرور اختصاصی' },
      { title: 'تنظیم Notification ها', status: 'To Do', est: 4, spent: 0, priority: 'Low' },
    ],
    [
      { title: 'نصب و پیکربندی Prometheus', status: 'Done', est: 12, spent: 10, priority: 'High' },
      { title: 'طراحی داشبوردهای Grafana', status: 'In Progress', est: 20, spent: 12, priority: 'High' },
      { title: 'تنظیم Alertmanager', status: 'In Progress', est: 8, spent: 3, priority: 'High' },
      { title: 'پیاده‌سازی Loki برای لاگ‌ها', status: 'To Do', est: 16, spent: 0, priority: 'Medium' },
      { title: 'یکپارچه‌سازی با PagerDuty', status: 'Waiting', est: 8, spent: 0, priority: 'Medium', waiting: true, waitingBy: 'تیم امنیت', waitingReason: 'نیاز به تأیید دسترسی API' },
      { title: 'تعریف SLI/SLO برای سرویس‌ها', status: 'To Do', est: 12, spent: 0, priority: 'High' },
      { title: 'آموزش تیم عملیات', status: 'To Do', est: 8, spent: 0, priority: 'Medium' },
    ],
    [
      { title: 'Dockerize کردن اپلیکیشن‌ها', status: 'Done', est: 32, spent: 28, priority: 'High' },
      { title: 'نوشتن Helm Charts', status: 'Done', est: 24, spent: 22, priority: 'High' },
      { title: 'تنظیم Ingress Controller', status: 'Done', est: 8, spent: 8, priority: 'High' },
      { title: 'مهاجرت سرویس‌های Stateless', status: 'Done', est: 16, spent: 14, priority: 'High' },
      { title: 'مهاجرت سرویس‌های Stateful', status: 'In Progress', est: 24, spent: 16, priority: 'High' },
      { title: 'تست عملکرد و Load Testing', status: 'In Progress', est: 12, spent: 4, priority: 'Medium' },
      { title: 'تنظیم HPA و VPA', status: 'To Do', est: 8, spent: 0, priority: 'Medium' },
      { title: 'مستندسازی معماری K8s', status: 'To Do', est: 8, spent: 0, priority: 'Low' },
      { title: 'دسترسی شبکه بین کلاسترها', status: 'OnHolding', est: 12, spent: 4, priority: 'High', waiting: true, waitingBy: 'تیم شبکه', waitingReason: 'نیاز به تنظیم فایروال بین VLAN ها' },
    ],
    [
      { title: 'بررسی ابزارهای SAST/DAST', status: 'Done', est: 16, spent: 14, priority: 'High' },
      { title: 'پیاده‌سازی SonarQube', status: 'In Progress', est: 12, spent: 6, priority: 'High' },
      { title: 'راه‌اندازی HashiCorp Vault', status: 'Waiting', est: 16, spent: 0, priority: 'High', waiting: true, waitingBy: 'تیم امنیت', waitingReason: 'نیاز به تأیید سیاست‌های امنیتی' },
      { title: 'اسکن Image های Docker', status: 'To Do', est: 8, spent: 0, priority: 'Medium' },
      { title: 'تعریف Security Policies', status: 'To Do', est: 12, spent: 0, priority: 'High' },
      { title: 'آموزش تیم توسعه', status: 'To Do', est: 8, spent: 0, priority: 'Medium' },
    ],
    [
      { title: 'تحقیق ابزارهای AIOps', status: 'In Progress', est: 20, spent: 8, priority: 'High' },
      { title: 'PoC تحلیل پیش‌بینانه', status: 'To Do', est: 24, spent: 0, priority: 'High' },
      { title: 'طراحی Chatbot عملیاتی', status: 'To Do', est: 16, spent: 0, priority: 'Medium' },
      { title: 'یکپارچه‌سازی با مانیتورینگ', status: 'OnHolding', est: 12, spent: 0, priority: 'Medium', waiting: true, waitingBy: 'تیم مانیتورینگ', waitingReason: 'منتظر تکمیل استک مانیتورینگ' },
      { title: 'تست و ارزیابی مدل‌ها', status: 'To Do', est: 16, spent: 0, priority: 'High' },
    ],
    [
      { title: 'تهیه محتوای آموزشی Kubernetes', status: 'Done', est: 24, spent: 20, priority: 'High' },
      { title: 'برگزاری کارگاه Docker', status: 'Done', est: 16, spent: 16, priority: 'High' },
      { title: 'برگزاری کارگاه CI/CD', status: 'In Progress', est: 16, spent: 8, priority: 'High' },
      { title: 'تهیه محتوای مانیتورینگ', status: 'In Progress', est: 12, spent: 4, priority: 'Medium' },
      { title: 'برگزاری کارگاه Kubernetes', status: 'To Do', est: 16, spent: 0, priority: 'High' },
      { title: 'آزمون و ارزیابی یادگیری', status: 'To Do', est: 8, spent: 0, priority: 'Medium' },
      { title: 'تهیه ویدئوهای آموزشی', status: 'To Do', est: 20, spent: 0, priority: 'Low' },
    ],
    [
      { title: 'تحلیل ریسک و BIA', status: 'Done', est: 16, spent: 14, priority: 'High' },
      { title: 'طراحی سیاست بکاپ', status: 'Done', est: 12, spent: 10, priority: 'High' },
      { title: 'پیاده‌سازی بکاپ خودکار', status: 'Done', est: 20, spent: 18, priority: 'High' },
      { title: 'تنظیم Failover خودکار', status: 'Done', est: 16, spent: 16, priority: 'High' },
      { title: 'نوشتن Runbook‌ها', status: 'Done', est: 12, spent: 10, priority: 'Medium' },
      { title: 'تست DR (آزمایش بازیابی)', status: 'Done', est: 8, spent: 8, priority: 'High' },
      { title: 'مستندسازی نهایی', status: 'In Progress', est: 8, spent: 4, priority: 'Low' },
    ],
    [
      { title: 'نصب و پیکربندی Elasticsearch', status: 'Done', est: 16, spent: 14, priority: 'High' },
      { title: 'پیاده‌سازی Fluentd', status: 'Done', est: 12, spent: 10, priority: 'High' },
      { title: 'طراحی داشبورد Kibana', status: 'In Progress', est: 16, spent: 8, priority: 'High' },
      { title: 'تنظیم Index Lifecycle', status: 'In Progress', est: 8, spent: 3, priority: 'Medium' },
      { title: 'یکپارچه‌سازی با اپلیکیشن‌ها', status: 'OnHolding', est: 12, spent: 0, priority: 'High', waiting: true, waitingBy: 'تیم توسعه', waitingReason: 'نیاز به تغییر فرمت لاگ اپلیکیشن‌ها' },
      { title: 'تعریف هشدار بر اساس لاگ', status: 'To Do', est: 8, spent: 0, priority: 'Medium' },
      { title: 'آموزش تیم پشتیبانی', status: 'To Do', est: 8, spent: 0, priority: 'Low' },
    ]
  ];

  const insertProject = db.prepare(`
    INSERT INTO projects (id, title, description, category, status, progress, capabilities, confluence_link, start_date, due_date)
    VALUES (:id, :title, :description, :category, :status, :progress, :capabilities, :confluence_link, :start_date, :due_date)
  `);

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, project_id, title, status, estimate_hours, spent_hours, start_date, due_date, is_waiting, waiting_for_team, waiting_reason, sprint_name, sprint_start_date, sprint_end_date, priority, sort_order)
    VALUES (:id, :project_id, :title, :status, :estimate_hours, :spent_hours, :start_date, :due_date, :is_waiting, :waiting_for_team, :waiting_reason, :sprint_name, :sprint_start_date, :sprint_end_date, :priority, :sort_order)
  `);

  // Clear existing data
  db.exec('DELETE FROM tasks');
  db.exec('DELETE FROM projects');

  const sprint23Start = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sprint23End = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sprint22Start = new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sprint22End = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  db.transaction(() => {
    projects.forEach((p, i) => {
      p.start_date = new Date(Date.now() - (60 - i * 5) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      p.due_date = new Date(Date.now() + (30 + i * 10) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (!p.capabilities) p.capabilities = '';
      if (!p.confluence_link) p.confluence_link = '';
      insertProject.run(p);

      const tasks = taskSetsByIndex[i] || [];
      tasks.forEach((t, j) => {
        const taskStartDate = new Date(Date.now() - (50 - i * 5 - j * 3) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const taskDueDate = new Date(Date.now() + (10 + j * 5) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        let sprintName = (j % 2 === 0) ? 'Sprint 23' : 'Sprint 22';
        let sprintStart = (j % 2 === 0) ? sprint23Start : sprint22Start;
        let sprintEnd = (j % 2 === 0) ? sprint23End : sprint22End;

        insertTask.run({
          id: `${p.id}-${j + 1}`,
          project_id: p.id,
          title: t.title,
          status: t.status,
          estimate_hours: t.est,
          spent_hours: t.spent,
          start_date: taskStartDate,
          due_date: taskDueDate,
          is_waiting: t.waiting ? 1 : 0,
          waiting_for_team: t.waitingBy || null,
          waiting_reason: t.waitingReason || null,
          sprint_name: sprintName,
          sprint_start_date: sprintStart,
          sprint_end_date: sprintEnd,
          priority: t.priority,
          sort_order: j
        });
      });
    });
  })();

  // Update project stats outside transaction
  for (const p of projects) {
    db.prepare(`
      UPDATE projects SET
        total_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = ?),
        completed_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = ? AND status = 'Done'),
        waiting_tasks = (SELECT COUNT(*) FROM tasks WHERE project_id = ? AND (status = 'OnHolding' OR status = 'Waiting'))
      WHERE id = ?
    `).run(p.id, p.id, p.id, p.id);
  }

  console.log(`Seed complete! Created ${projects.length} projects with tasks.`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
