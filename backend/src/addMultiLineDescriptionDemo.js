const { initDb, getDb } = require('./db/database');

async function addMultiLineDescriptions() {
  await initDb();
  const db = getDb();

  console.log('=== 📝 افزودن توضیحات چندخطی و طولانی به پروژه‌ها و تسک‌ها جهت تست عدم به‌هم‌ریختگی ===\n');

  // Long project description
  const longProjDesc = `این پروژه شامل طراحی، پیاده‌سازی و استقرار کامل سرویس‌های عملیاتی است. شامل معماری Microservices، تست‌های نفوذ امنیتی، ارتقای سرویس‌های شبکه و مانیتورینگ متمرکز کلاستر K8s به همراه پشتیبانی ۲۴/۷ تیم‌های عملیاتی و آماده‌سازی مستندات فنی مربوطه.`;

  db.prepare('UPDATE projects SET description = ? WHERE id = ?').run(longProjDesc, 'ORD-13');
  db.prepare('UPDATE projects SET description = ? WHERE id = ?').run(longProjDesc, 'ORD-1');
  console.log('✅ توضیحات طولانی روی پروژه‌های ORD-1 و ORD-13 اعمال شد.');

  // Long task descriptions (multi-line strings with bullet points)
  const taskDesc1 = `بررسی و اسکن خودکار ایمیج‌های داکر جهت شناسایی آسیب‌پذیری‌های CVE بالا و کریتیکال پیش از دیپلوی روی کلاستر کوبرنتیز تولید. همچنین ارسال گزارش خودکار به کانال تلگرام/اسلک تیم DevOps.`;

  const taskDesc2 = `طراحی و پیاده‌سازی معماری کلاستر متمرکز مدیریت کلیدها و اسرار سیستم (Secrets Engine) بر پایه HashiCorp Vault. قابلیت به اشتراک‌گذاری ایمن کلیدهای API و گواهی‌نامه‌های SSL به همراه بک‌آپ‌گیری روزانه خودکار.`;

  const taskDesc3 = `اتصال خودکار ابزار SonarQube به مخزن گیت‌هاب جهت آنالیز استاتیک کد، بررسی اسمل‌های کدی (Code Smells)، محاسبات پوشش تست‌ها (Code Coverage) و تایید خودکار کیفیت پیش از ادغام Merge Requestها.`;

  db.prepare('UPDATE tasks SET description = ? WHERE id = ?').run(taskDesc1, 'ORD-14');
  db.prepare('UPDATE tasks SET description = ? WHERE id = ?').run(taskDesc2, 'ORD-15');
  db.prepare('UPDATE tasks SET description = ? WHERE id = ?').run(taskDesc3, 'ORD-16');

  console.log('✅ توضیحات چندخطی و مفصل روی تسک‌های ORD-14, ORD-15, ORD-16 اعمال شد.');
  console.log('\n✨ آماده مشاهده در فرانت‌اند! تمای توضیحات به صورت خلاصه و استاندارد نمایش داده می‌شوند و با Hover متن کامل به صورت Tooltip نمایش داده خواهد شد.');
}

addMultiLineDescriptions().catch(console.error);
