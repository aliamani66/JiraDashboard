import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Server, Cpu, GitBranch, Tag, Calendar,
  RefreshCw, Save, CheckCircle2, AlertTriangle, X,
  ChevronDown, ChevronUp, Info, Eye, EyeOff, Zap, Database
} from 'lucide-react';
import { api } from '../services/api';
import JalaliDatePicker from '../components/common/JalaliDatePicker';
import { g2j, j2g, formatJalali, formatGregorian } from '../utils/jalali';
import './JiraSettingsPage.css';

// ─────────────────────────── HELPERS ────────────────────────────
const Section = ({ icon: Icon, title, color, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card jsp-section">
      <button className="jsp-section-toggle" onClick={() => setOpen(o => !o)}>
        <span className="jsp-section-title-row">
          <Icon size={20} style={{ color }} />
          <span style={{ color }}>{title}</span>
        </span>
        {open ? <ChevronUp size={18} className="text-muted" /> : <ChevronDown size={18} className="text-muted" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="jsp-section-body"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Field = ({ label, hint, children }) => (
  <div className="jsp-field">
    <label className="jsp-field-label">{label}</label>
    {hint && <span className="jsp-field-hint">{hint}</span>}
    {children}
  </div>
);

const Input = ({ value, onChange, placeholder, mono, password }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="jsp-input-wrap">
      <input
        type={password && !show ? 'password' : 'text'}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`jsp-input ${mono ? 'mono' : ''}`}
      />
      {password && (
        <button className="jsp-eye-btn" onClick={() => setShow(s => !s)}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      )}
    </div>
  );
};

// Editable tag list (chips)
const TagList = ({ items, onChange, placeholder }) => {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setInput('');
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="jsp-taglist">
      <div className="jsp-tags">
        {items.map((t, i) => (
          <span key={i} className="jsp-tag">
            {t}
            <button onClick={() => remove(i)} className="jsp-tag-remove"><X size={11} /></button>
          </span>
        ))}
      </div>
      <div className="jsp-tag-add">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={placeholder || 'اضافه کردن...'}
          className="jsp-input mono"
        />
        <button onClick={add} className="jsp-tag-add-btn">+ افزودن</button>
      </div>
    </div>
  );
};

// Status Mapping table with Custom Target Status support
const StatusMappingEditor = ({ mapping, onChange }) => {
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('Done');
  const [customToInput, setCustomToInput] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  const defaultTargets = ['Done', 'In Progress', 'Waiting', 'To Do', 'In Review', 'Testing', 'Blocked', 'Draft', 'Canceled'];
  const currentValues = Object.values(mapping || {});
  const targets = Array.from(new Set([...defaultTargets, ...currentValues]));

  const handleAdd = () => {
    if (!newFrom.trim()) return;
    const targetStatus = isCustomMode ? (customToInput.trim() || 'Done') : newTo;
    onChange({ ...mapping, [newFrom.trim()]: targetStatus });
    setNewFrom('');
    setCustomToInput('');
    setIsCustomMode(false);
  };

  return (
    <div className="jsp-status-table-wrap">
      <table className="jsp-status-table">
        <thead>
          <tr>
            <th>وضعیت Jira (نام اصلی در جیرا)</th>
            <th>نگاشت به وضعیت داشبورد</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(mapping || {}).map(([from, to]) => (
            <tr key={from}>
              <td><code className="mono-code">{from}</code></td>
              <td>
                <select
                  value={targets.includes(to) ? to : 'CUSTOM_VAL'}
                  onChange={e => {
                    if (e.target.value === 'CUSTOM_VAL') {
                      const customName = prompt('نام وضعیت داشبورد جدید را وارد فرمایید:', to);
                      if (customName && customName.trim()) {
                        onChange({ ...mapping, [from]: customName.trim() });
                      }
                    } else {
                      onChange({ ...mapping, [from]: e.target.value });
                    }
                  }}
                  className="jsp-input"
                >
                  {targets.map(t => <option key={t} value={t}>{t}</option>)}
                  {!targets.includes(to) && <option value="CUSTOM_VAL">{to} (سفارشی)</option>}
                  <option value="CUSTOM_VAL">✏️ + نوشتن وضعیت سفارشی...</option>
                </select>
              </td>
              <td>
                <button
                  className="jsp-delete-row"
                  onClick={() => {
                    const m = { ...mapping };
                    delete m[from];
                    onChange(m);
                  }}
                  title="حذف این نگاشت"
                >
                  <X size={14} />
                </button>
              </td>
            </tr>
          ))}
          
          <tr className="jsp-add-row">
            <td>
              <input
                value={newFrom}
                onChange={e => setNewFrom(e.target.value)}
                placeholder="نام وضعیت Jira جدید (مثال: Code Review)..."
                className="jsp-input mono"
              />
            </td>
            <td>
              {isCustomMode ? (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    value={customToInput}
                    onChange={e => setCustomToInput(e.target.value)}
                    placeholder="نام وضعیت داشبورد سفارشی..."
                    className="jsp-input"
                  />
                  <button onClick={() => setIsCustomMode(false)} className="jsp-tag-remove" title="انصراف">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <select
                  value={newTo}
                  onChange={e => {
                    if (e.target.value === 'NEW_CUSTOM') {
                      setIsCustomMode(true);
                    } else {
                      setNewTo(e.target.value);
                    }
                  }}
                  className="jsp-input"
                >
                  {targets.map(t => <option key={t} value={t}>{t}</option>)}
                  <option value="NEW_CUSTOM">✏️ + ایجاد وضعیت سفارشی جدید...</option>
                </select>
              )}
            </td>
            <td>
              <button className="jsp-add-mapping-btn" onClick={handleAdd}>
                + افزودن نگاشت
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// ─────────────────────────── MAIN PAGE ────────────────────────────
const JiraSettingsPage = () => {
  const [activeTab, setActiveTab] = useState('database');
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [discoveredProjects, setDiscoveredProjects] = useState([]);
  const [fetchingProjects, setFetchingProjects] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [onlyActiveProjects, setOnlyActiveProjects] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

  const [monthlySyncing, setMonthlySyncing] = useState(false);
  const [monthlyResults, setMonthlyResults] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [jqlPreview, setJqlPreview] = useState(null);
  const [jqlPreviewLoading, setJqlPreviewLoading] = useState(false);
  const [jqlTestResults, setJqlTestResults] = useState(null);
  const [jqlTestLoading, setJqlTestLoading] = useState(false);
  const [jiraTotalCount, setJiraTotalCount] = useState(null);
  const [jiraTotalCountLoading, setJiraTotalCountLoading] = useState(false);
  const [showUnlinkedModal, setShowUnlinkedModal] = useState(false);

  const [rangeStartJalali, setRangeStartJalali] = useState(() => {
    const now = new Date();
    return g2j(now.getFullYear() - 1, now.getMonth() + 1, now.getDate());
  });
  const [rangeEndJalali, setRangeEndJalali] = useState(() => {
    const now = new Date();
    return g2j(now.getFullYear(), now.getMonth() + 1, now.getDate());
  });

  const applyDatePreset = (daysAgo, monthsAgo) => {
    const end = new Date();
    const start = new Date();
    if (daysAgo) {
      start.setDate(end.getDate() - daysAgo);
    } else if (monthsAgo) {
      start.setMonth(end.getMonth() - monthsAgo);
    }
    setRangeEndJalali(g2j(end.getFullYear(), end.getMonth() + 1, end.getDate()));
    setRangeStartJalali(g2j(start.getFullYear(), start.getMonth() + 1, start.getDate()));
    setJqlPreview(null);
  };

  const handlePreviewJql = async () => {
    if (!rangeStartJalali || !rangeEndJalali) {
      showToast('لطفاً تاریخ شروع و پایان را انتخاب کنید.', 'error');
      return;
    }
    try {
      setJqlPreviewLoading(true);
      setJqlPreview(null);
      const startG = j2g(rangeStartJalali.jy, rangeStartJalali.jm, rangeStartJalali.jd);
      const endG = j2g(rangeEndJalali.jy, rangeEndJalali.jm, rangeEndJalali.jd);
      const startStr = `${startG.gy}-${String(startG.gm).padStart(2,'0')}-${String(startG.gd).padStart(2,'0')} 00:00`;
      const endStr = `${endG.gy}-${String(endG.gm).padStart(2,'0')}-${String(endG.gd).padStart(2,'0')} 23:59`;
      const jalaliStartStr = `${rangeStartJalali.jy}/${String(rangeStartJalali.jm).padStart(2,'0')}/${String(rangeStartJalali.jd).padStart(2,'0')} 00:00`;
      const jalaliEndStr = `${rangeEndJalali.jy}/${String(rangeEndJalali.jm).padStart(2,'0')}/${String(rangeEndJalali.jd).padStart(2,'0')} 23:59`;
      const res = await api.previewJqlQueries({ startStr, endStr, jalaliStartStr, jalaliEndStr });
      setJqlPreview(res);
    } catch (e) {
      showToast('خطا در دریافت پیش‌نمایش: ' + e.message, 'error');
    } finally {
      setJqlPreviewLoading(false);
    }
  };

  const handleTestAllJql = async () => {
    if (!rangeStartJalali || !rangeEndJalali) {
      showToast('لطفاً تاریخ شروع و پایان را انتخاب کنید.', 'error');
      return;
    }
    try {
      setJqlTestLoading(true);
      setJqlTestResults(null);
      setJqlPreview(null);
      const startG = j2g(rangeStartJalali.jy, rangeStartJalali.jm, rangeStartJalali.jd);
      const endG = j2g(rangeEndJalali.jy, rangeEndJalali.jm, rangeEndJalali.jd);
      const startStr = `${startG.gy}-${String(startG.gm).padStart(2,'0')}-${String(startG.gd).padStart(2,'0')} 00:00`;
      const endStr = `${endG.gy}-${String(endG.gm).padStart(2,'0')}-${String(endG.gd).padStart(2,'0')} 23:59`;
      const jalaliStartStr = `${rangeStartJalali.jy}/${String(rangeStartJalali.jm).padStart(2,'0')}/${String(rangeStartJalali.jd).padStart(2,'0')} 00:00`;
      const jalaliEndStr = `${rangeEndJalali.jy}/${String(rangeEndJalali.jm).padStart(2,'0')}/${String(rangeEndJalali.jd).padStart(2,'0')} 23:59`;
      const res = await api.testAllJqlQueries({ startStr, endStr, jalaliStartStr, jalaliEndStr });
      setJqlTestResults(res);
    } catch (e) {
      showToast('خطا: ' + e.message, 'error');
    } finally {
      setJqlTestLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const [dbStats, setDbStats] = useState(null);
  const [dbStatsLoading, setDbStatsLoading] = useState(false);

  const [jiraCountData, setJiraCountData] = useState(null);

  const fetchDbStats = useCallback(async () => {
    try {
      setDbStatsLoading(true);
      const [res, countRes] = await Promise.all([
        api.getDbStats().catch(() => null),
        api.getJiraTotalCount().catch(() => null)
      ]);
      if (res && res.success) {
        setDbStats(res);
      }
      if (countRes && countRes.success) {
        setJiraCountData(countRes);
      }
    } catch (e) {
      console.error('Failed to fetch DB stats:', e);
    } finally {
      setDbStatsLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getJiraConfig();
      setCfg(data);
      fetchDbStats();
    } catch (e) {
      showToast('خطا در دریافت تنظیمات جیرا: ' + (e.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchDbStats]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleFetchProjects = async () => {
    try {
      setFetchingProjects(true);
      setActiveModal({
        status: 'loading',
        title: '🌐 در حال دریافت لیست پروژه‌های Jira',
        message: 'در حال دریافت تمام پروژه‌های موجود در سرور جیرا به همراه نام پروژه و تعداد اپیک‌ها...'
      });
      const res = await api.fetchJiraProjects();
      if (res.projects && res.projects.length > 0) {
        setDiscoveredProjects(res.projects);
        setActiveModal({
          status: 'success',
          title: '✅ دریافت لیست پروژه‌ها با موفقیت انجام شد',
          message: `${res.projects.length} پروژه از سرور Jira شناسایی گردید و در کمبو قرار گرفت.`
        });
      } else {
        setActiveModal({
          status: 'error',
          title: '❌ عدم دریافت لیست پروژه‌ها',
          message: 'پروژه‌ای از جیرا دریافت نشد. لطفاً آدرس و توکن اتصال جیرا را بررسی بفرمایید.'
        });
      }
    } catch (e) {
      setActiveModal({
        status: 'error',
        title: '❌ خطا در دریافت پروژه‌ها از Jira',
        message: e.message || 'ارتباط با سرور جیرا برقرار نشد.'
      });
    } finally {
      setFetchingProjects(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setActiveModal({
        status: 'loading',
        title: '💾 در حال ذخیره تنظیمات و مپینگ Jira',
        message: 'تنظیمات اتصال، کلید پروژه‌ها و نگاشت فیلدها در حال ثبت و اعمال زنده در حافظه سیستم می‌باشد...'
      });
      const res = await api.saveJiraConfig(cfg);
      if (res && res.config) {
        setCfg(res.config);
      } else {
        await fetchConfig();
      }
      setActiveModal({
        status: 'success',
        title: '✅ ذخیره موفقیت‌آمیز تنظیمات',
        message: res.message || 'تنظیمات و کلید جدید پروژه با موفقیت ذخیره و به صورت زنده اعمال گردید.'
      });
    } catch (e) {
      setActiveModal({
        status: 'error',
        title: '❌ خطا در ذخیره تنظیمات',
        message: e.message || 'ذخیره تنظیمات با خطا مواجه شد.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    const projKeyStr = cfg?.connection?.projectKey || 'ORD';
    const projectClause = projKeyStr && projKeyStr !== 'ALL' && projKeyStr !== '*'
      ? (projKeyStr.includes(',') ? `project IN (${projKeyStr})` : `project = ${projKeyStr}`)
      : '';
    const executedJql = projectClause ? `${projectClause} ORDER BY created DESC` : 'ORDER BY created DESC';

    try {
      setSyncing(true);
      setActiveModal({
        status: 'loading',
        title: '🔄 در حال همگام‌سازی سریع با سرور Jira',
        message: `دیتابیس در حال استخراج و به‌روزرسانی تسک‌های پروژه‌های انتخاب‌شده (${projKeyStr}) می‌باشد...`,
        jql: executedJql
      });
      // Auto-save current config first so newly entered Project Key is immediately active
      await api.saveJiraConfig(cfg);
      // Execute live sync from Jira
      const res = await api.resetDatabase();
      setActiveModal({
        status: 'success',
        title: '✅ همگام‌سازی سریع با موفقیت انجام شد',
        message: res.message || 'دیتابیس با داده‌های زنده Jira همگام شد.',
        jql: executedJql,
        onConfirm: () => window.location.reload()
      });
    } catch (e) {
      setActiveModal({
        status: 'error',
        title: '❌ خطا در همگام‌سازی با Jira',
        message: e.message || 'همگام‌سازی با خطا مواجه شد.',
        jql: executedJql
      });
    } finally {
      setSyncing(false);
    }
  };

  const PERSIAN_MONTH_NAMES = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];

  const getJalaliMonthLabel = (year, monthZeroIndexed) => {
    const gMonthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const gName = gMonthNames[monthZeroIndexed];
    let jMonthIdx = (monthZeroIndexed + 9) % 12;
    let jYear = monthZeroIndexed >= 2 ? year - 621 : year - 622;
    return {
      jalali: `${PERSIAN_MONTH_NAMES[jMonthIdx]} ${jYear}`,
      gregorian: `${gName} ${year}`
    };
  };

  const executeStepByStepSync = async (monthRanges, titlePrefix) => {
    setMonthlySyncing(true);
    setMonthlyResults({ totalTasksSynced: 0, monthlyResults: [] });

    let totalTasksSynced = 0;
    const results = [];

    try {
      await api.saveJiraConfig(cfg);
    } catch (_) {}

    for (let i = 0; i < monthRanges.length; i++) {
      const mRange = monthRanges[i];
      const stepNum = i + 1;
      const totalSteps = monthRanges.length;
      const progressPercent = Math.round((stepNum / totalSteps) * 100);

      setSyncProgress({
        isSyncing: true,
        titlePrefix,
        stepNum,
        totalSteps,
        monthLabel: mRange.jalaliName,
        dateRange: `${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]}`,
        totalTasksSoFar: totalTasksSynced,
        progressPercent
      });

      try {
        const res = await api.syncSingleMonthJiraConfig({
          startStr: mRange.startStr,
          endStr: mRange.endStr,
          jalaliStartStr: mRange.jalaliStartStr || null,
          jalaliEndStr: mRange.jalaliEndStr || null,
          monthLabel: mRange.jalaliName,
          monthIndex: stepNum
        });

        const monthRes = {
          monthIndex: stepNum,
          monthLabel: mRange.jalaliName,
          jalaliName: mRange.jalaliName,
          gregorianName: mRange.gregorianName,
          dateRange: `${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]}`,
          status: res.status || (res.success ? 'success' : 'error'),
          taskCount: res.taskCount || 0,
          jql: res.jql || '',
          winningVariant: res.winningVariant || '',
          queryAuditResults: res.queryAuditResults || [],
          message: res.message || ''
        };

        totalTasksSynced += (monthRes.taskCount || 0);
        results.push(monthRes);

        setSyncProgress(prev => (prev ? {
          ...prev,
          totalTasksSoFar: totalTasksSynced
        } : null));

        setMonthlyResults({
          totalTasksSynced,
          monthlyResults: [...results]
        });

      } catch (err) {
        results.push({
          monthIndex: stepNum,
          monthLabel: mRange.jalaliName,
          jalaliName: mRange.jalaliName,
          gregorianName: mRange.gregorianName,
          dateRange: `${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]}`,
          status: 'error',
          taskCount: 0,
          jql: '',
          message: err.message || 'خطا'
        });

        setMonthlyResults({
          totalTasksSynced,
          monthlyResults: [...results]
        });
      }
    }

    setSyncProgress(null);
    setMonthlySyncing(false);
    showToast(`✅ همگام‌سازی با موفقیت انجام شد. مجموع ${totalTasksSynced} تسک از ${monthRanges.length} ماه ثبت گردید.`, 'success');
    // Fetch total COUNT from Jira for comparison
    try {
      setJiraTotalCountLoading(true);
      const countRes = await api.getJiraTotalCount();
      if (countRes.success && countRes.total !== null) {
        setJiraTotalCount({ total: countRes.total, jql: countRes.jql, projectKey: countRes.projectKey });
      }
    } catch (_) {}
    finally { setJiraTotalCountLoading(false); }
  };

  const handleFullSiteRebuild = async () => {
    if (!window.confirm('🚨 آیا از بازسازی کامل دیتابیس مطمئن هستید؟\n\nاین عملیات دیتابیس را کاملاً پاکسازی و فشرده کرده، سپس تمام اطلاعات ۵ سال گذشته (۶۰ ماه) را ماه به ماه به صورت زنده استخراج می‌نماید.')) {
      return;
    }
    try {
      showToast('🗑️ در حال پاکسازی دیتابیس و شروع استخراج گام به گام ۵ سال گذشته (۶۰ ماه)...');
      await api.clearDatabase();
      fetchDbStats();

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const monthRanges = [];
      for (let i = 59; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const lastDay = new Date(y, m + 1, 0);

        const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01 00:00`;
        const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')} 23:59`;
        const monthInfo = getJalaliMonthLabel(y, m);
        const jStart = g2j(y, m + 1, 1);
        const jEnd = g2j(y, m + 1, lastDay.getDate());
        const jalaliStartStr = `${jStart.jy}/${String(jStart.jm).padStart(2,'0')}/${String(jStart.jd).padStart(2,'0')} 00:00`;
        const jalaliEndStr = `${jEnd.jy}/${String(jEnd.jm).padStart(2,'0')}/${String(jEnd.jd).padStart(2,'0')} 23:59`;

        monthRanges.push({
          monthIndex: 60 - i,
          year: y,
          month: m + 1,
          jalaliName: monthInfo.jalali,
          gregorianName: monthInfo.gregorian,
          startStr,
          endStr,
          jalaliStartStr,
          jalaliEndStr
        });
      }

      await executeStepByStepSync(monthRanges, '🔥 بازسازی کامل دیتابیس (۵ سال گذشته - ۶۰ ماه)');
      fetchDbStats();
    } catch (e) {
      showToast('خطا در بازسازی کامل سایت: ' + e.message, 'error');
    }
  };

  const handleMonthlySync = async () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthRanges = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const lastDay = new Date(y, m + 1, 0);

      const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01 00:00`;
      const endStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')} 23:59`;
      const monthInfo = getJalaliMonthLabel(y, m);
      const jStart = g2j(y, m + 1, 1);
      const jEnd = g2j(y, m + 1, lastDay.getDate());
      const jalaliStartStr = `${jStart.jy}/${String(jStart.jm).padStart(2,'0')}/${String(jStart.jd).padStart(2,'0')} 00:00`;
      const jalaliEndStr = `${jEnd.jy}/${String(jEnd.jm).padStart(2,'0')}/${String(jEnd.jd).padStart(2,'0')} 23:59`;

      monthRanges.push({
        monthIndex: 12 - i,
        year: y,
        month: m + 1,
        jalaliName: monthInfo.jalali,
        gregorianName: monthInfo.gregorian,
        startStr,
        endStr,
        jalaliStartStr,
        jalaliEndStr
      });
    }

    await executeStepByStepSync(monthRanges, '🗓️ در حال همگام‌سازی ۱۲ ماه گذشته');
  };

  const handleRangeSync = async () => {
    if (!rangeStartJalali || !rangeEndJalali) {
      showToast('لطفاً هر دو تاریخ شروع و پایان را انتخاب فرمایید.', 'error');
      return;
    }

    const startG = j2g(rangeStartJalali.jy, rangeStartJalali.jm, rangeStartJalali.jd);
    const endG = j2g(rangeEndJalali.jy, rangeEndJalali.jm, rangeEndJalali.jd);

    const startDt = new Date(startG.gy, startG.gm - 1, startG.gd);
    const endDt = new Date(endG.gy, endG.gm - 1, endG.gd);

    if (startDt > endDt) {
      showToast('تاریخ شروع نمی‌تواند پس از تاریخ پایان باشد.', 'error');
      return;
    }

    const diffDays = Math.ceil((endDt - startDt) / (1000 * 60 * 60 * 24));
    
    // If selected range is within 60 days, do NOT split into months — run directly as 1 single query matching the preview
    if (diffDays <= 60) {
      const startStr = `${startG.gy}-${String(startG.gm).padStart(2, '0')}-${String(startG.gd).padStart(2, '0')} 00:00`;
      const endStr = `${endG.gy}-${String(endG.gm).padStart(2, '0')}-${String(endG.gd).padStart(2, '0')} 23:59`;
      const jalaliStartStr = `${rangeStartJalali.jy}/${String(rangeStartJalali.jm).padStart(2, '0')}/${String(rangeStartJalali.jd).padStart(2, '0')} 00:00`;
      const jalaliEndStr = `${rangeEndJalali.jy}/${String(rangeEndJalali.jm).padStart(2, '0')}/${String(rangeEndJalali.jd).padStart(2, '0')} 23:59`;

      const singleRange = [{
        monthIndex: 1,
        year: startG.gy,
        month: startG.gm,
        jalaliName: `بازه انتخابی (${rangeStartJalali.jy}/${rangeStartJalali.jm}/${rangeStartJalali.jd} تا ${rangeEndJalali.jy}/${rangeEndJalali.jm}/${rangeEndJalali.jd})`,
        gregorianName: `${startStr.split(' ')[0]} to ${endStr.split(' ')[0]}`,
        startStr,
        endStr,
        jalaliStartStr,
        jalaliEndStr
      }];

      await executeStepByStepSync(singleRange, '📅 در حال همگام‌سازی مستقیم بازه انتخابی');
      return;
    }

    const monthRanges = [];
    let curr = new Date(startDt.getFullYear(), startDt.getMonth(), 1);
    let stepIndex = 1;

    while (curr <= endDt) {
      const y = curr.getFullYear();
      const m = curr.getMonth();
      const lastDayOfMonth = new Date(y, m + 1, 0);

      const chunkStart = (y === startDt.getFullYear() && m === startDt.getMonth()) ? startDt : new Date(y, m, 1);
      const chunkEnd = (y === endDt.getFullYear() && m === endDt.getMonth()) ? endDt : lastDayOfMonth;

      const startStr = `${chunkStart.getFullYear()}-${String(chunkStart.getMonth() + 1).padStart(2, '0')}-${String(chunkStart.getDate()).padStart(2, '0')} 00:00`;
      const endStr = `${chunkEnd.getFullYear()}-${String(chunkEnd.getMonth() + 1).padStart(2, '0')}-${String(chunkEnd.getDate()).padStart(2, '0')} 23:59`;

      const startJal = g2j(chunkStart.getFullYear(), chunkStart.getMonth() + 1, chunkStart.getDate());
      const endJal = g2j(chunkEnd.getFullYear(), chunkEnd.getMonth() + 1, chunkEnd.getDate());

      const jalaliStartStr = `${startJal.jy}/${String(startJal.jm).padStart(2, '0')}/${String(startJal.jd).padStart(2, '0')} 00:00`;
      const jalaliEndStr = `${endJal.jy}/${String(endJal.jm).padStart(2, '0')}/${String(endJal.jd).padStart(2, '0')} 23:59`;

      const monthInfo = getJalaliMonthLabel(y, m);

      monthRanges.push({
        monthIndex: stepIndex++,
        year: y,
        month: m + 1,
        jalaliName: monthInfo.jalali,
        gregorianName: monthInfo.gregorian,
        startStr,
        endStr,
        jalaliStartStr,
        jalaliEndStr
      });

      curr = new Date(y, m + 1, 1);
    }

    await executeStepByStepSync(monthRanges, '📅 در حال استخراج و همگام‌سازی بازه تاریخی');
  };

  const handleDiagnose = async () => {
    try {
      setDiagLoading(true);
      setDiagResult(null);
      setActiveModal({
        status: 'loading',
        title: '🔍 پایش زنده ساختار API و ارتباط جیرا',
        message: 'سیستم در حال تست اتصال به سرور جیرا، چک کردن توکن و پایش مپینگ فیلدهای پروژه می‌باشد...'
      });
      const res = await api.runJiraDiagnostic(cfg?.connection || {});
      setDiagResult(res);
      if (res && res.success) {
        setActiveModal({
          status: 'success',
          title: '✅ پایش زنده با موفقیت انجام شد',
          message: `ارتباط با پروژه ${res.projectName || 'Jira'} برقرار گردید. میزان تطابق ساختاری: %${res.complianceScore || 100}`
        });
      } else {
        setActiveModal({
          status: 'error',
          title: '⚠️ نتیجه پایش زنده API',
          message: res.message || 'خطا در برقراری ارتباط با Jira.'
        });
      }
    } catch (e) {
      setDiagResult({ success: false, message: e.message });
      setActiveModal({
        status: 'error',
        title: '❌ خطا در اجرای پایش زنده',
        message: e.message || 'اجرای پایش با خطا مواجه شد.'
      });
    } finally {
      setDiagLoading(false);
    }
  };

  const set = (section, key, val) =>
    setCfg(prev => ({ ...prev, [section]: { ...prev?.[section], [key]: val } }));

  if (loading) return <div className="loading-screen">در حال دریافت تنظیمات جیرا...</div>;
  if (!cfg) return <div className="loading-screen">داده‌ای یافت نشد.</div>;

  const selectedProjectKeys = (cfg?.connection?.projectKey || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  const filteredDiscoveredProjects = discoveredProjects.filter(p => {
    if (onlyActiveProjects && (p.epicCount || 0) <= 0) return false;
    if (!projectSearchTerm.trim()) return true;
    const term = projectSearchTerm.trim().toLowerCase();
    return (p.key || '').toLowerCase().includes(term) || (p.name || '').toLowerCase().includes(term);
  });

  const toggleProjectKey = (keyToToggle) => {
    let current = [...selectedProjectKeys];
    if (current.includes(keyToToggle)) {
      current = current.filter(k => k !== keyToToggle);
    } else {
      current.push(keyToToggle);
    }
    set('connection', 'projectKey', current.join(', '));
  };

  return (
    <motion.div className="jira-settings-page" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`ump-toast ${toast.type}`}
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🚀 Floating Top Sync Progress Banner (Non-Blocking, Transparent Background) */}
      <AnimatePresence>
        {syncProgress && syncProgress.isSyncing && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            style={{
              position: 'fixed',
              top: '25px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 999999,
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.98))',
              border: '1px solid rgba(56, 189, 248, 0.6)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 30px rgba(56, 189, 248, 0.35)',
              borderRadius: '20px',
              padding: '1.1rem 1.8rem',
              minWidth: '460px',
              maxWidth: '92vw',
              color: '#FFFFFF',
              backdropFilter: 'blur(12px)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.25rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <RefreshCw size={24} className="spin" style={{ color: '#38BDF8' }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.02rem', color: '#38BDF8' }}>
                    {syncProgress.titlePrefix} (ماه {syncProgress.stepNum} از {syncProgress.totalSteps})
                  </div>
                  <div style={{ fontSize: '0.83rem', color: '#CBD5E1', marginTop: '0.15rem' }}>
                    در حال دریافت {syncProgress.monthLabel} ({syncProgress.dateRange})
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'left', minWidth: '100px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10B981', textAlign: 'center' }}>
                  {syncProgress.totalTasksSoFar}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', textAlign: 'center' }}>تسک دریافت‌شده</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', background: 'rgba(255, 255, 255, 0.12)', height: '7px', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${syncProgress.progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #38BDF8, #10B981)',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Active Operation Spinner Modal Overlay */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(12px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem'
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: -20 }}
              style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.99))',
                border: activeModal.status === 'error' ? '1px solid #EF4444' : activeModal.status === 'success' ? '1px solid #10B981' : '1px solid rgba(56, 189, 248, 0.4)',
                boxShadow: activeModal.status === 'error' ? '0 20px 60px rgba(239,68,68,0.25), 0 0 35px rgba(239,68,68,0.2)' : activeModal.status === 'success' ? '0 20px 60px rgba(16,185,129,0.25), 0 0 35px rgba(16,185,129,0.2)' : '0 20px 60px rgba(0,0,0,0.7), 0 0 35px rgba(56,189,248,0.3)',
                borderRadius: '24px',
                padding: '2.2rem 2.8rem',
                maxWidth: '520px',
                width: '100%',
                textAlign: 'center',
                color: '#FFFFFF'
              }}
            >
              {/* Icon Section */}
              <div style={{ display: 'inline-flex', padding: '1.1rem', background: activeModal.status === 'error' ? 'rgba(239, 68, 68, 0.15)' : activeModal.status === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(14, 165, 233, 0.15)', borderRadius: '50%', marginBottom: '1.35rem', border: activeModal.status === 'error' ? '1px solid rgba(239, 68, 68, 0.4)' : activeModal.status === 'success' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(56, 189, 248, 0.35)' }}>
                {activeModal.status === 'error' ? (
                  <AlertTriangle size={42} style={{ color: '#EF4444' }} />
                ) : activeModal.status === 'success' ? (
                  <CheckCircle2 size={42} style={{ color: '#10B981' }} />
                ) : (
                  <RefreshCw size={38} className="spin text-accent-cyan" style={{ color: '#38BDF8' }} />
                )}
              </div>

              {/* Title & Message */}
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.35rem', fontWeight: 800, color: activeModal.status === 'error' ? '#FCA5A5' : activeModal.status === 'success' ? '#6EE7B7' : '#F8FAFC' }}>
                {activeModal.title}
              </h3>

              <p style={{ margin: 0, fontSize: '0.94rem', color: '#CBD5E1', lineHeight: '1.65' }}>
                {activeModal.message}
              </p>

              {/* JQL Executed Code Box */}
              {activeModal.jql && (
                <div style={{ marginTop: '1rem', textAlign: 'right', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', padding: '0.75rem 1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#38BDF8', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>⚡ کوئری JQL اجراشده روی سرور جیرا:</span>
                  </div>
                  <code style={{ fontSize: '0.8rem', color: '#6EE7B7', wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.5, display: 'block' }}>
                    {activeModal.jql}
                  </code>
                </div>
              )}

              {/* Loading Indicator OR Confirm Button */}
              {activeModal.status === 'loading' ? (
                <div style={{ marginTop: '1.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.45rem 1.1rem', borderRadius: '20px', fontSize: '0.82rem', color: '#38BDF8', fontWeight: 'bold' }}>
                  <span className="spin">⚡</span>
                  <span>در حال ارتباط و پردازش عملیات... لطفاً شکیبا باشید</span>
                </div>
              ) : (
                <div style={{ marginTop: '1.8rem' }}>
                  <button
                    onClick={() => {
                      const cb = activeModal.onConfirm;
                      setActiveModal(null);
                      if (cb) cb();
                    }}
                    style={{
                      background: activeModal.status === 'error' ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'linear-gradient(135deg, #10B981, #059669)',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '0.65rem 2.2rem',
                      borderRadius: '14px',
                      fontSize: '0.94rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: activeModal.status === 'error' ? '0 4px 15px rgba(239, 68, 68, 0.4)' : '0 4px 15px rgba(16, 185, 129, 0.4)',
                      transition: 'transform 0.2s ease, opacity 0.2s ease'
                    }}
                  >
                    تأیید و متوجه شدم
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}

            {/* Header */}
      <div className="jsp-header">
        <div>
          <h1 className="jsp-title"><Settings size={26} className="text-accent-cyan" />تنظیمات کامل اتصال و مپینگ Jira API</h1>
          <p className="jsp-subtitle">مدیریت کامل تمام مپینگ‌ها، فیلدهای کاستوم، وضعیت‌ها، برچسب‌ها و استخراج پیشرفته اطلاعات جیرا</p>
        </div>
        <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
          <button
            className="jsp-run-diag-btn"
            style={{ background: 'linear-gradient(135deg, #EF4444, #8B5CF6)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)' }}
            onClick={handleFullSiteRebuild}
            disabled={monthlySyncing}
          >
            <RefreshCw size={16} className={monthlySyncing ? 'spin' : ''} />
            {monthlySyncing ? 'در حال بازسازی...' : '🔥 بازسازی کامل دیتابیس و سایت'}
          </button>
          <button
            className="jsp-run-diag-btn"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)' }}
            onClick={() => setShowRangeModal(true)}
            disabled={monthlySyncing}
          >
            <Calendar size={16} />
            {monthlySyncing ? 'در حال استخراج...' : 'استخراج دیتای جیرا در بازه دلخواه'}
          </button>
          <button className="jsp-run-diag-btn secondary" onClick={handleDiagnose} disabled={diagLoading}>
            <Zap size={16} className={diagLoading ? 'spin' : ''} />
            {diagLoading ? 'در حال پایش...' : 'پایش زنده API'}
          </button>

          <button className="jsp-run-diag-btn" onClick={handleSave} disabled={saving}>
            <Save size={16} className={saving ? 'spin' : ''} />
            {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
          </button>
        </div>
      </div>

      {/* 🏷️ INTEGRATED CONNECTED PANEL WITH TABS */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.7))',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4), 0 0 30px rgba(56, 189, 248, 0.06)',
        overflow: 'hidden',
        marginBottom: '2rem'
      }}>
        {/* Connected Tab Bar Header */}
        <div style={{
          display: 'flex',
          background: 'rgba(15, 23, 42, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '0.6rem 1rem 0 1rem',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          {/* Tab 1: Database */}
          <button
            type="button"
            onClick={() => setActiveTab('database')}
            style={{
              padding: '0.85rem 1.6rem',
              borderTopLeftRadius: '14px',
              borderTopRightRadius: '14px',
              borderBottomLeftRadius: '0px',
              borderBottomRightRadius: '0px',
              border: activeTab === 'database' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid transparent',
              borderBottom: activeTab === 'database' ? '2px solid #0F172A' : '1px solid transparent',
              background: activeTab === 'database' ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.22) 0%, rgba(15, 23, 42, 0.95) 100%)' : 'transparent',
              color: activeTab === 'database' ? '#6EE7B7' : '#94A3B8',
              fontWeight: activeTab === 'database' ? 800 : 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontSize: '0.94rem',
              position: 'relative',
              marginBottom: '-1px',
              zIndex: activeTab === 'database' ? 2 : 1,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <div style={{
              background: activeTab === 'database' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.06)',
              padding: '0.35rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: activeTab === 'database' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid transparent'
            }}>
              <Database size={18} color={activeTab === 'database' ? '#6EE7B7' : '#94A3B8'} />
            </div>
            <span>📊 پایش دیتابیس و استخراج داده‌ها</span>
            {activeTab === 'database' && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981', marginRight: '0.4rem' }} />
            )}
          </button>

          {/* Tab 2: Connection */}
          <button
            type="button"
            onClick={() => setActiveTab('connection')}
            style={{
              padding: '0.85rem 1.6rem',
              borderTopLeftRadius: '14px',
              borderTopRightRadius: '14px',
              borderBottomLeftRadius: '0px',
              borderBottomRightRadius: '0px',
              border: activeTab === 'connection' ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent',
              borderBottom: activeTab === 'connection' ? '2px solid #0F172A' : '1px solid transparent',
              background: activeTab === 'connection' ? 'linear-gradient(180deg, rgba(56, 189, 248, 0.22) 0%, rgba(15, 23, 42, 0.95) 100%)' : 'transparent',
              color: activeTab === 'connection' ? '#38BDF8' : '#94A3B8',
              fontWeight: activeTab === 'connection' ? 800 : 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontSize: '0.94rem',
              position: 'relative',
              marginBottom: '-1px',
              zIndex: activeTab === 'connection' ? 2 : 1,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <div style={{
              background: activeTab === 'connection' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.06)',
              padding: '0.35rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: activeTab === 'connection' ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent'
            }}>
              <Server size={18} color={activeTab === 'connection' ? '#38BDF8' : '#94A3B8'} />
            </div>
            <span>🔌 اتصال و آدرس‌های API جیرا</span>
            {activeTab === 'connection' && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38BDF8', boxShadow: '0 0 8px #38BDF8', marginRight: '0.4rem' }} />
            )}
          </button>

          {/* Tab 3: Mapping */}
          <button
            type="button"
            onClick={() => setActiveTab('mapping')}
            style={{
              padding: '0.85rem 1.6rem',
              borderTopLeftRadius: '14px',
              borderTopRightRadius: '14px',
              borderBottomLeftRadius: '0px',
              borderBottomRightRadius: '0px',
              border: activeTab === 'mapping' ? '1px solid rgba(236, 72, 153, 0.5)' : '1px solid transparent',
              borderBottom: activeTab === 'mapping' ? '2px solid #0F172A' : '1px solid transparent',
              background: activeTab === 'mapping' ? 'linear-gradient(180deg, rgba(236, 72, 153, 0.22) 0%, rgba(15, 23, 42, 0.95) 100%)' : 'transparent',
              color: activeTab === 'mapping' ? '#F472B6' : '#94A3B8',
              fontWeight: activeTab === 'mapping' ? 800 : 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontSize: '0.94rem',
              position: 'relative',
              marginBottom: '-1px',
              zIndex: activeTab === 'mapping' ? 2 : 1,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <div style={{
              background: activeTab === 'mapping' ? 'rgba(236, 72, 153, 0.3)' : 'rgba(255, 255, 255, 0.06)',
              padding: '0.35rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: activeTab === 'mapping' ? '1px solid rgba(236, 72, 153, 0.5)' : '1px solid transparent'
            }}>
              <Cpu size={18} color={activeTab === 'mapping' ? '#F472B6' : '#94A3B8'} />
            </div>
            <span>🛠️ نگاشت فیلدهای کاستوم و وضعیت‌ها</span>
            {activeTab === 'mapping' && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EC4899', boxShadow: '0 0 8px #EC4899', marginRight: '0.4rem' }} />
            )}
          </button>
        </div>

        {/* Panel Body Content Container */}
        <div style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.35)' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'database' && (
              <motion.div key="database" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                {sec_db}
              </motion.div>
            )}

            {activeTab === 'connection' && (
              <motion.div key="connection" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {sec_conn}
                {sec_api}
                {sec_conf}
              </motion.div>
            )}

            {activeTab === 'mapping' && (
              <motion.div key="mapping" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {sec_cf}
                {sec_stat}
                {sec_wait}
                {sec_date}
                {sec_lbl}
                {sec_feat}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default JiraSettingsPage;
