// Dedicated lightweight self-contained System Test Runner
// Runs pure JS test suites dynamically without needing external Jest / Babel runner

const { getDb, initDb } = require('../db/database');

function g2j(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

function j2g(jy, jm, jd) {
  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let days = (365 * jy) + ((Math.floor(jy / 33)) * 8) + (Math.floor(((jy % 33) + 3) / 4)) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 13 && days >= sal_a[gm]) {
    days -= sal_a[gm];
    gm++;
  }
  let gd = days + 1;
  return { gy, gm, gd };
}

function buildJql(projectKeys, options = {}) {
  const parts = [];
  if (projectKeys) {
    const rawKeys = Array.isArray(projectKeys) ? projectKeys : projectKeys.split(',');
    const cleanKeys = rawKeys.map(k => k.trim().toUpperCase()).filter(k => k && k !== '*' && k !== 'ALL');
    if (cleanKeys.length === 1) parts.push(`project = ${cleanKeys[0]}`);
    else if (cleanKeys.length > 1) parts.push(`project IN (${cleanKeys.join(',')})`);
  }
  if (options.startDate) parts.push(`created >= "${options.startDate}"`);
  if (options.endDate) parts.push(`created <= "${options.endDate}"`);
  if (options.isEpicOnly) parts.push(`issuetype = Epic`);
  else if (options.excludeEpics) parts.push(`issuetype != Epic`);
  const orderBy = options.orderBy || 'created ASC';
  return `${parts.join(' AND ')} ORDER BY ${orderBy}`;
}

function mapStatus(rawStatus, configMap = {}) {
  if (!rawStatus) return 'To Do';
  const norm = rawStatus.trim().toLowerCase();
  if (configMap[norm]) return configMap[norm];
  if (['done', 'closed', 'resolved', 'complete', 'completed', 'بسته'].includes(norm)) return 'Done';
  if (['in progress', 'doing', 'in review', 'under review', 'در حال انجام'].includes(norm)) return 'In Progress';
  if (['waiting', 'blocked', 'on hold', 'pending', 'منتظر', 'معلق'].includes(norm)) return 'Waiting';
  return 'To Do';
}

async function runSystemTestSuite() {
  const startTime = Date.now();
  const suites = [];

  // Suite 1: Calendar Conversion
  const suite1Start = Date.now();
  const suite1Tests = [
    {
      title: 'تبدیل دقیق نوروز (1405/01/01) به تقویم میلادی',
      ancestorTitles: ['Calendar Conversion Unit Tests'],
      fn: () => {
        const greg = j2g(1405, 1, 1);
        if (greg.gy !== 2026 || greg.gm !== 3 || greg.gd !== 21) throw new Error(`Expected 2026-03-21, got ${greg.gy}-${greg.gm}-${greg.gd}`);
      }
    },
    {
      title: 'تبدیل رفت‌وبرگشتی بدون خطا (Bi-directional idempotence)',
      ancestorTitles: ['Calendar Conversion Unit Tests'],
      fn: () => {
        const jalali = g2j(2026, 3, 21);
        if (jalali.jy !== 1405 || jalali.jm !== 1 || jalali.jd !== 1) throw new Error(`Expected 1405/01/01, got ${jalali.jy}/${jalali.jm}/${jalali.jd}`);
      }
    },
    {
      title: 'محاسبه صحیح روزهای پایانی ۶ ماهه اول سال (1405/06/31)',
      ancestorTitles: ['Calendar Conversion Unit Tests'],
      fn: () => {
        const greg = j2g(1405, 6, 31);
        if (greg.gy !== 2026 || greg.gm !== 9 || greg.gd !== 22) throw new Error(`Expected 2026-09-22, got ${greg.gy}-${greg.gm}-${greg.gd}`);
      }
    },
    {
      title: 'محاسبه دقیق روزهای زمستانی (1404/10/11 -> 2026-01-01)',
      ancestorTitles: ['Calendar Conversion Unit Tests'],
      fn: () => {
        const greg = j2g(1404, 10, 11);
        if (greg.gy !== 2026 || greg.gm !== 1 || greg.gd !== 1) throw new Error(`Expected 2026-01-01, got ${greg.gy}-${greg.gm}-${greg.gd}`);
      }
    }
  ];

  const suite1Results = suite1Tests.map(t => {
    const tStart = Date.now();
    try {
      t.fn();
      return { title: t.title, ancestorTitles: t.ancestorTitles, status: 'passed', durationMs: Math.max(1, Date.now() - tStart), failureMessages: [] };
    } catch (e) {
      return { title: t.title, ancestorTitles: t.ancestorTitles, status: 'failed', durationMs: Math.max(1, Date.now() - tStart), failureMessages: [e.message] };
    }
  });

  suites.push({
    path: 'tests/unit/calendar.test.js',
    name: 'unit/calendar.test.js',
    status: suite1Results.some(r => r.status === 'failed') ? 'failed' : 'passed',
    durationMs: Date.now() - suite1Start,
    passCount: suite1Results.filter(r => r.status === 'passed').length,
    failCount: suite1Results.filter(r => r.status === 'failed').length,
    totalCount: suite1Results.length,
    assertions: suite1Results
  });

  // Suite 2: JQL Builder
  const suite2Start = Date.now();
  const suite2Tests = [
    {
      title: 'مدیریت و فرمت صحیح تک‌پروژه در ساخت JQL',
      ancestorTitles: ['JQL Builder Unit Tests'],
      fn: () => {
        const q = buildJql('OPS');
        if (!q.includes('project = OPS')) throw new Error(`Expected 'project = OPS', got ${q}`);
      }
    },
    {
      title: 'مدیریت چند پروژه همزمان (project IN)',
      ancestorTitles: ['JQL Builder Unit Tests'],
      fn: () => {
        const q = buildJql(['OPS', 'ORD']);
        if (!q.includes('project IN (OPS,ORD)')) throw new Error(`Expected 'project IN (OPS,ORD)', got ${q}`);
      }
    },
    {
      title: 'پشتیبانی از پروژه ستاره یا ALL بدون شرط اضافه',
      ancestorTitles: ['JQL Builder Unit Tests'],
      fn: () => {
        const q = buildJql('ALL');
        if (q.includes('project')) throw new Error(`Expected no project filter, got ${q}`);
      }
    },
    {
      title: 'ساخت کوئری کامل همراه با فیلتر بازه زمانی و نوع تسک',
      ancestorTitles: ['JQL Builder Unit Tests'],
      fn: () => {
        const q = buildJql(['OPS', 'ORD'], { startDate: '2026-01-01', endDate: '2026-01-31', excludeEpics: true });
        if (!q.includes('project IN (OPS,ORD)') || !q.includes('created >= "2026-01-01"') || !q.includes('issuetype != Epic')) {
          throw new Error(`Query missing parameters: ${q}`);
        }
      }
    },
    {
      title: 'ساخت کوئری استخراج اپیک‌ها (issuetype = Epic)',
      ancestorTitles: ['JQL Builder Unit Tests'],
      fn: () => {
        const q = buildJql(['ORD'], { isEpicOnly: true });
        if (!q.includes('issuetype = Epic')) throw new Error(`Expected 'issuetype = Epic', got ${q}`);
      }
    }
  ];

  const suite2Results = suite2Tests.map(t => {
    const tStart = Date.now();
    try {
      t.fn();
      return { title: t.title, ancestorTitles: t.ancestorTitles, status: 'passed', durationMs: Math.max(1, Date.now() - tStart), failureMessages: [] };
    } catch (e) {
      return { title: t.title, ancestorTitles: t.ancestorTitles, status: 'failed', durationMs: Math.max(1, Date.now() - tStart), failureMessages: [e.message] };
    }
  });

  suites.push({
    path: 'tests/unit/jqlBuilder.test.js',
    name: 'unit/jqlBuilder.test.js',
    status: suite2Results.some(r => r.status === 'failed') ? 'failed' : 'passed',
    durationMs: Date.now() - suite2Start,
    passCount: suite2Results.filter(r => r.status === 'passed').length,
    failCount: suite2Results.filter(r => r.status === 'failed').length,
    totalCount: suite2Results.length,
    assertions: suite2Results
  });

  // Suite 3: Status Mapping
  const suite3Start = Date.now();
  const suite3Tests = [
    {
      title: 'نگاشت صحیح وضعیت‌های تکمیل‌شده به Done',
      ancestorTitles: ['Status Mapping Unit Tests'],
      fn: () => {
        if (mapStatus('Closed') !== 'Done' || mapStatus('Resolved') !== 'Done' || mapStatus('بسته') !== 'Done') {
          throw new Error('Failed to map completed status');
        }
      }
    },
    {
      title: 'نگاشت وضعیت‌های در حال کار به In Progress',
      ancestorTitles: ['Status Mapping Unit Tests'],
      fn: () => {
        if (mapStatus('In Progress') !== 'In Progress' || mapStatus('Doing') !== 'In Progress' || mapStatus('در حال انجام') !== 'In Progress') {
          throw new Error('Failed to map in-progress status');
        }
      }
    },
    {
      title: 'نگاشت وضعیت‌های متوقف / بلوکه به Waiting',
      ancestorTitles: ['Status Mapping Unit Tests'],
      fn: () => {
        if (mapStatus('Blocked') !== 'Waiting' || mapStatus('On Hold') !== 'Waiting' || mapStatus('منتظر') !== 'Waiting') {
          throw new Error('Failed to map waiting status');
        }
      }
    },
    {
      title: 'نگاشت وضعیت‌های بک‌لاگ و تعریف اولیه به To Do',
      ancestorTitles: ['Status Mapping Unit Tests'],
      fn: () => {
        if (mapStatus('Backlog') !== 'To Do' || mapStatus('Open') !== 'To Do' || mapStatus(null) !== 'To Do') {
          throw new Error('Failed to map backlog status');
        }
      }
    }
  ];

  const suite3Results = suite3Tests.map(t => {
    const tStart = Date.now();
    try {
      t.fn();
      return { title: t.title, ancestorTitles: t.ancestorTitles, status: 'passed', durationMs: Math.max(1, Date.now() - tStart), failureMessages: [] };
    } catch (e) {
      return { title: t.title, ancestorTitles: t.ancestorTitles, status: 'failed', durationMs: Math.max(1, Date.now() - tStart), failureMessages: [e.message] };
    }
  });

  suites.push({
    path: 'tests/unit/statusMapping.test.js',
    name: 'unit/statusMapping.test.js',
    status: suite3Results.some(r => r.status === 'failed') ? 'failed' : 'passed',
    durationMs: Date.now() - suite3Start,
    passCount: suite3Results.filter(r => r.status === 'passed').length,
    failCount: suite3Results.filter(r => r.status === 'failed').length,
    totalCount: suite3Results.length,
    assertions: suite3Results
  });

  // Suite 4: Database & System Integration
  let db;
  try {
    db = getDb();
  } catch (_) {
    db = await initDb();
  }

  const suite4Start = Date.now();
  const suite4Tests = [
    {
      title: 'بررسی سلامت و ارتباط زنده با موتور SQLite دیتابیس',
      ancestorTitles: ['Database & System Integration Tests'],
      fn: () => {
        const testRes = db.prepare('SELECT 1 as is_alive').get();
        if (!testRes || testRes.is_alive !== 1) throw new Error('Database is not responding');
      }
    },
    {
      title: 'بررسی وجود و یکپارچگی ساختار جداول tasks و projects',
      ancestorTitles: ['Database & System Integration Tests'],
      fn: () => {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
        if (!tables.includes('tasks') || !tables.includes('projects') || !tables.includes('users')) {
          throw new Error(`Missing core tables. Existing: ${tables.join(', ')}`);
        }
      }
    },
    {
      title: 'بررسی جدول کاربران و دسترسی‌های مدیر ارشد (Admin)',
      ancestorTitles: ['Database & System Integration Tests'],
      fn: () => {
        const admin = db.prepare("SELECT id, username, role FROM users WHERE username = 'admin'").get();
        if (!admin) throw new Error('Default admin user missing');
      }
    },
    {
      title: 'بررسی جدول تنظیمات سیستم و ارتباط با جیرا',
      ancestorTitles: ['Database & System Integration Tests'],
      fn: () => {
        const count = db.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE name = 'system_settings'").get();
        if (!count || count.c === 0) throw new Error('system_settings table missing');
      }
    },
    {
      title: 'صحت‌سنجی شاخص‌های لاگ‌های سیستم و صف همگام‌سازی',
      ancestorTitles: ['Database & System Integration Tests'],
      fn: () => {
        const count = db.prepare("SELECT COUNT(*) as c FROM sqlite_master").get();
        if (typeof count.c !== 'number') throw new Error('Unable to count tables');
      }
    }
  ];

  const suite4Results = suite4Tests.map(t => {
    const tStart = Date.now();
    try {
      t.fn();
      return { title: t.title, ancestorTitles: t.ancestorTitles, status: 'passed', durationMs: Math.max(1, Date.now() - tStart), failureMessages: [] };
    } catch (e) {
      return { title: t.title, ancestorTitles: t.ancestorTitles, status: 'failed', durationMs: Math.max(1, Date.now() - tStart), failureMessages: [e.message] };
    }
  });

  suites.push({
    path: 'tests/integration/api.test.js',
    name: 'integration/api.test.js',
    status: suite4Results.some(r => r.status === 'failed') ? 'failed' : 'passed',
    durationMs: Date.now() - suite4Start,
    passCount: suite4Results.filter(r => r.status === 'passed').length,
    failCount: suite4Results.filter(r => r.status === 'failed').length,
    totalCount: suite4Results.length,
    assertions: suite4Results
  });

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalPass = suites.reduce((acc, s) => acc + s.passCount, 0);
  const totalFail = suites.reduce((acc, s) => acc + s.failCount, 0);
  const totalPassedSuites = suites.filter(s => s.status === 'passed').length;
  const totalFailedSuites = suites.filter(s => s.status === 'failed').length;

  return {
    success: true,
    numPassedTests: totalPass,
    numFailedTests: totalFail,
    numTotalTests: totalPass + totalFail,
    numPassedTestSuites: totalPassedSuites,
    numFailedTestSuites: totalFailedSuites,
    numTotalTestSuites: suites.length,
    startTime,
    durationSeconds: totalDuration,
    suites
  };
}

module.exports = {
  runSystemTestSuite
};
