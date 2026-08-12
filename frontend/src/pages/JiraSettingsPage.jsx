import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Server, Cpu, GitBranch, Tag, Calendar,
  RefreshCw, Save, CheckCircle2, AlertTriangle, X,
  ChevronDown, ChevronUp, Info, Eye, EyeOff, Zap
} from 'lucide-react';
import { api } from '../services/api';
import './JiraSettingsPage.css';

// ─────────────────────────── HELPERS ────────────────────────────
const Section = ({ icon: Icon, title, color, children, defaultOpen = true }) => {
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

  const [showRangeModal, setShowRangeModal] = useState(false);
  const [rangeStartDate, setRangeStartDate] = useState('2025-01-01');
  const [rangeEndDate, setRangeEndDate] = useState(new Date().toISOString().split('T')[0]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getJiraConfig();
      setCfg(data);
    } catch (e) {
      showToast('خطا در دریافت تنظیمات جیرا: ' + (e.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

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
    try {
      setSyncing(true);
      setActiveModal({
        status: 'loading',
        title: '🔄 در حال همگام‌سازی زنده با سرور Jira',
        message: `دیتابیس در حال دریافت اپیک‌ها و تسک‌های جدید پروژه‌های انتخاب‌شده (${cfg?.connection?.projectKey || 'اصلی'}) مستقیم از سرور جیرا می‌باشد...`
      });
      // Auto-save current config first so newly entered Project Key is immediately active
      await api.saveJiraConfig(cfg);
      // Execute live sync from Jira
      const res = await api.resetDatabase();
      setActiveModal({
        status: 'success',
        title: '✅ همگام‌سازی با موفقیت انجام شد',
        message: res.message || 'دیتابیس با داده‌های زنده Jira همگام شد. با زدن دکمه تأیید، صفحه بازنشانی می‌شود.',
        onConfirm: () => window.location.reload()
      });
    } catch (e) {
      setActiveModal({
        status: 'error',
        title: '❌ خطا در همگام‌سازی با Jira',
        message: e.message || 'همگام‌سازی با خطا مواجه شد.'
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

    await api.saveJiraConfig(cfg);

    for (let i = 0; i < monthRanges.length; i++) {
      const mRange = monthRanges[i];
      const stepNum = i + 1;
      const totalSteps = monthRanges.length;

      setActiveModal({
        status: 'loading',
        title: `${titlePrefix} (ماه ${stepNum} از ${totalSteps})`,
        message: `در حال دریافت اطلاعات ماه ${mRange.jalaliName} (${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]})... لطفاً صبور باشید.`
      });

      try {
        const res = await api.syncSingleMonthJiraConfig({
          startStr: mRange.startStr,
          endStr: mRange.endStr,
          monthLabel: mRange.jalaliName,
          monthIndex: stepNum
        });

        const monthRes = res.success ? res : {
          monthIndex: stepNum,
          monthLabel: mRange.jalaliName,
          jalaliName: mRange.jalaliName,
          gregorianName: mRange.gregorianName,
          dateRange: `${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]}`,
          status: 'error',
          taskCount: 0,
          jql: res.jql || '',
          message: res.message || 'خطا در شبکه'
        };

        if (!monthRes.jalaliName) monthRes.jalaliName = mRange.jalaliName;
        if (!monthRes.gregorianName) monthRes.gregorianName = mRange.gregorianName;

        totalTasksSynced += (monthRes.taskCount || 0);
        results.push(monthRes);

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

    setActiveModal({
      status: 'success',
      title: '✅ همگام‌سازی با موفقیت کامل گردید',
      message: `مجموع ${totalTasksSynced} تسک از ${monthRanges.length} ماه بررسی‌شده دریافت و ثبت گردید.`
    });
    setMonthlySyncing(false);
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

      monthRanges.push({
        monthIndex: 12 - i,
        year: y,
        month: m + 1,
        jalaliName: monthInfo.jalali,
        gregorianName: monthInfo.gregorian,
        startStr,
        endStr
      });
    }

    await executeStepByStepSync(monthRanges, '🗓️ در حال همگام‌سازی ۱۲ ماه گذشته');
  };

  const handleRangeSync = async () => {
    if (!rangeStartDate || !rangeEndDate) {
      showToast('لطفاً هر دو تاریخ شروع و پایان را انتخاب فرمایید.', 'error');
      return;
    }
    setShowRangeModal(false);

    const startDt = new Date(rangeStartDate);
    const endDt = new Date(rangeEndDate);

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
      const monthInfo = getJalaliMonthLabel(y, m);

      monthRanges.push({
        monthIndex: stepIndex++,
        year: y,
        month: m + 1,
        jalaliName: monthInfo.jalali,
        gregorianName: monthInfo.gregorian,
        startStr,
        endStr
      });

      curr = new Date(y, m + 1, 1);
    }

    await executeStepByStepSync(monthRanges, '📅 در حال همگام‌سازی بازه تاریخ انتخاب‌شده');
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
      <div className="jsp-header">
        <div>
          <h1 className="jsp-title"><Settings size={26} className="text-accent-cyan" />تنظیمات کامل اتصال و مپینگ Jira API</h1>
          <p className="jsp-subtitle">مدیریت کامل تمام مپینگ‌ها، فیلدهای کاستوم، وضعیت‌ها، برچسب‌ها و تشخیص‌دهنده زنده API جیرا</p>
        </div>
        <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
          <button className="jsp-run-diag-btn secondary" onClick={handleDiagnose} disabled={diagLoading}>
            <Zap size={16} className={diagLoading ? 'spin' : ''} />
            {diagLoading ? 'در حال پایش...' : '🔍 پایش زنده API'}
          </button>
          <button className="jsp-run-diag-btn" style={{ background: '#10B981' }} onClick={() => setShowRangeModal(true)} disabled={monthlySyncing}>
            <Calendar size={16} />
            📅 همگام‌سازی بازه دلخواه
          </button>
          <button className="jsp-run-diag-btn" style={{ background: '#8B5CF6' }} onClick={handleMonthlySync} disabled={monthlySyncing}>
            <Calendar size={16} className={monthlySyncing ? 'spin' : ''} />
            {monthlySyncing ? 'در حال دریافت ۱۲ ماه...' : '🗓️ همگام‌سازی ۱۲ ماه گذشته'}
          </button>
          <button className="jsp-run-diag-btn" style={{ background: '#0EA5E9' }} onClick={handleSync} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'spin' : ''} />
            {syncing ? 'در حال دریافت...' : '🔄 همگام‌سازی سریع'}
          </button>
          <button className="jsp-run-diag-btn" onClick={handleSave} disabled={saving}>
            <Save size={16} className={saving ? 'spin' : ''} />
            {saving ? 'در حال ذخیره...' : '💾 ذخیره تنظیمات'}
          </button>
        </div>
      </div>

      {/* 📅 Datepicker Custom Range Sync Modal Overlay */}
      <AnimatePresence>
        {showRangeModal && (
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
                border: '1px solid rgba(16, 185, 129, 0.5)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 35px rgba(16,185,129,0.3)',
                borderRadius: '24px',
                padding: '2.2rem 2.5rem',
                maxWidth: '480px',
                width: '100%',
                color: '#FFFFFF'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#6EE7B7', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Calendar size={24} /> همگام‌سازی بازه زمانی دلخواه
                </h3>
                <button
                  onClick={() => setShowRangeModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <p style={{ margin: '0 0 1.35rem 0', fontSize: '0.88rem', color: '#CBD5E1', lineHeight: '1.6' }}>
                لطفاً تاریخ شروع و پایان مورد نظر خود را انتخاب نمایید. سیستم کوئری‌های تفکیک‌شده ماهانه را ارسال کرده و گزارش کامل دریافت داده‌ها را آماده می‌سازد.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 'bold', color: '#38BDF8', marginBottom: '0.45rem' }}>
                    🗓️ تاریخ شروع (روز / ماه / سال):
                  </label>
                  <input
                    type="date"
                    value={rangeStartDate}
                    onChange={e => setRangeStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#FFFFFF',
                      borderRadius: '12px',
                      padding: '0.65rem 0.95rem',
                      fontSize: '0.95rem',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 'bold', color: '#38BDF8', marginBottom: '0.45rem' }}>
                    🗓️ تاریخ پایان (روز / ماه / سال):
                  </label>
                  <input
                    type="date"
                    value={rangeEndDate}
                    onChange={e => setRangeEndDate(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#FFFFFF',
                      borderRadius: '12px',
                      padding: '0.65rem 0.95rem',
                      fontSize: '0.95rem',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowRangeModal(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#CBD5E1',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '0.6rem 1.35rem',
                    borderRadius: '12px',
                    fontSize: '0.88rem',
                    cursor: 'pointer'
                  }}
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleRangeSync}
                  style={{
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.6rem 1.6rem',
                    borderRadius: '12px',
                    fontSize: '0.88rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  🚀 شروع همگام‌سازی بازه
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 12-MONTH BATCH SYNC RESULTS ── */}
      {monthlyResults && (
        <motion.div className="glass-card jsp-diag-card" style={{ borderColor: 'rgba(139, 92, 246, 0.4)', background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4), rgba(15, 23, 42, 0.85))' }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="jsp-diag-header">
            <div>
              <h2 style={{ color: '#C084FC', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Calendar size={22} /> گزارش تفکیکی همگام‌سازی ۱۲ ماه گذشته (یک سال اخیر)
              </h2>
              <p className="jsp-diag-sub" style={{ marginTop: '0.45rem' }}>
                تعداد کل تسک‌های دریافت‌شده: <strong style={{ color: '#38BDF8', fontSize: '1.05rem' }}>{monthlyResults.totalTasksSynced || 0} تسک</strong> | تعداد ماه بررسی‌شده: <strong>۱۲ ماه</strong>
              </p>
            </div>
            <button className="jsp-delete-row" style={{ color: '#A78BFA', cursor: 'pointer' }} onClick={() => setMonthlyResults(null)} title="بستن این گزارش">
              <X size={20} />
            </button>
          </div>

          <div className="jsp-diag-table-wrapper" style={{ marginTop: '1rem', maxHeight: '420px', overflowY: 'auto' }}>
            <table className="jsp-diag-table">
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>ردیف</th>
                  <th>دوره زمانی (ماه)</th>
                  <th>بازه تاریخ میلادی</th>
                  <th>وضعیت همگام‌سازی</th>
                  <th>تعداد تسک دریافت‌شده</th>
                  <th>کوئری JQL اجراشده</th>
                </tr>
              </thead>
              <tbody>
                {monthlyResults.monthlyResults?.map((m) => (
                  <tr key={m.monthIndex}>
                    <td><strong>ماه {m.monthIndex}</strong></td>
                    <td>
                      <strong style={{ color: '#F8FAFC' }}>{m.jalaliName}</strong>
                      <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{m.gregorianName}</div>
                    </td>
                    <td><code className="mono-code" style={{ fontSize: '0.8rem' }}>{m.dateRange}</code></td>
                    <td>
                      <span className={`diag-status-pill ${m.status === 'success' ? 'matched' : m.status === 'empty' ? 'warning' : 'missing'}`}>
                        {m.status === 'success' ? '✅ موفق' : m.status === 'empty' ? '⚠️ ۰ تسک (بدون نتیجه)' : '❌ خطا'}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: m.taskCount > 0 ? '#38BDF8' : '#64748B', fontSize: '0.95rem' }}>
                        {m.taskCount} تسک
                      </strong>
                    </td>
                    <td>
                      <code className="diag-val-code accent" style={{ fontSize: '0.76rem', whiteSpace: 'nowrap', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }} title={m.jql}>
                        {m.jql}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── DIAGNOSTIC RESULTS (TOP OF PAGE) ── */}
      {diagResult && (
        <motion.div className="glass-card jsp-diag-card" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="jsp-diag-header">
            <div>
              <h2>گزارش پایش زنده ساختار Jira API</h2>
              {diagResult.projectName && (
                <p className="jsp-diag-sub">
                  پروژه: <strong>{diagResult.projectName}</strong> — تسک نمونه: <strong>{diagResult.sampleIssueKey}</strong> — مجموع تسک‌ها: {diagResult.totalIssuesFound}
                </p>
              )}
            </div>
            {diagResult.complianceScore !== undefined && (
              <div className={`jsp-score-badge ${diagResult.complianceScore >= 80 ? 'good' : diagResult.complianceScore >= 50 ? 'warn' : 'bad'}`}>
                <span className="score-num">%{diagResult.complianceScore}</span>
                <span className="score-lbl">تطابق ساختاری</span>
              </div>
            )}
          </div>

          {!diagResult.success && (
            <div className="jsp-error-msg"><AlertTriangle size={16} /> {diagResult.message}</div>
          )}

          {diagResult.requestDetails && (
            <div className="jsp-req-details-box">
              <h4>📋 اطلاعات کامل درخواست ارسالی به سرور Jira:</h4>
              <div className="jsp-req-grid">
                <div><span>آدرس سرور (Base URL):</span> <code>{diagResult.requestDetails.baseUrl}</code></div>
                <div><span>نام کاربری:</span> <code>{diagResult.requestDetails.username || '—'}</code></div>
                <div><span>کلید پروژه:</span> <code>{diagResult.requestDetails.projectKey}</code></div>
                <div><span>کوئری JQL اجراشده:</span> <code className="accent">{diagResult.requestDetails.executedJql}</code></div>
                <div><span>مسیر REST API:</span> <code>{diagResult.requestDetails.endpoint}</code></div>
              </div>
            </div>
          )}

          {diagResult.diagnostics?.length > 0 && (
            <div className="jsp-diag-table-wrapper">
              <table className="jsp-diag-table">
                <thead>
                  <tr>
                    <th>فیلد مورد انتظار</th>
                    <th>وضعیت</th>
                    <th>مقدار دریافتی از Jira</th>
                    <th>توضیح و راهکار</th>
                  </tr>
                </thead>
                <tbody>
                  {diagResult.diagnostics.map((d, i) => (
                    <tr key={i}>
                      <td><strong className="mono-code">{d.field}</strong></td>
                      <td>
                        <span className={`diag-status-pill ${d.status}`}>
                          {d.status === 'matched' ? '✅ تطابق' : d.status === 'warning' ? '⚠️ بررسی شود' : d.status === 'missing' ? '❌ یافت نشد' : 'ℹ️ اختیاری'}
                        </span>
                      </td>
                      <td><code className="diag-val-code">{d.value || '—'}</code></td>
                      <td className="diag-note-text">{d.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {diagResult.rawSampleKeys?.length > 0 && (
            <div className="jsp-customfields-footer">
              <h4>فیلدهای شناسایی‌شده در پاسخ Jira (می‌توانید از اینها در بخش Custom Fields استفاده کنید):</h4>
              <div className="jsp-cf-tags">
                {diagResult.rawSampleKeys.map(k => <span key={k} className="jsp-cf-tag">{k}</span>)}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── 1. CONNECTION ── */}
      <Section icon={Server} title="اتصال به Jira Cloud / Server (Connection Settings)" color="#38BDF8">
        <div className="jsp-grid-2">
          <Field label="آدرس پایه Jira (Base URL)" hint="مثال: https://10.100.71.140:8443 یا https://jira.company.com">
            <Input value={cfg.connection?.baseUrl} onChange={v => set('connection', 'baseUrl', v)} placeholder="https://10.100.71.140:8443" />
          </Field>
          <Field label="نام کاربری / ایمیل حساب Jira" hint="نام کاربری یا ایمیل حساب جیرا">
            <Input value={cfg.connection?.username} onChange={v => set('connection', 'username', v)} placeholder="m.ghafoory" />
          </Field>
          <Field label="API Token / کلمه عبور جیرا" hint="کلمه عبور یا توکن اختصاصی حساب جیرا">
            <Input value={cfg.connection?.token} onChange={v => set('connection', 'token', v)} placeholder="NzIyMzUz..." password />
          </Field>
          <Field label="کلید پروژه اصلی (Project Key)" hint="مثال: ORD، OPS، DEV">
            <Input value={cfg.connection?.projectKey} onChange={v => set('connection', 'projectKey', v)} placeholder="ORD" mono />
          </Field>
          <Field label="فاصله سینک خودکار (دقیقه)" hint="هر چند دقیقه داده‌های جیرا سینک شود">
            <Input value={cfg.connection?.syncIntervalMinutes} onChange={v => set('connection', 'syncIntervalMinutes', v)} placeholder="60" mono />
          </Field>

          {/* 🌟 Multi-Select Jira Project Discovery Combo */}
          <div style={{ gridColumn: 'span 2', marginTop: '0.5rem', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--glass-border)', borderRadius: '14px', padding: '1.1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong style={{ color: '#38BDF8', fontSize: '0.94rem' }}>🌐 انتخاب چندتایی پروژه‌های Jira (Project Selector Combo):</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  با زدن دکمه روبرو، لیست کامل پروژه‌های موجود در سرور جیرا دریافت می‌شود و می‌توانید چند پروژه را تیک بزنید.
                </p>
              </div>
              <button
                type="button"
                className="jsp-run-diag-btn secondary"
                onClick={handleFetchProjects}
                disabled={fetchingProjects}
                style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem' }}
              >
                <RefreshCw size={14} className={fetchingProjects ? 'spin' : ''} />
                {fetchingProjects ? 'در حال دریافت لیست...' : '🔍 دریافت لیست پروژه‌های Jira'}
              </button>
            </div>

            {/* List of Discovered Projects Pills */}
            {discoveredProjects.length > 0 ? (
              <div>
                {/* 🔍 Mini Live Search Box, Active Projects Toggle & Counter */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={projectSearchTerm}
                      onChange={e => setProjectSearchTerm(e.target.value)}
                      placeholder="🔍 جستجوی سریع پروژه‌ها (نام یا کلید)..."
                      style={{
                        flex: 1,
                        maxWidth: '280px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#FFFFFF',
                        borderRadius: '8px',
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.82rem',
                        outline: 'none'
                      }}
                    />

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: '#E2E8F0', cursor: 'pointer', userSelect: 'none', background: 'rgba(255, 255, 255, 0.06)', padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                      <input
                        type="checkbox"
                        checked={onlyActiveProjects}
                        onChange={e => setOnlyActiveProjects(e.target.checked)}
                        style={{ accentColor: '#38BDF8', width: '15px', height: '15px', cursor: 'pointer' }}
                      />
                      <span>🔥 فقط پروژه‌های دارای اپیک (اپیک &gt; ۰)</span>
                    </label>
                  </div>

                  <span style={{ fontSize: '0.8rem', color: '#38BDF8', fontWeight: 'bold' }}>
                    📊 {filteredDiscoveredProjects.length} از {discoveredProjects.length} پروژه
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.25)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--glass-border)', maxHeight: '200px', overflowY: 'auto' }}>
                  {filteredDiscoveredProjects.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem' }}>
                      نتیجه‌ای برای عبارات «{projectSearchTerm}» یافت نشد.
                    </div>
                  ) : (
                    filteredDiscoveredProjects.map(p => {
                      const isSel = selectedProjectKeys.includes(p.key);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => toggleProjectKey(p.key)}
                          style={{
                            padding: '0.42rem 0.9rem',
                            borderRadius: '20px',
                            border: isSel ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.15)',
                            background: isSel ? 'linear-gradient(135deg, rgba(14,165,233,0.35), rgba(59,130,246,0.35))' : 'rgba(255,255,255,0.05)',
                            color: isSel ? '#FFFFFF' : 'var(--text-secondary)',
                            fontWeight: isSel ? '800' : '500',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            fontSize: '0.84rem',
                            boxShadow: isSel ? '0 0 12px rgba(56,189,248,0.3)' : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {isSel ? '✅' : '➕'} <strong>{p.key}</strong> <small style={{ opacity: 0.85 }}>({p.name})</small>
                          {p.epicCount !== undefined && (
                            <span style={{
                              background: isSel ? 'rgba(255, 255, 255, 0.25)' : 'rgba(56, 189, 248, 0.2)',
                              color: isSel ? '#FFFFFF' : '#38BDF8',
                              padding: '0.1rem 0.5rem',
                              borderRadius: '10px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              marginRight: '0.2rem'
                            }}>
                              {p.epicCount} اپیک
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.85rem', background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.85rem', borderRadius: '8px' }}>
                💡 برای دریافت لیست و کمبو باکس زنده تمام پروژه‌های سرور جیرا، دکمه <strong>«🔍 دریافت لیست پروژه‌های Jira»</strong> را کلیک بفرمایید.
              </div>
            )}

            {/* Manual input field */}
            <Field label="کلیدهای پروژه انتخاب‌شده جهت همگام‌سازی (Project Keys):" hint="می‌توانید به صورت دستی یا از لیست بالا انتخاب کنید (با ویرگول جدا می‌شوند)">
              <Input value={cfg.connection?.projectKey} onChange={v => set('connection', 'projectKey', v)} placeholder="ORD, OPS, DEV" mono />
            </Field>

            {/* Selected Projects Summary Banner */}
            {selectedProjectKeys.length > 0 && (
              <div style={{ marginTop: '0.85rem', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '10px', padding: '0.75rem 1.05rem', fontSize: '0.86rem', lineHeight: '1.6' }}>
                <strong style={{ color: '#38BDF8' }}>📌 پروژه‌های انتخاب‌شده فعلی جهت همگام‌سازی:</strong>
                <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {selectedProjectKeys.map(k => {
                    const found = discoveredProjects.find(p => p.key === k);
                    return (
                      <span key={k} style={{ background: 'rgba(14, 165, 233, 0.25)', border: '1px solid #38BDF8', color: '#FFFFFF', padding: '0.2rem 0.65rem', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 'bold' }}>
                        {k} {found ? `(${found.name}${found.epicCount !== undefined ? ` - ${found.epicCount} اپیک` : ''})` : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── 1.5. API ENDPOINTS & VERSION ── */}
      <Section icon={Cpu} title="نسخه و مسیرهای API جیرا (API Version & Custom Endpoints)" color="#6366F1">
        <p className="jsp-section-desc">اگر جیرای سازمان شما نسخه Server / Data Center یا دارای آدرس‌های اختصاصی API است، می‌توانید نسخه و مسیرها را تعیین فرمایید.</p>
        <div className="jsp-grid-2">
          <Field label="نوع و نسخه Jira API" hint="تعیین نوع ساختار متدهای API">
            <select
              value={cfg.apiEndpoints?.apiVersion || 'auto'}
              onChange={e => set('apiEndpoints', 'apiVersion', e.target.value)}
              className="jsp-input"
            >
              <option value="auto">🔄 تشخیص خودکار (Auto-Detect Cloud v3 / Server v2)</option>
              <option value="v3">🌐 Jira Cloud (REST API v3)</option>
              <option value="v2">🖥️ Jira Server / Data Center (REST API v2)</option>
            </select>
          </Field>
          <Field label="آدرس Endpoint جستجو (Search Endpoint)" hint="مسیر API جستجوی JQL">
            <Input value={cfg.apiEndpoints?.searchEndpoint} onChange={v => set('apiEndpoints', 'searchEndpoint', v)} placeholder="/rest/api/3/search/jql" mono />
          </Field>
          <Field label="آدرس Endpoint پروژه (Project Endpoint)" hint="مسیر API دریافت اطلاعات پروژه">
            <Input value={cfg.apiEndpoints?.projectEndpoint} onChange={v => set('apiEndpoints', 'projectEndpoint', v)} placeholder="/rest/api/3/project" mono />
          </Field>
        </div>
      </Section>

      {/* ── 1.8. SERVER & DATABASE MANAGEMENT ── */}
      <Section icon={Server} title="تنظیمات سرور و دیتابیس (Server & Database Management)" color="#10B981" defaultOpen={false}>
        <p className="jsp-section-desc">مدیریت پورت سرویس‌دهنده، کلیدهای امنیتی و بازنشانی دیتابیسSQLite متصل به سیستم.</p>
        <div className="jsp-grid-2">
          <Field label="پورت سرور بک‌اند (Port)" hint="پورت سرویس‌دهنده Node.js">
            <Input value={cfg.serverAndDb?.port} onChange={v => set('serverAndDb', 'port', v)} placeholder="3001" mono />
          </Field>
          <Field label="کلید امنیتی توکن‌ها (JWT Secret)" hint="برای امضای امن توکن‌های کاربران">
            <Input value={cfg.serverAndDb?.jwtSecret} onChange={v => set('serverAndDb', 'jwtSecret', v)} placeholder="dev-secret-key" password />
          </Field>
          <Field label="نوع و شناسه دیتابیس متصل" hint="موتور دیتابیس ذخیره‌سازی محلی">
            <Input value={cfg.serverAndDb?.dbDriver || 'SQLite 3 (database.sqlite)'} onChange={() => {}} placeholder="SQLite 3" mono />
          </Field>
          <Field label="وضعیت دیتابیس" hint="وضعیت اتصال به فایل database.sqlite">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.3rem' }}>
              <span className="diag-status-pill matched">✅ متصل و فعال</span>
              <button 
                className="jsp-add-mapping-btn" 
                style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#38BDF8' }}
                onClick={async () => {
                  if (window.confirm('آیا مایلید تمام داده‌های دیتابیس بر اساس داده‌های ۱۰۰٪ زنده Jira Cloud بازنشانی شوند؟')) {
                    try {
                      showToast('در حال همگام‌سازی و بازسازی دیتابیس از Jira...');
                      const res = await api.resetDatabase();
                      showToast(res.message || 'دیتابیس با داده‌های زنده جیرا همگام شد.');
                      setTimeout(() => window.location.reload(), 1500);
                    } catch (e) {
                      showToast('خطا در بازسازی دیتابیس', 'error');
                    }
                  }
                }}
              >
                🔄 همگام‌سازی و بازسازی دیتابیس از Jira Cloud
              </button>
            </div>
          </Field>
        </div>
      </Section>

      {/* ── 2. CONFLUENCE ── */}
      <Section icon={GitBranch} title="اتصال به Confluence (مستندات)" color="#A78BFA" defaultOpen={false}>
        <div className="jsp-grid-2">
          <Field label="آدرس Confluence Base URL">
            <Input value={cfg.confluence?.baseUrl} onChange={v => set('confluence', 'baseUrl', v)} placeholder="https://10.100.71.140:8443/wiki" />
          </Field>
          <Field label="ایمیل / نام کاربری حساب Confluence">
            <Input value={cfg.confluence?.username} onChange={v => set('confluence', 'username', v)} placeholder="m.ghafoory" />
          </Field>
          <Field label="کلید پیش‌فرض Space" hint="مثال: OPS، TECH، DEV">
            <Input value={cfg.confluence?.defaultSpaceKey} onChange={v => set('confluence', 'defaultSpaceKey', v)} placeholder="OPS" mono />
          </Field>
        </div>
      </Section>

      {/* ── 3. WAITING STATUSES ── */}
      <Section icon={AlertTriangle} title="وضعیت‌های «منتظر» (Waiting Status List)" color="#FBBF24">
        <p className="jsp-section-desc">وضعیت‌های جیرا که باید به‌عنوان «منتظر تیم‌های دیگر» شناسایی شوند. هر وضعیت را وارد کرده و Enter بزنید.</p>
        <TagList
          items={cfg.waitingStatuses || []}
          onChange={v => setCfg(prev => ({ ...prev, waitingStatuses: v }))}
          placeholder="OnHolding، Waiting، Blocked..."
        />
      </Section>

      {/* ── 4. STATUS MAPPING ── */}
      <Section icon={Tag} title="نگاشت وضعیت‌های Jira به داشبورد (Status Mapping)" color="#10B981">
        <p className="jsp-section-desc">هر وضعیت اصلی جیرا را به وضعیت داشبورد نگاشت کنید. وضعیت‌های داشبورد: Done، In Progress، Waiting، To Do</p>
        <StatusMappingEditor
          mapping={cfg.statusMapping || {}}
          onChange={v => setCfg(prev => ({ ...prev, statusMapping: v }))}
        />
      </Section>

      {/* ── 5. CUSTOM FIELDS ── */}
      <Section icon={Cpu} title="فیلدهای کاستوم Jira (Custom Fields Mapping)" color="#EC4899">
        <p className="jsp-section-desc">شماره کاستوم‌فیلدهای اختصاصی جیرای سازمان را وارد کنید. پس از اجرای پایش زنده، شناسه‌های دقیق نمایش داده می‌شوند.</p>
        <div className="jsp-grid-2">
          <Field label="فیلد Sprint" hint="معمولاً customfield_10004 (یا customfield_10020)">
            <Input value={cfg.customFields?.sprintField} onChange={v => set('customFields', 'sprintField', v)} placeholder="customfield_10004" mono />
          </Field>
          <Field label="فیلد تیم منتظر (Waiting Team)" hint="اختیاری - شناسه فیلد کاستوم">
            <Input value={cfg.customFields?.waitingTeamField} onChange={v => set('customFields', 'waitingTeamField', v)} placeholder="customfield_XXXXX" mono />
          </Field>
          <Field label="فیلد دلیل انتظار (Waiting Reason)" hint="اختیاری">
            <Input value={cfg.customFields?.waitingReasonField} onChange={v => set('customFields', 'waitingReasonField', v)} placeholder="customfield_XXXXX" mono />
          </Field>
          <Field label="فیلد لینک Confluence" hint="اختیاری">
            <Input value={cfg.customFields?.confluenceLinkField} onChange={v => set('customFields', 'confluenceLinkField', v)} placeholder="customfield_XXXXX" mono />
          </Field>
          <Field label="فیلد قابلیت‌های عملیاتی (Capabilities)" hint="اختیاری">
            <Input value={cfg.customFields?.capabilitiesField} onChange={v => set('customFields', 'capabilitiesField', v)} placeholder="customfield_XXXXX" mono />
          </Field>
          <Field label="فیلد دسته‌بندی پروژه (Category)" hint="اختیاری">
            <Input value={cfg.customFields?.categoryField} onChange={v => set('customFields', 'categoryField', v)} placeholder="customfield_XXXXX" mono />
          </Field>
        </div>
      </Section>

      {/* ── 6. DATE MAPPING ── */}
      <Section icon={Calendar} title="نگاشت فیلدهای تاریخ (Date Field Mapping)" color="#06B6D4" defaultOpen={false}>
        <div className="jsp-grid-2">
          <Field label="فیلد تاریخ شروع اپیک" hint="معمولاً created یا customfield_XXXXX">
            <Input value={cfg.dateMapping?.epicStartDateField} onChange={v => set('dateMapping', 'epicStartDateField', v)} placeholder="created" mono />
          </Field>
          <Field label="فیلد تاریخ سررسید اپیک" hint="معمولاً duedate">
            <Input value={cfg.dateMapping?.epicDueDateField} onChange={v => set('dateMapping', 'epicDueDateField', v)} placeholder="duedate" mono />
          </Field>
          <Field label="فیلد تاریخ شروع تسک" hint="اختیاری">
            <Input value={cfg.dateMapping?.taskStartDateField} onChange={v => set('dateMapping', 'taskStartDateField', v)} placeholder="customfield_XXXXX" mono />
          </Field>
          <Field label="فیلد تاریخ سررسید تسک" hint="معمولاً duedate">
            <Input value={cfg.dateMapping?.taskDueDateField} onChange={v => set('dateMapping', 'taskDueDateField', v)} placeholder="duedate" mono />
          </Field>
        </div>
      </Section>

      {/* ── 7. LABEL PREFIXES ── */}
      <Section icon={Tag} title="پیشوندهای لیبل‌های جیرا (Label Prefixes)" color="#F97316" defaultOpen={false}>
        <p className="jsp-section-desc">برچسب‌هایی که برای تشخیص تیم منتظر، دلیل انتظار و قابلیت‌ها از لیبل‌های Jira استفاده می‌شوند.</p>
        <div className="jsp-grid-2">
          <Field label="پیشوند تیم منتظر" hint="مثال: wait: → لیبل: wait:infra-team">
            <Input value={cfg.labelPrefixes?.waitingTeam} onChange={v => set('labelPrefixes', 'waitingTeam', v)} placeholder="wait:" mono />
          </Field>
          <Field label="پیشوند دلیل انتظار" hint="مثال: reason: → لیبل: reason:waiting-for-approval">
            <Input value={cfg.labelPrefixes?.waitingReason} onChange={v => set('labelPrefixes', 'waitingReason', v)} placeholder="reason:" mono />
          </Field>
          <Field label="پیشوند قابلیت عملیاتی" hint="مثال: cap: → لیبل: cap:monitoring">
            <Input value={cfg.labelPrefixes?.capability} onChange={v => set('labelPrefixes', 'capability', v)} placeholder="cap:" mono />
          </Field>
        </div>
      </Section>

      {/* ── 8. FEATURED COMPONENTS ── */}
      <Section icon={Cpu} title="کامپوننت‌های برجسته داشبورد (Featured Components)" color="#8B5CF6" defaultOpen={false}>
        <p className="jsp-section-desc">کامپوننت‌هایی که به‌عنوان دکمه فیلتر سریع در صفحه داشبورد نمایش داده می‌شوند.</p>
        <TagList
          items={cfg.featuredComponents || []}
          onChange={v => setCfg(prev => ({ ...prev, featuredComponents: v }))}
          placeholder="learning، meeting، support..."
        />
      </Section>

    </motion.div>
  );
};

export default JiraSettingsPage;
