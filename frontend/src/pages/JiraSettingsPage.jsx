import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Server, Cpu, GitBranch, Tag, Calendar,
  RefreshCw, Save, CheckCircle2, AlertTriangle, X,
  ChevronDown, ChevronUp, Info, Eye, EyeOff, Zap, Database, Search
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
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('database');
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
  const syncLogsWrapperRef = useRef(null);
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
  const [confirmModal, setConfirmModal] = useState(null);
  const [mismatchModalData, setMismatchModalData] = useState(null);
  const [mismatchLoading, setMismatchLoading] = useState(false);
  const [mismatchSearch, setMismatchSearch] = useState('');
  const [mismatchTab, setMismatchTab] = useState('mismatched');

  const openMismatchDiagnosticModal = async (category = 'epics') => {
    try {
      setMismatchLoading(true);
      showToast(`🔍 در حال استخراج و تحلیل زنده اختلافات ${category === 'epics' ? 'اپیک‌ها' : 'تسک‌ها'}...`);
      const months = parseInt(cfg?.rebuildMonths, 10) || 3;
      const res = await api.getMismatchDetails(category, months);
      setMismatchModalData(res);
      setMismatchTab(res.mismatchCount > 0 ? 'mismatched' : 'all');
    } catch (e) {
      showToast('خطا در دریافت تحلیل اختلافات: ' + e.message, 'error');
    } finally {
      setMismatchLoading(false);
    }
  };

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
  const [jiraCountLoading, setJiraCountLoading] = useState(false);
  const [jiraCountError, setJiraCountError] = useState(null);

  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  const fetchJiraCount = useCallback(async (isManualTrigger = false, customMonths = null) => {
    try {
      setJiraCountLoading(true);
      setJiraCountError(null);
      const targetMonths = customMonths || cfgRef.current?.rebuildMonths || 3;
      if (isManualTrigger) {
        showToast(`🔄 در حال استخراج و مقایسه آمار زنده (${targetMonths} ماهه) از سرور جیرا...`, 'info');
      }
      const countRes = await api.getJiraTotalCount(targetMonths);
      if (countRes && countRes.success) {
        setJiraCountData(countRes);
        if (isManualTrigger) {
          showToast(`✅ آمار زنده سرور جیرا (${targetMonths} ماهه) با موفقیت دریافت گردید.`, 'success');
        }
      } else {
        const errMsg = countRes?.message || 'خطای نامشخص در دریافت آمار زنده از جیرا';
        setJiraCountError(errMsg);
        if (isManualTrigger) {
          showToast('⚠️ ' + errMsg, 'error');
        }
      }
    } catch (e) {
      const errMsg = e.message || 'خطا در ارتباط با سرور جیرا';
      setJiraCountError(errMsg);
      if (isManualTrigger) {
        showToast('⚠️ ' + errMsg, 'error');
      }
    } finally {
      setJiraCountLoading(false);
    }
  }, []);

  const fetchDbStats = useCallback(async (customMonths = null) => {
    try {
      setDbStatsLoading(true);
      const targetMonths = customMonths || cfgRef.current?.rebuildMonths || 3;
      const res = await api.getDbStats(targetMonths).catch(() => null);
      if (res && res.success) {
        setDbStats(res);
      }
      fetchJiraCount(false, targetMonths);
    } catch (e) {
      console.error('Failed to fetch DB stats:', e);
    } finally {
      setDbStatsLoading(false);
    }
  }, [fetchJiraCount]);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getJiraConfig();
      setCfg(data);
      fetchDbStats(data?.rebuildMonths || 3);
    } catch (e) {
      showToast('خطا در دریافت تنظیمات جیرا: ' + (e.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchDbStats]);

  useEffect(() => { fetchConfig(); }, []);

  const handleSelectRebuildMonths = (months) => {
    const validMonths = Math.max(1, parseInt(months, 10) || 3);
    setCfg(prev => ({ ...prev, rebuildMonths: validMonths }));
    fetchDbStats(validMonths);
  };

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

  
  useEffect(() => {
    if (syncLogsWrapperRef.current && monthlyResults?.monthlyResults?.length) {
      syncLogsWrapperRef.current.scrollTop = syncLogsWrapperRef.current.scrollHeight;
    }
  }, [monthlyResults?.monthlyResults?.length]);

  const executeFullSiteRebuild = async () => {
    const rebuildMonths = parseInt(cfg?.rebuildMonths, 10) || 3;
    try {
      showToast(`🗑️ در حال پاکسازی دیتابیس و شروع استخراج گام به گام ${rebuildMonths} ماه گذشته...`);
      await api.clearDatabase();
      fetchDbStats();

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const monthRanges = [];
      for (let i = rebuildMonths - 1; i >= 0; i--) {
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
          monthIndex: rebuildMonths - i,
          totalMonths: rebuildMonths,
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

      await executeStepByStepSync(monthRanges, `🔥 بازسازی کامل دیتابیس (${rebuildMonths} ماه گذشته)`);
      fetchDbStats();
      fetchJiraCount(false, rebuildMonths);
    } catch (e) {
      showToast('خطا در بازسازی کامل سایت: ' + e.message, 'error');
    }
  };

  const handleFullSiteRebuild = () => {
    const rebuildMonths = parseInt(cfg?.rebuildMonths, 10) || 3;
    setConfirmModal({
      title: '🚨 تأیید نهایی بازسازی کامل دیتابیس و سایت',
      icon: '🔥',
      badge: `${rebuildMonths} ماه گذشته`,
      type: 'warning',
      description: `آیا از اجرا و بازسازی کامل دیتابیس اطمینان دارید؟ دیتابیس فعلی پاکسازی شده و تمام اطلاعات ${rebuildMonths} ماه گذشته به صورت گام به گام و زنده از سرور جیرا استخراج خواهد شد.`,
      confirmText: '🚀 بله، بازسازی کامل انجام شود',
      cancelText: 'انصراف',
      onConfirm: () => executeFullSiteRebuild()
    });
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
            {monthlySyncing ? 'در حال بازسازی...' : `🔥 بازسازی کامل دیتابیس و سایت (${cfg.rebuildMonths || 3} ماه)`}
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

      {/* 📅 POPUP MODAL FOR CUSTOM RANGE JIRA EXTRACTION */}
      <AnimatePresence>
        {showRangeModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99999,
              background: 'rgba(15, 23, 42, 0.82)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem'
            }}
            onClick={() => setShowRangeModal(false)}
          >
            <motion.div
              style={{
                background: 'linear-gradient(135deg, #0F172A, #1E293B)',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                borderRadius: '24px',
                padding: '2rem',
                maxWidth: '650px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(16, 185, 129, 0.25)',
                color: '#FFFFFF'
              }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#6EE7B7', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Calendar size={24} /> همگام‌سازی و استخراج داده‌های جیرا در بازه زمانی دلخواه
                  </h2>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: '#94A3B8' }}>
                    تاریخ شروع و پایان شمسی را انتخاب نمایید؛ پس از زدن دکمه استخراج، این پاپ‌آپ بسته شده و اطلاعات ماه به ماه دریافت می‌شود.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRangeModal(false)}
                  style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', color: '#94A3B8', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Quick Presets Pills */}
              <div style={{ marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.04)', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: '#CBD5E1', marginBottom: '0.5rem' }}>⚡ میان‌برهای بازه زمانی:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                  <button type="button" onClick={() => applyDatePreset(10, 0)} className="jsp-preset-pill">⚡ ۱۰ روز گذشته</button>
                  <button type="button" onClick={() => applyDatePreset(30, 0)} className="jsp-preset-pill">⚡ ۳۰ روز گذشته</button>
                  <button type="button" onClick={() => applyDatePreset(0, 1)} className="jsp-preset-pill purple">🗓️ ۱ ماه اخیر</button>
                  <button type="button" onClick={() => applyDatePreset(0, 2)} className="jsp-preset-pill purple">🗓️ ۲ ماه اخیر</button>
                  <button type="button" onClick={() => applyDatePreset(0, 3)} className="jsp-preset-pill purple">🗓️ ۳ ماه اخیر</button>
                  <button type="button" onClick={() => applyDatePreset(0, 6)} className="jsp-preset-pill green">🗓️ ۶ ماه اخیر</button>
                  <button type="button" onClick={() => applyDatePreset(0, 12)} className="jsp-preset-pill gold">🗓️ ۱ سال اخیر</button>
                  <button type="button" onClick={() => applyDatePreset(0, 24)} className="jsp-preset-pill gold" style={{ borderColor: '#F59E0B', color: '#FCD34D' }}>🗓️ ۲ سال اخیر</button>
                </div>
              </div>

              {/* Jalali Date Pickers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.75rem' }}>
                <JalaliDatePicker
                  label="🗓️ از تاریخ (شمسی):"
                  value={rangeStartJalali}
                  onChange={setRangeStartJalali}
                />
                <JalaliDatePicker
                  label="🗓️ تا تاریخ (شمسی):"
                  value={rangeEndJalali}
                  onChange={setRangeEndJalali}
                />
              </div>

              {/* Modal Action Buttons */}
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.2rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => { setShowRangeModal(false); setJqlPreview(null); setJqlTestResults(null); }}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#94A3B8', borderRadius: '12px', padding: '0.6rem 1.1rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                  ✕ بستن
                </button>
                <button type="button" onClick={handleTestAllJql} disabled={jqlTestLoading || jqlPreviewLoading}
                  style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#fff', border: 'none', borderRadius: '12px', padding: '0.6rem 1.1rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {jqlTestLoading ? '⏳ در حال تست...' : '⚡ تست کوئری جیرا (کوئری ۳)'}
                </button>
                <button type="button" onClick={handleRangeSync} disabled={monthlySyncing}
                  style={{ background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', border: 'none', borderRadius: '12px', padding: '0.6rem 1.3rem', fontSize: '0.9rem', fontWeight: 700, cursor: monthlySyncing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}>
                  <RefreshCw size={16} className={monthlySyncing ? 'spin' : ''} />
                  {monthlySyncing ? 'در حال استخراج...' : '🚀 شروع همگام‌سازی'}
                </button>
              </div>

              {jqlTestResults && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(245,158,11,0.35)', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.77rem', color: '#94A3B8', marginBottom: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span>سرور: <strong style={{ color: '#38BDF8' }}>{jqlTestResults.jiraBaseUrl}</strong></span>
                    <span>پروژه: <strong style={{ color: '#38BDF8' }}>{jqlTestResults.projectKey}</strong></span>
                    <span>شمسی: <strong style={{ color: '#10B981' }}>{jqlTestResults.jalaliRange}</strong></span>
                    <span>میلادی: <strong style={{ color: '#F59E0B' }}>{jqlTestResults.gregorianRange}</strong></span>
                  </div>
                  {jqlTestResults.winnerId
                    ? <div style={{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.4)', borderRadius:'8px', padding:'0.4rem 0.85rem', marginBottom:'0.55rem', fontSize:'0.78rem', color:'#6EE7B7' }}>برنده: <strong>#{jqlTestResults.winnerId}</strong> - این کوئری جواب داد</div>
                    : <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', padding:'0.4rem 0.85rem', marginBottom:'0.55rem', fontSize:'0.78rem', color:'#FCA5A5' }}>هیچ کوئری تسک برنگرداند</div>
                  }
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem', maxHeight:'360px', overflowY:'auto' }}>
                    {jqlTestResults.results.map(r => {
                      const win = r.id === jqlTestResults.winnerId;
                      const bg = win ? 'rgba(16,185,129,0.1)' : r.status==='error' ? 'rgba(239,68,68,0.07)' : r.status==='zero' ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.03)';
                      const bdr = win ? '1.5px solid rgba(16,185,129,0.5)' : r.status==='error' ? '1px solid rgba(239,68,68,0.22)' : '1px solid rgba(255,255,255,0.07)';
                      const badgeColor = win ? '#10B981' : r.status==='error' ? '#EF4444' : r.status==='zero' ? '#F59E0B' : '#6366F1';
                      const badgeText = win ? 'برنده' : r.status==='error' ? 'خطا' : r.status==='zero' ? 'صفر تسک' : '...';
                      return (
                        <div key={r.id} style={{ background:bg, border:bdr, borderRadius:'9px', padding:'0.5rem 0.8rem' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.3rem', marginBottom:'0.25rem' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                              <span style={{ background:badgeColor, color:'#fff', fontSize:'0.64rem', fontWeight:700, padding:'0.1rem 0.4rem', borderRadius:'20px' }}>{badgeText}</span>
                              <span style={{ fontSize:'0.75rem', color: win ? '#A7F3D0' : '#94A3B8', fontWeight: win ? 700 : 400 }}>#{r.id} - {r.name}</span>
                            </div>
                            <div style={{ fontSize:'0.69rem', color:'#64748B', display:'flex', gap:'0.5rem' }}>
                              {r.status!=='error' && <span>{r.total} تسک</span>}
                              {r.status==='error' && <span style={{ color:'#FCA5A5' }}>{r.errorCode}</span>}
                              <span>{r.ms}ms</span>
                            </div>
                          </div>
                          <code style={{ fontSize:'0.71rem', color: win ? '#6EE7B7' : '#475569', wordBreak:'break-all', fontFamily:'monospace', lineHeight:1.5, display:'block' }}>{r.jql}</code>
                          {r.status==='error' && r.errorMsg && <div style={{ fontSize:'0.66rem', color:'#FCA5A5', marginTop:'0.2rem' }}>{r.errorMsg}</div>}
                        </div>
                      );
                    })}
                  </div>
                  {/* ── GRAND TOTAL COUNT FROM JIRA ── */}
                  {jqlTestResults.totalCountInJira !== null && jqlTestResults.totalCountInJira !== undefined && (
                    <div style={{
                      marginTop: '0.85rem',
                      borderTop: '1px solid rgba(56,189,248,0.25)',
                      paddingTop: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ background: 'rgba(56,189,248,0.18)', border: '1px solid rgba(56,189,248,0.45)', color: '#38BDF8', fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '20px' }}>🔢 کوئری COUNT کل</span>
                        <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>تعداد تسک‌های پروژه در جیرا ({cfg.rebuildMonths || 3} ماه گذشته):</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                        <strong style={{ fontSize: '1.35rem', color: '#38BDF8', fontWeight: 800 }}>{jqlTestResults.totalCountInJira.toLocaleString()}</strong>
                        <span style={{ fontSize: '0.78rem', color: '#64748B' }}>تسک</span>
                      </div>
                      {jqlTestResults.countJql && (
                        <div style={{ width: '100%', marginTop: '0.3rem' }}>
                          <code style={{ fontSize: '0.68rem', color: '#475569', wordBreak: 'break-all', fontFamily: 'monospace', background: 'rgba(56,189,248,0.06)', padding: '0.25rem 0.5rem', borderRadius: '6px', display: 'block', border: '1px solid rgba(56,189,248,0.15)' }}>{jqlTestResults.countJql}</code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* JQL Preview Panel */}
              {jqlPreview && !jqlTestResults && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(99,102,241,0.3)', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginBottom: '0.75rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <span>🔗 <strong style={{ color: '#38BDF8' }}>سرور جیرا:</strong> {jqlPreview.jiraBaseUrl}</span>
                    <span>📁 <strong style={{ color: '#38BDF8' }}>پروژه:</strong> {jqlPreview.projectKey}</span>
                    <span>📅 <strong style={{ color: '#10B981' }}>بازه شمسی:</strong> {jqlPreview.jalaliRange}</span>
                    <span>📅 <strong style={{ color: '#F59E0B' }}>بازه میلادی:</strong> {jqlPreview.gregorianRange}</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 0.6rem' }}>کوئری‌های زیر دقیقاً همان‌هایی هستند که به جیرا ارسال می‌شوند. تأیید کنید که فرمت درست است:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '260px', overflowY: 'auto' }}>
                    {jqlPreview.queries.map(q => (
                      <div key={q.id} style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px', padding: '0.6rem 0.9rem' }}>
                        <div style={{ fontSize: '0.74rem', color: '#A78BFA', fontWeight: 700, marginBottom: '0.3rem' }}>
                          #{q.id} — {q.name}
                        </div>
                        <code style={{ fontSize: '0.8rem', color: '#6EE7B7', wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.6 }}>
                          {q.jql}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>




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
<Section icon={Server} title="تنظیمات سرور و دیتابیس (Server & Database Management)" color="#10B981" defaultOpen={true}>
        <p className="jsp-section-desc">پایش زنده وضعیت دیتابیس SQLite، تعداد کل تسک‌های ثبت‌شده، حجم فایل و به‌روزرسانی سیستم.</p>

        {/* 🗓️ CONFIGURABLE TIMEFRAME INLINE BAR */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '12px',
          padding: '0.6rem 0.95rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.65rem',
          boxShadow: '0 4px 15px rgba(0,0,0,0.25)'
        }}>
          {/* Title & Active Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Calendar size={16} color="#10B981" />
            <span style={{ fontWeight: 800, color: '#E2E8F0', fontSize: '0.85rem' }}>
              بازه زمانی بازسازی:
            </span>
            <span style={{ fontSize: '0.78rem', color: '#6EE7B7', background: 'rgba(16, 185, 129, 0.2)', padding: '0.15rem 0.55rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.35)', fontWeight: 700 }}>
              {cfg.rebuildMonths || 3} ماه گذشته
            </span>
          </div>

          {/* Selection Pills & Manual Input in 1 Inline Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleSelectRebuildMonths(1)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                border: cfg?.rebuildMonths === 1 ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.15)',
                background: cfg?.rebuildMonths === 1 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: cfg?.rebuildMonths === 1 ? '#6EE7B7' : '#94A3B8',
                fontWeight: cfg?.rebuildMonths === 1 ? 800 : 500,
                cursor: 'pointer',
                fontSize: '0.78rem',
                transition: 'all 0.2s ease'
              }}
            >
              🚀 ۱ ماه
            </button>

            <button
              type="button"
              onClick={() => handleSelectRebuildMonths(3)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                border: (cfg?.rebuildMonths === 3 || !cfg?.rebuildMonths) ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.15)',
                background: (cfg?.rebuildMonths === 3 || !cfg?.rebuildMonths) ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: (cfg?.rebuildMonths === 3 || !cfg?.rebuildMonths) ? '#38BDF8' : '#94A3B8',
                fontWeight: (cfg?.rebuildMonths === 3 || !cfg?.rebuildMonths) ? 800 : 500,
                cursor: 'pointer',
                fontSize: '0.78rem',
                transition: 'all 0.2s ease'
              }}
            >
              📅 ۳ ماه (پیش‌فرض)
            </button>

            <button
              type="button"
              onClick={() => handleSelectRebuildMonths(6)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                border: cfg?.rebuildMonths === 6 ? '1px solid #F59E0B' : '1px solid rgba(255, 255, 255, 0.15)',
                background: cfg?.rebuildMonths === 6 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: cfg?.rebuildMonths === 6 ? '#FCD34D' : '#94A3B8',
                fontWeight: cfg?.rebuildMonths === 6 ? 800 : 500,
                cursor: 'pointer',
                fontSize: '0.78rem',
                transition: 'all 0.2s ease'
              }}
            >
              🗓️ ۶ ماه
            </button>

            <button
              type="button"
              onClick={() => handleSelectRebuildMonths(12)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                border: cfg?.rebuildMonths === 12 ? '1px solid #A78BFA' : '1px solid rgba(255, 255, 255, 0.15)',
                background: cfg?.rebuildMonths === 12 ? 'rgba(167, 139, 250, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: cfg?.rebuildMonths === 12 ? '#C4B5FD' : '#94A3B8',
                fontWeight: cfg?.rebuildMonths === 12 ? 800 : 500,
                cursor: 'pointer',
                fontSize: '0.78rem',
                transition: 'all 0.2s ease'
              }}
            >
              📅 ۱ سال
            </button>

            <button
              type="button"
              onClick={() => handleSelectRebuildMonths(60)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                border: cfg?.rebuildMonths === 60 ? '1px solid #EC4899' : '1px solid rgba(255, 255, 255, 0.15)',
                background: cfg?.rebuildMonths === 60 ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: cfg?.rebuildMonths === 60 ? '#F472B6' : '#94A3B8',
                fontWeight: cfg?.rebuildMonths === 60 ? 800 : 500,
                cursor: 'pointer',
                fontSize: '0.78rem',
                transition: 'all 0.2s ease'
              }}
            >
              🔥 ۵ سال
            </button>

            {/* Inline Manual Input */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.3rem', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>دستی:</span>
              <Input
                type="number"
                value={cfg?.rebuildMonths || 3}
                onChange={v => handleSelectRebuildMonths(v)}
                placeholder="3"
                style={{ width: '65px', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                mono
              />
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>ماه</span>
            </div>
          </div>
        </div>
        
        {/* 📊 DATABASE STATS TILE CARD */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.8))',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '20px',
          padding: '1.25rem 1.6rem',
          marginBottom: '1.5rem',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35), 0 0 20px rgba(16, 185, 129, 0.15)'
        }}>
          {/* 📊 DATABASE STATS HEADER & DB SIZE BADGE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10B981', color: '#6EE7B7', width: '38px', height: '38px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Database size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#6EE7B7' }}>📊 پایش و آمار زنده دیتابیس سیستم (SQLite)</h3>
                <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>مقایسه زنده و تطبیقی تمام شاخص‌های جیرا و دیتابیس در یک نگاه</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(14, 165, 233, 0.12)', border: '1px solid rgba(14, 165, 233, 0.35)', borderRadius: '10px', padding: '0.35rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.76rem', color: '#94A3B8' }}>💾 حجم دیتابیس:</span>
                <strong style={{ fontSize: '0.95rem', color: '#38BDF8', fontWeight: 800 }}>{dbStats?.dbSizeMb ?? '0.00'} MB</strong>
              </div>
              <button
                type="button"
                onClick={fetchDbStats}
                disabled={dbStatsLoading}
                style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#38BDF8', padding: '0.4rem 0.85rem', borderRadius: '10px', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <RefreshCw size={14} className={dbStatsLoading ? 'spin' : ''} />
                {dbStatsLoading ? 'بروزرسانی...' : 'بروزرسانی آمار'}
              </button>
            </div>
          </div>

          {/* ⚖️ UNIFIED COMPREHENSIVE JIRA VS DATABASE COMPARISON TABLE */}
          <div style={{ marginTop: '0.5rem', marginBottom: '1.25rem' }}>
            <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                ⚖️ جدول جامع مقایسه زنده آمار و شاخص‌ها (سرور جیرا vs دیتابیس SQLite)
              </span>
              <button
                type="button"
                onClick={() => fetchJiraCount(true)}
                disabled={jiraCountLoading}
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38BDF8',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '9px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <RefreshCw size={13} className={jiraCountLoading ? 'spin' : ''} />
                {jiraCountLoading ? 'در حال دریافت از جیرا...' : '🔄 استخراج / بروزرسانی آمار زنده جیرا'}
              </button>
            </div>

            {jiraCountError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '10px',
                padding: '0.65rem 0.95rem',
                marginBottom: '0.75rem',
                color: '#FCA5A5',
                fontSize: '0.81rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={16} color="#EF4444" />
                  <span><strong>وضعیت اتصال جیرا:</strong> {jiraCountError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('connection')}
                  style={{ background: 'rgba(239, 68, 68, 0.25)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#FFFFFF', padding: '0.25rem 0.65rem', borderRadius: '7px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                >
                  ⚙️ تنظیمات اتصال جیرا
                </button>
              </div>
            )}

            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '14px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#94A3B8', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '0.65rem 0.9rem' }}>نوع داده / شاخص</th>
                    <th style={{ padding: '0.65rem 0.9rem', color: '#38BDF8' }}>
                      🌐 سرور جیرا (Jira Live {jiraCountData?.rebuildMonths ? `- ${jiraCountData.rebuildMonths} ماهه` : (cfg?.rebuildMonths ? `- ${cfg.rebuildMonths} ماهه` : '')})
                    </th>
                    <th style={{ padding: '0.65rem 0.9rem', color: '#C084FC' }}>💾 دیتابیس سیستم (SQLite)</th>
                    <th style={{ padding: '0.65rem 0.9rem', textAlign: 'center' }}>📊 وضعیت تطابق</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Tasks with epic */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 700, color: '#E2E8F0' }}>
                      ⚡ تسک‌های دارای اپیک
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#38BDF8' }}>
                      {jiraCountData?.withEpicCount !== undefined ? `${jiraCountData.withEpicCount.toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#C084FC' }}>
                      {dbStats?.totalTasks !== undefined ? `${Math.max(0, (dbStats.totalTasks || 0) - (dbStats.unlinkedTasksCount || 0)).toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', textAlign: 'center' }}>
                      {jiraCountData?.withEpicCount !== undefined && dbStats?.totalTasks !== undefined ? (
                        jiraCountData.withEpicCount === Math.max(0, (dbStats.totalTasks || 0) - (dbStats.unlinkedTasksCount || 0)) ? (
                          <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700 }}>✅ تطابق کامل</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openMismatchDiagnosticModal('withEpicTasks')}
                            style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.35))', border: '1px solid rgba(245, 158, 11, 0.6)', color: '#FBBF24', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                            title="برای مشاهده گرید تحلیل اختلافات تسک‌های دارای اپیک کلیک فرمایید"
                          >
                            <Search size={13} color="#FBBF24" />
                            <span>⚠️ اختلاف {Math.abs(jiraCountData.withEpicCount - Math.max(0, (dbStats.totalTasks || 0) - (dbStats.unlinkedTasksCount || 0)))}</span>
                          </button>
                        )
                      ) : '—'}
                    </td>
                  </tr>

                  {/* Row 2: Tasks without epic */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 700, color: '#E2E8F0' }}>
                      ⚠️ تسک‌های بدون اپیک
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#38BDF8' }}>
                      {jiraCountData?.withoutEpicCount !== undefined ? `${jiraCountData.withoutEpicCount.toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: (dbStats?.unlinkedTasksCount || 0) > 0 ? '#FCA5A5' : '#6EE7B7' }}>
                      {dbStats?.unlinkedTasksCount !== undefined ? `${(dbStats.unlinkedTasksCount || 0).toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', textAlign: 'center' }}>
                      {jiraCountData?.withoutEpicCount !== undefined && dbStats?.unlinkedTasksCount !== undefined ? (
                        jiraCountData.withoutEpicCount === (dbStats.unlinkedTasksCount || 0) ? (
                          <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700 }}>✅ تطابق کامل</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openMismatchDiagnosticModal('unlinkedTasks')}
                            style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.35))', border: '1px solid rgba(245, 158, 11, 0.6)', color: '#FBBF24', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                            title="برای مشاهده گرید تحلیل اختلافات تسک‌های بدون اپیک کلیک فرمایید"
                          >
                            <Search size={13} color="#FBBF24" />
                            <span>⚠️ اختلاف {Math.abs(jiraCountData.withoutEpicCount - (dbStats.unlinkedTasksCount || 0))}</span>
                          </button>
                        )
                      ) : '—'}
                    </td>
                  </tr>

                  {/* Row 3: Total Non-Epic Tasks */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#FFFFFF' }}>
                      📝 مجموع کل تسک‌های غیر‌اپیک
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#38BDF8', fontSize: '0.88rem' }}>
                      {jiraCountData?.total !== undefined ? `${jiraCountData.total.toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#C084FC', fontSize: '0.88rem' }}>
                      {dbStats?.totalTasks !== undefined ? `${dbStats.totalTasks.toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', textAlign: 'center' }}>
                      {jiraCountData?.total !== undefined && dbStats?.totalTasks !== undefined ? (
                        jiraCountData.total === dbStats.totalTasks ? (
                          <span style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#6EE7B7', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800 }}>✅ همگام کامل</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openMismatchDiagnosticModal('totalTasks')}
                            style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(220, 38, 38, 0.35))', border: '1px solid rgba(239, 68, 68, 0.6)', color: '#FCA5A5', padding: '0.2rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                            title="برای مشاهده گرید تحلیل اختلافات کلیک فرمایید"
                          >
                            <Search size={13} color="#FCA5A5" />
                            <span>⚠️ اختلاف {Math.abs(jiraCountData.total - dbStats.totalTasks)} تسک</span>
                          </button>
                        )
                      ) : '—'}
                    </td>
                  </tr>

                  {/* Row 4: Total Epics */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer', transition: 'background 0.2s ease' }} onClick={() => openMismatchDiagnosticModal('epics')} title="کلیک کنید برای مشاهده گرید تحلیل دقیق زنده اختلافات اپیک‌ها">
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 700, color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>📂 کل اپیک‌ها (پروژه‌ها)</span>
                      <span style={{ fontSize: '0.7rem', color: '#8B5CF6', background: 'rgba(139, 92, 246, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>🔍 مشاهده تحلیل</span>
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#38BDF8' }}>
                      {jiraCountData?.jiraEpicsCount !== undefined ? `${jiraCountData.jiraEpicsCount.toLocaleString()} اپیک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#C084FC' }}>
                      {dbStats?.totalProjects !== undefined ? `${(dbStats.totalProjects || 0).toLocaleString()} اپیک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', textAlign: 'center' }}>
                      {jiraCountData?.jiraEpicsCount !== undefined && dbStats?.totalProjects !== undefined ? (
                        jiraCountData.jiraEpicsCount === dbStats.totalProjects ? (
                          <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700 }}>✅ تطابق کامل</span>
                        ) : (
                          <span style={{ background: 'rgba(245, 158, 11, 0.25)', color: '#FBBF24', padding: '0.15rem 0.55rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800, boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)' }}>
                            ⚠️ اختلاف {Math.abs(jiraCountData.jiraEpicsCount - dbStats.totalProjects)} (مشاهده)
                          </span>
                        )
                      ) : '—'}
                    </td>
                  </tr>

                  {/* Row 5: Epics without tasks */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 700, color: '#E2E8F0' }}>
                      📁 اپیک‌های بدون تسک
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: (jiraCountData?.jiraEpicsWithoutTasksCount || 0) > 0 ? '#FBBF24' : '#38BDF8' }}>
                      {jiraCountData?.jiraEpicsWithoutTasksCount !== undefined ? `${jiraCountData.jiraEpicsWithoutTasksCount.toLocaleString()} اپیک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: (dbStats?.epicsWithoutTasksCount || 0) > 0 ? '#FBBF24' : '#6EE7B7' }}>
                      {dbStats?.epicsWithoutTasksCount !== undefined ? `${(dbStats.epicsWithoutTasksCount || 0).toLocaleString()} اپیک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', textAlign: 'center' }}>
                      {jiraCountData?.jiraEpicsWithoutTasksCount !== undefined && dbStats?.epicsWithoutTasksCount !== undefined ? (
                        jiraCountData.jiraEpicsWithoutTasksCount === dbStats.epicsWithoutTasksCount ? (
                          <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700 }}>✅ تطابق کامل</span>
                        ) : (
                          <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#FBBF24', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700 }}>
                            ⚠️ اختلاف {Math.abs(jiraCountData.jiraEpicsWithoutTasksCount - dbStats.epicsWithoutTasksCount)}
                          </span>
                        )
                      ) : '—'}
                    </td>
                  </tr>

                  {/* Row 6: Sprints */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 700, color: '#E2E8F0' }}>
                      🏃 اسپرینت‌های استخراج‌شده
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#38BDF8' }}>
                      {dbStats?.totalSprints !== undefined ? `${(dbStats.totalSprints || 0).toLocaleString()} اسپرینت` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#C084FC' }}>
                      {dbStats?.totalSprints !== undefined ? `${(dbStats.totalSprints || 0).toLocaleString()} اسپرینت` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', textAlign: 'center' }}>
                      <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700 }}>✅ ثبتی در دیتابیس</span>
                    </td>
                  </tr>

                  {/* Row 7: Components */}
                  <tr>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 700, color: '#E2E8F0' }}>
                      🏷️ کامپوننت‌های شناسایی‌شده
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#38BDF8' }}>
                      {dbStats?.totalComponents !== undefined ? `${(dbStats.totalComponents || 0).toLocaleString()} نوع` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#C084FC' }}>
                      {dbStats?.totalComponents !== undefined ? `${(dbStats.totalComponents || 0).toLocaleString()} نوع` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', textAlign: 'center' }}>
                      <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 700 }}>✅ ثبتی در دیتابیس</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 📁 TASKS PER JIRA PROJECT KEY */}
          {dbStats?.projectTaskCounts && dbStats.projectTaskCounts.length > 0 && (
            <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed rgba(255, 255, 255, 0.1)' }}>
              <div style={{ marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  📁 تعداد تسک‌های دیتابیس به تفکیک پروژه جیرا ({dbStats.projectTaskCounts.length} پروژه):
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {dbStats.projectTaskCounts.map(proj => (
                  <div key={proj.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: '12px',
                    padding: '0.6rem 1rem',
                  }}>
                    <span style={{
                      fontSize: '0.95rem', color: '#A78BFA', fontWeight: 800,
                      background: 'rgba(167,139,250,0.18)', padding: '0.2rem 0.7rem',
                      borderRadius: '8px', letterSpacing: '0.05em'
                    }}>{proj.id}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#C084FC', fontWeight: 700, background: 'rgba(192,132,252,0.12)', padding: '0.2rem 0.6rem', borderRadius: '7px', border: '1px solid rgba(192,132,252,0.3)' }}>
                        ⚡ {proj.epicCount || 0} اپیک
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                        <strong style={{ fontSize: '1.25rem', color: proj.taskCount > 0 ? '#818CF8' : '#475569', fontWeight: 800 }}>
                          {proj.taskCount.toLocaleString()}
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>تسک</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── BATCH SYNC RESULTS REPORT (INSIDE TAB 1) ── */}
        {monthlyResults && (
          <motion.div className="glass-card jsp-diag-card" style={{ borderColor: 'rgba(139, 92, 246, 0.4)', background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.4), rgba(15, 23, 42, 0.85))', marginBottom: '1.5rem' }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="jsp-diag-header">
              <div>
                <h2 style={{ color: '#C084FC', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Calendar size={22} /> گزارش تفکیکی همگام‌سازی داده‌های Jira
                </h2>
                <p className="jsp-diag-sub" style={{ marginTop: '0.45rem' }}>
                  تعداد کل تسک‌های دریافت‌شده: <strong style={{ color: '#38BDF8', fontSize: '1.05rem' }}>{monthlyResults.totalTasksSynced || 0} تسک</strong> | تعداد بازه/ماه بررسی‌شده: <strong>{monthlyResults.monthlyResults?.length || 0} بازه</strong>
                </p>
              </div>
              <button className="jsp-delete-row" style={{ color: '#A78BFA', cursor: 'pointer' }} onClick={() => { setMonthlyResults(null); setJiraTotalCount(null); }} title="بستن این گزارش">
                <X size={20} />
              </button>
            </div>

            {/* ── JIRA vs DB COMPARISON BAR ── */}
            <div style={{
              margin: '0.4rem 0 0.25rem',
              background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,27,75,0.85))',
              border: '1px solid rgba(139,92,246,0.35)',
              borderRadius: '10px',
              padding: '0.45rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              {/* Synced from this run */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>📥 تسک‌های سینک‌شده (این عملیات)</span>
                <strong style={{ fontSize: '1.2rem', color: '#38BDF8', fontWeight: 800, lineHeight: 1 }}>{(monthlyResults.totalTasksSynced || 0).toLocaleString()}</strong>
                <span style={{ fontSize: '0.68rem', color: '#64748B' }}>تسک</span>
              </div>

              <div style={{ fontSize: '1.4rem', color: '#475569', fontWeight: 300 }}>vs</div>

              {/* Jira total COUNT */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>🔢 کل جیرا ({cfg.rebuildMonths || 3} ماه گذشته)</span>
                {jiraCountLoading ? (
                  <span style={{ fontSize: '0.85rem', color: '#A78BFA' }}>⏳ در حال دریافت...</span>
                ) : jiraCountData ? (
                  <strong style={{ fontSize: '1.2rem', color: '#C084FC', fontWeight: 800, lineHeight: 1 }}>{jiraCountData.total.toLocaleString()}</strong>
                ) : (
                  <button onClick={() => fetchJiraCount(true)} style={{ background: 'rgba(192,132,252,0.15)', border: '1px solid rgba(192,132,252,0.4)', color: '#C084FC', borderRadius: '8px', padding: '0.3rem 0.7rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}>
                    🔄 دریافت آمار زنده جیرا
                  </button>
                )}
                <span style={{ fontSize: '0.68rem', color: '#64748B' }}>تسک</span>
              </div>

              <div style={{ fontSize: '1.4rem', color: '#475569', fontWeight: 300 }}>=</div>

              {/* Difference */}
              {jiraCountData && (() => {
                const diff = jiraCountData.total - (monthlyResults.totalTasksSynced || 0);
                const isOk = diff === 0;
                const isNeg = diff < 0;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>⚠️ اختلاف</span>
                    <strong style={{ fontSize: '1.2rem', color: isOk ? '#10B981' : isNeg ? '#F59E0B' : '#EF4444', fontWeight: 800, lineHeight: 1 }}>
                      {diff >= 0 ? '+' : ''}{diff.toLocaleString()}
                    </strong>
                    <span style={{ fontSize: '0.68rem', color: isOk ? '#6EE7B7' : '#94A3B8' }}>{isOk ? '✅ برابر' : isNeg ? 'بیشتر از جیرا سینک شده' : 'تسک سینک‌نشده'}</span>
                  </div>
                );
              })()}

              {/* COUNT JQL label */}
              {jiraCountData?.jql && (
                <div style={{ width: '100%', marginTop: '0.15rem', paddingTop: '0.6rem', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  <code style={{ fontSize: '0.67rem', color: '#475569', wordBreak: 'break-all', fontFamily: 'monospace', display: 'block' }}>
                    🔍 COUNT JQL: {jiraCountData.jql}
                  </code>
                </div>
              )}
            </div>

            <div ref={syncLogsWrapperRef} className="jsp-diag-table-wrapper" style={{ marginTop: '0.4rem', maxHeight: '115px', overflowY: 'auto', scrollBehavior: 'smooth', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
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
                        <code className="diag-val-code accent" style={{ fontSize: '0.78rem', color: m.status === 'error' ? '#FCA5A5' : '#38BDF8', wordBreak: 'break-all', display: 'inline-block', padding: '0.2rem 0.5rem', background: m.status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.1)', border: m.status === 'error' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px' }} title={m.jql || m.message}>
                          {m.jql || 'مشخص نشده'}
                        </code>
                        {m.status === 'error' && m.message && (
                          <div style={{ fontSize: '0.72rem', color: '#FCA5A5', marginTop: '0.25rem' }}>{m.message}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

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
          <Field label="وضعیت دیتابیس و مدیریت داده‌ها" hint="مدیریت پاکسازی و بازسازی فایل database.sqlite">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.3rem', flexWrap: 'wrap' }}>
              <span className="diag-status-pill matched">✅ متصل و فعال</span>
              <button 
                type="button"
                className="jsp-add-mapping-btn" 
                style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.45)', color: '#FCA5A5' }}
                onClick={() => {
                  setConfirmModal({
                    title: '🗑️ پاکسازی کامل دیتابیس',
                    icon: '⚠️',
                    type: 'danger',
                    description: 'آیا مطمئن هستید که می‌خواهید دیتابیس را کاملاً خالی کنید؟ تمامی تسک‌ها و داده‌های قبلی حذف خواهند شد تا امکان سینک مجدد فراهم شود.',
                    confirmText: '🗑️ بله، دیتابیس خالی شود',
                    cancelText: 'انصراف',
                    onConfirm: async () => {
                      try {
                        showToast('در حال پاکسازی دیتابیس...');
                        const res = await api.clearDatabase();
                        showToast(res.message || 'دیتابیس کاملاً خالی شد.', 'success');
                        fetchDbStats();
                        fetchJiraCount(false);
                      } catch (e) {
                        showToast('خطا در پاکسازی دیتابیس', 'error');
                      }
                    }
                  });
                }}
              >
                🗑️ خالی کردن کامل دیتابیس (حذف تمام تسک‌ها)
              </button>
              <button 
                type="button"
                className="jsp-add-mapping-btn" 
                style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#38BDF8' }}
                onClick={() => {
                  setConfirmModal({
                    title: '🔄 همگام‌سازی و بازسازی دیتابیس از Jira',
                    icon: '🌐',
                    type: 'info',
                    description: 'آیا مایلید تمام داده‌های دیتابیس بر اساس داده‌های ۱۰۰٪ زنده سرور Jira بازنشانی شوند؟',
                    confirmText: '⚡ بله، همگام‌سازی انجام شود',
                    cancelText: 'انصراف',
                    onConfirm: async () => {
                      try {
                        showToast('در حال همگام‌سازی و بازسازی دیتابیس از Jira...');
                        const res = await api.resetDatabase();
                        showToast(res.message || 'دیتابیس با داده‌های زنده جیرا همگام شد.', 'success');
                        fetchDbStats();
                        fetchJiraCount(false);
                      } catch (e) {
                        showToast('خطا در بازسازی دیتابیس', 'error');
                      }
                    }
                  });
                }}
              >
                🔄 همگام‌سازی و بازسازی دیتابیس از Jira
              </button>
            </div>
          </Field>
        </div>
      </Section>
              </motion.div>
            )}

            {activeTab === 'connection' && (
              <motion.div key="connection" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
<Section defaultOpen={true} icon={Server} title="اتصال به Jira Cloud / Server (Connection Settings)" color="#38BDF8">
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

<Section defaultOpen={true} icon={Cpu} title="نسخه و مسیرهای API جیرا (API Version & Custom Endpoints)" color="#6366F1">
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

<Section icon={GitBranch} title="اتصال به Confluence (مستندات)" color="#A78BFA" defaultOpen={true}>
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
              </motion.div>
            )}

            {activeTab === 'mapping' && (
              <motion.div key="motion_mapping" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
<Section defaultOpen={true} icon={Cpu} title="فیلدهای کاستوم Jira (Custom Fields Mapping)" color="#EC4899">
        <p className="jsp-section-desc">شماره کاستوم‌فیلدهای اختصاصی جیرای سازمان را وارد کنید. پس از اجرای پایش زنده، شناسه‌های دقیق نمایش داده می‌شوند.</p>
        <div className="jsp-grid-2">
          <Field label="فیلد لینک به اپیک (Epic Link)" hint="شناسه فیلد ارتباط تسک با اپیک در جیرای شما (customfield_10006)">
            <Input value={cfg.customFields?.epicLinkField || 'customfield_10006'} onChange={v => set('customFields', 'epicLinkField', v)} placeholder="customfield_10006" mono />
          </Field>
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

<Section defaultOpen={true} icon={Tag} title="نگاشت وضعیت‌های Jira به داشبورد (Status Mapping)" color="#10B981">
        <p className="jsp-section-desc">هر وضعیت اصلی جیرا را به وضعیت داشبورد نگاشت کنید. وضعیت‌های داشبورد: Done، In Progress، Waiting، To Do</p>
        <StatusMappingEditor
          mapping={cfg.statusMapping || {}}
          onChange={v => setCfg(prev => ({ ...prev, statusMapping: v }))}
        />
      </Section>

<Section defaultOpen={true} icon={AlertTriangle} title="وضعیت‌های «منتظر» (Waiting Status List)" color="#FBBF24">
        <p className="jsp-section-desc">وضعیت‌های جیرا که باید به‌عنوان «منتظر تیم‌های دیگر» شناسایی شوند. هر وضعیت را وارد کرده و Enter بزنید.</p>
        <TagList
          items={cfg.waitingStatuses || []}
          onChange={v => setCfg(prev => ({ ...prev, waitingStatuses: v }))}
          placeholder="OnHolding، Waiting، Blocked..."
        />
      </Section>

<Section icon={Calendar} title="نگاشت فیلدهای تاریخ (Date Field Mapping)" color="#06B6D4" defaultOpen={true}>
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

<Section icon={Tag} title="پیشوندهای لیبل‌های جیرا (Label Prefixes)" color="#F97316" defaultOpen={true}>
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

<Section icon={Cpu} title="کامپوننت‌های برجسته داشبورد (Featured Components)" color="#8B5CF6" defaultOpen={true}>
        <p className="jsp-section-desc">کامپوننت‌هایی که به‌عنوان دکمه فیلتر سریع در صفحه داشبورد نمایش داده می‌شوند.</p>
        <TagList
          items={cfg.featuredComponents || []}
          onChange={v => setCfg(prev => ({ ...prev, featuredComponents: v }))}
          placeholder="learning، meeting، support..."
        />
      </Section>
              </motion.div>
            )}
          </AnimatePresence>
      {/* 🔍 MISMATCH DIAGNOSTIC GRID MODAL */}
      <AnimatePresence>
        {mismatchModalData && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(11, 15, 25, 0.85)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.5rem',
            direction: 'rtl'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 25 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 25 }}
              style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.97), rgba(15, 23, 42, 0.99))',
                border: '1px solid rgba(139, 92, 246, 0.45)',
                boxShadow: '0 25px 70px -15px rgba(139, 92, 246, 0.3), 0 0 50px rgba(0, 0, 0, 0.8)',
                borderRadius: '24px',
                padding: '1.75rem',
                maxWidth: '960px',
                width: '100%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                color: '#F8FAFC',
                direction: 'rtl'
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: 'rgba(139, 92, 246, 0.2)', border: '1px solid #8B5CF6', width: '44px', height: '44px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A78BFA', fontSize: '1.3rem' }}>
                    🔍
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#F8FAFC' }}>
                      گرید پایش زنده و تحلیل ریشه اختلافات ({mismatchModalData.category === 'epics' ? 'اپیک‌ها / پروژه‌ها' : 'تسک‌های سیستم'})
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: '#A78BFA', fontWeight: 700 }}>
                      تعداد کل بررسی‌شده: {mismatchModalData.totalCount} | موارد دارای اختلاف: {mismatchModalData.mismatchCount} موارد
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setMismatchModalData(null)}
                  style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#94A3B8', borderRadius: '10px', padding: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Filter / Search Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.3rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    onClick={() => setMismatchTab('mismatched')}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: mismatchTab === 'mismatched' ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'transparent',
                      color: mismatchTab === 'mismatched' ? '#FFFFFF' : '#94A3B8',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    ⚠️ فقط دارای اختلاف ({mismatchModalData.mismatchCount || 0})
                  </button>
                  <button
                    onClick={() => setMismatchTab('all')}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: mismatchTab === 'all' ? 'linear-gradient(135deg, #8B5CF6, #6D28D9)' : 'transparent',
                      color: mismatchTab === 'all' ? '#FFFFFF' : '#94A3B8',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    📋 همه موارد ({mismatchModalData.totalCount || 0})
                  </button>
                </div>

                <input
                  type="text"
                  value={mismatchSearch}
                  onChange={e => setMismatchSearch(e.target.value)}
                  placeholder="🔍 جستجو بر اساس کلید (مثال: ORD-105 یا ORD)..."
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    color: '#F8FAFC',
                    borderRadius: '10px',
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.82rem',
                    minWidth: '260px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Grid Table */}
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.5)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#1E293B', color: '#F1F5F9', borderBottom: '2px solid rgba(139, 92, 246, 0.4)', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)' }}>
                      <th style={{ padding: '0.8rem 1rem', width: '110px', background: '#1E293B', color: '#38BDF8', fontWeight: 800 }}>شناسه کلید</th>
                      <th style={{ padding: '0.8rem 1rem', background: '#1E293B', color: '#F1F5F9', fontWeight: 800 }}>عنوان / نام اصلی</th>
                      <th style={{ padding: '0.8rem 1rem', width: '130px', background: '#1E293B', color: '#C084FC', fontWeight: 800 }}>وضعیت در دیتابیس</th>
                      <th style={{ padding: '0.8rem 1rem', width: '140px', background: '#1E293B', color: '#38BDF8', fontWeight: 800 }}>وضعیت زنده در Jira</th>
                      <th style={{ padding: '0.8rem 1rem', background: '#1E293B', color: '#F1F5F9', fontWeight: 800 }}>علت و توضیحات تحلیل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const list = (mismatchModalData.allItems || []).filter(item => {
                        if (mismatchTab === 'mismatched' && item.mismatchType === 'MATCHED') return false;
                        if (mismatchSearch.trim()) {
                          const q = mismatchSearch.trim().toLowerCase();
                          const matchId = (item.id || '').toLowerCase().includes(q);
                          const matchTitle = (item.title || '').toLowerCase().includes(q);
                          const matchReason = (item.reason || '').toLowerCase().includes(q);
                          if (!matchId && !matchTitle && !matchReason) return false;
                        }
                        return true;
                      });

                      if (list.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
                              هیچ موردی مطابق فیلتر انتخابی یافت نشد.
                            </td>
                          </tr>
                        );
                      }

                      return list.map((item, idx) => (
                        <tr key={item.id || idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', background: item.mismatchType !== 'MATCHED' ? 'rgba(245, 158, 11, 0.04)' : 'transparent' }}>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 800, color: '#38BDF8' }}>
                            {item.id}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#E2E8F0' }}>
                            {item.title}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: item.inDb ? 'rgba(192, 132, 252, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: item.inDb ? '#C084FC' : '#FCA5A5'
                            }}>
                              {item.dbStatus}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              background: item.inJira ? 'rgba(56, 189, 248, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: item.inJira ? '#38BDF8' : '#FCA5A5'
                            }}>
                              {item.jiraStatus}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.78rem', color: item.mismatchType === 'MATCHED' ? '#6EE7B7' : '#FBBF24', lineHeight: '1.5' }}>
                            {item.reason}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                  💡 جهت تطبیق کامل دیتابیس با سرور جیرا، می‌توانید دکمه <strong>«همگام‌سازی و بازسازی دیتابیس از Jira»</strong> را کلیک کنید.
                </span>
                <button
                  onClick={() => setMismatchModalData(null)}
                  style={{
                    padding: '0.55rem 1.4rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  متوجه شدم (بستن)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🔮 CUSTOM MODERN CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(11, 15, 25, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.5rem',
            direction: 'rtl'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.98))',
                border: confirmModal.type === 'danger' ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid rgba(245, 158, 11, 0.45)',
                boxShadow: confirmModal.type === 'danger'
                  ? '0 25px 60px -15px rgba(239, 68, 68, 0.3), 0 0 40px rgba(0, 0, 0, 0.7)'
                  : '0 25px 60px -15px rgba(245, 158, 11, 0.3), 0 0 40px rgba(0, 0, 0, 0.7)',
                borderRadius: '24px',
                padding: '2rem',
                maxWidth: '540px',
                width: '100%',
                color: '#F8FAFC',
                direction: 'rtl'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '16px',
                  background: confirmModal.type === 'danger' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  border: confirmModal.type === 'danger' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(245, 158, 11, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.6rem'
                }}>
                  {confirmModal.icon || '⚠️'}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#F8FAFC' }}>
                    {confirmModal.title}
                  </h3>
                  {confirmModal.badge && (
                    <span style={{ fontSize: '0.78rem', color: '#FBBF24', fontWeight: 700, marginTop: '0.2rem', display: 'inline-block' }}>
                      📌 بازه زمانی: {confirmModal.badge}
                    </span>
                  )}
                </div>
              </div>

              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '1.1rem 1.25rem',
                fontSize: '0.86rem',
                lineHeight: '1.7',
                color: '#CBD5E1',
                marginBottom: '1.75rem'
              }}>
                {confirmModal.description}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  style={{
                    padding: '0.65rem 1.4rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: '#94A3B8',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {confirmModal.cancelText || 'انصراف'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const action = confirmModal.onConfirm;
                    setConfirmModal(null);
                    if (action) action();
                  }}
                  style={{
                    padding: '0.65rem 1.6rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: confirmModal.type === 'danger'
                      ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                      : 'linear-gradient(135deg, #F59E0B, #D97706)',
                    boxShadow: confirmModal.type === 'danger'
                      ? '0 8px 20px -4px rgba(239, 68, 68, 0.4)'
                      : '0 8px 20px -4px rgba(245, 158, 11, 0.4)',
                    color: '#FFFFFF',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {confirmModal.confirmText || 'تأیید و ادامه'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default JiraSettingsPage;
