const { initDb, getDb } = require('./db/database');

async function demoLogworkUpdate() {
  await initDb();
  const db = getDb();

  const projectId = 'ORD-13';
  console.log(`\n=== 🧪 اجرای تست لاگ‌ورک واقع‌گرایانه روی پروژه ${projectId} ===\n`);

  // 1. Fetch current status before update
  const projBefore = db.prepare(`
    SELECT p.*,
      IFNULL((SELECT SUM(estimate_hours) FROM tasks WHERE project_id = p.id AND (is_subtask IS NULL OR is_subtask = 0)), 0) as total_estimate_hours,
      IFNULL((SELECT SUM(spent_hours) FROM tasks WHERE project_id = p.id AND (is_subtask IS NULL OR is_subtask = 0)), 0) as total_spent_hours
    FROM projects p WHERE id = ?
  `).get(projectId);

  const prevProgress = projBefore.total_estimate_hours > 0 
    ? Math.round((projBefore.total_spent_hours / projBefore.total_estimate_hours) * 100)
    : 0;

  console.log(`📊 وضعیت قبل از ثبت لاگ‌ورک جدید:`);
  console.log(`   • عنوان پروژه: ${projBefore.title}`);
  console.log(`   • مجموع ساعات تخمین (Estimate): ${projBefore.total_estimate_hours}h`);
  console.log(`   • مجموع ساعات صرف‌شده (Spent): ${projBefore.total_spent_hours}h`);
  console.log(`   • درصد پیشرفت قبل: %${prevProgress}\n`);

  // 2. Add realistic logwork to child tasks of ORD-13
  console.log(`📝 ثبت لاگ‌ورک جدید روی تسک‌های زیرمجموعه...`);
  
  // Logwork 1: ORD-15 (استقرار کلاستر HashiCorp Vault) - Add 35h spent (spent becomes 55h out of 60h)
  db.prepare('UPDATE tasks SET spent_hours = 55, status = ? WHERE id = ?').run('In Progress', 'ORD-15');
  console.log(`   ✅ تسک ORD-15 (استقرار HashiCorp Vault): لاگ ۳۵h جدید اضافه شد (جمعاً ۵۵h از ۶۰h)`);

  // Logwork 2: ORD-26 (پشتیبانی عملیاتی سرور Vault) - Add 10h spent (spent becomes 20h out of 25h)
  db.prepare('UPDATE tasks SET spent_hours = 20, status = ? WHERE id = ?').run('In Progress', 'ORD-26');
  console.log(`   ✅ تسک ORD-26 (پشتیبانی سرور Vault): لاگ ۱۰h جدید اضافه شد (جمعاً ۲۰h از ۲۵h)`);

  // 3. Fetch status after update
  const projAfter = db.prepare(`
    SELECT p.*,
      IFNULL((SELECT SUM(estimate_hours) FROM tasks WHERE project_id = p.id AND (is_subtask IS NULL OR is_subtask = 0)), 0) as total_estimate_hours,
      IFNULL((SELECT SUM(spent_hours) FROM tasks WHERE project_id = p.id AND (is_subtask IS NULL OR is_subtask = 0)), 0) as total_spent_hours
    FROM projects p WHERE id = ?
  `).get(projectId);

  const newProgress = Math.min(100, Math.round((projAfter.total_spent_hours / projAfter.total_estimate_hours) * 100));

  // Update progress column in projects table
  db.prepare('UPDATE projects SET progress = ? WHERE id = ?').run(newProgress, projectId);

  console.log(`\n🎉 وضعیت بعد از ثبت لاگ‌ورک‌های جدید:`);
  console.log(`   • مجموع ساعات تخمین (Estimate): ${projAfter.total_estimate_hours}h`);
  console.log(`   • مجموع ساعات صرف‌شده جدید (Spent): ${projAfter.total_spent_hours}h (+45h لاگ جدید)`);
  console.log(`   • درصد پیشرفت جدید: %${newProgress} (افزایش از %${prevProgress} به %${newProgress}! 🚀)`);
}

demoLogworkUpdate().catch(console.error);
