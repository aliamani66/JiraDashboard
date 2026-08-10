const { initDb, getDb } = require('./db/database');

async function addMultiLineEpicDescriptions() {
  await initDb();
  const db = getDb();

  console.log('=== 📝 ثبت توضیحات مفصل و چند خطی برای اپیک‌های اصلی سیستم (Jira Epics) ===\n');

  // Multi-line detailed description for Epic ORD-13
  const epic13Description = `این اپیک شامل فاز جامع ارتقا و خودکارسازی امنیت ابری کلاسترها می‌باشد. 
اهداف اصلی این پروژه عبارتند از:
۱. پیاده‌سازی ابزار Trivy برای اسکن خودکار تصاویر داکر و شناسایی آسیب‌پذیری‌های CVE بالا و کریتیکال در پایپ‌لاین CI/CD.
۲. طراحی و استقرار کلاستر متمرکز HashiCorp Vault جهت مدیریت امن کلیدها، گواهی‌نامه‌های SSL و سرویس مدیریت اسرار (Secrets Engine).
۳. اتوماسیون کامل تست‌های تحلیل استاتیک کد (SAST) با ابزار SonarQube به همراه اتصال هوشمند به مخزن گیت‌هاب تیم توسعه.
۴. پشتیبانی عملیاتی، تدوین مستندات امنیتی تحویل سیستم و اجرای مانورهای دوره‌ای تست بازگردانی بک‌آپ سرورهای Vault.`;

  // Multi-line detailed description for Epic ORD-1
  const epic1Description = `پروژه طراحی و استقرار کلاستر عملیاتی Kubernetes و راه‌اندازی کامل زیرساخت DevOps تیم عملیات.
محورهای اصلی این اپیک:
- استقرار شبکه K8s، پیکربندی اینگرس کنترلرها و بالانسر بار (Load Balancer).
- پیکربندی پایش متمرکز منابع با Prometheus و داشبوردهای گرافانا (Grafana Dashboards).
- ساخت پایپ‌لاین‌های نهایی GitOps بر پایه ArgoCD جهت اتوماسیون فرایند دپلی برنامه‌ها.`;

  db.prepare('UPDATE projects SET description = ? WHERE id = ?').run(epic13Description, 'ORD-13');
  db.prepare('UPDATE projects SET description = ? WHERE id = ?').run(epic1Description, 'ORD-1');

  console.log('✅ توضیحات مفصل و چندخطی برای اپیک ORD-13 ثبت شد.');
  console.log('✅ توضیحات مفصل و چندخطی برای اپیک ORD-1 ثبت شد.');
  console.log('\n✨ دیتابیس به‌روزرسانی شد.');
}

addMultiLineEpicDescriptions().catch(console.error);
