import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Server, Cpu, GitBranch, Tag, Calendar,
  RefreshCw, Save, CheckCircle2, AlertTriangle, X,
  ChevronDown, ChevronUp, Info, Eye, EyeOff, Zap, Database, Search, Trash2,
  FlaskConical, Play, CheckCircle, XCircle, Clock, Terminal, Pause, Download, FileText, Lock
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
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
  const { user } = useAuth();
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const isAdmin = user?.role === 'admin' || user?.username === 'admin';
  const hasPerm = (key) => isAdmin || perms.includes(key);

  const canRebuildDb = hasPerm('db_rebuild');
  const canSyncRange = hasPerm('jira_sync_range');
  const canViewDiag = hasPerm('jira_diagnostics');
  const canConfigJira = hasPerm('jira_config');
  const canMapping = hasPerm('jira_mapping');
  const canSystemTests = hasPerm('system_tests');
  const canSystemLogs = hasPerm('system_logs');

  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    if (isAdmin || canViewDiag) return 'database';
    if (canConfigJira) return 'connection';
    if (canMapping) return 'mapping';
    if (canSystemTests) return 'system_tests';
    if (canSystemLogs) return 'system_logs';
    return 'mapping';
  });
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

  // 🔄 Unified Single-Modal Sync Flow State (Database Rebuild & Date Range Extraction)
  const [syncFlowModal, setSyncFlowModal] = useState({
    isOpen: false,
    type: 'rebuild', // 'rebuild' | 'range'
    phase: 'confirm', // 'confirm' | 'picker' | 'running' | 'completed' | 'error'
    title: '',
    badge: '',
    description: '',
    stepNum: 0,
    totalSteps: 0,
    progressPercent: 0,
    currentMonthLabel: '',
    dateRange: '',
    totalTasksSoFar: 0,
    results: [],
    error: null
  });

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

  const [liveMappingData, setLiveMappingData] = useState(null);
  const [liveMappingLoading, setLiveMappingLoading] = useState(false);
  const [liveMappingSubTab, setLiveMappingSubTab] = useState('errors');
  const [systemTestsResult, setSystemTestsResult] = useState(null);
  const [systemTestsLoading, setSystemTestsLoading] = useState(false);

  // ⏰ Dynamic Automated Jira Sync Scheduler State
  const [schedulerConfig, setSchedulerConfig] = useState(null);
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [schedulerForm, setSchedulerForm] = useState({
    enabled: true,
    mode: 'daily',
    time: '02:00',
    interval_hours: 1,
    timeframe_months: 6,
    sync_type: 'timeframe'
  });
  const [schedulerSaving, setSchedulerSaving] = useState(false);
  const [schedulerRunLoading, setSchedulerRunLoading] = useState(false);

  // 📜 Backend Logs State & Handlers
  const [systemLogs, setSystemLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsLiveStream, setLogsLiveStream] = useState(true);
  const [logsStreamStatus, setLogsStreamStatus] = useState('connecting'); // 'connected' | 'connecting' | 'paused' | 'error'
  const [logsLevelFilters, setLogsLevelFilters] = useState(['ALL']);
  const [logsSearchTerm, setLogsSearchTerm] = useState('');
  const [logsAutoScroll, setLogsAutoScroll] = useState(true);
  const logsContainerRef = useRef(null);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const toggleLogsLevelFilter = (lvlKey) => {
    if (lvlKey === 'ALL') {
      setLogsLevelFilters(['ALL']);
      return;
    }

    setLogsLevelFilters(prev => {
      const prevWithoutAll = prev.filter(k => k !== 'ALL');
      let next;
      if (prevWithoutAll.includes(lvlKey)) {
        next = prevWithoutAll.filter(k => k !== lvlKey);
      } else {
        next = [...prevWithoutAll, lvlKey];
      }

      if (next.length === 0) {
        return ['ALL'];
      }
      return next;
    });
  };

  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const res = await api.getBackendLogs({ limit: 1000 });
      if (res && res.logs) {
        setSystemLogs(res.logs);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const handleClearLogs = async () => {
    try {
      showToast('در حال پاک‌سازی لاگ‌ها...', 'info');
      await api.clearBackendLogs();
      setSystemLogs([]);
      showToast('✅ لاگ‌های سیستم با موفقیت پاک‌سازی شدند.', 'success');
    } catch (err) {
      showToast('خطا در پاک‌سازی لاگ‌ها: ' + err.message, 'error');
    }
  };

  const handleDownloadLogs = () => {
    const textContent = systemLogs.map(l => `[${l.timestamp}] [${l.level}] [${l.tag || 'SYSTEM'}] ${l.message}${l.stack ? '\n' + l.stack : ''}`).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backend-logs-${new Date().toISOString().split('T')[0]}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 📡 Live SSE Stream with Auth Token & Automatic Fallback Polling
  useEffect(() => {
    if (activeTab !== 'system_logs') return;

    if (!logsLiveStream) {
      setLogsStreamStatus('paused');
      return;
    }

    // Initial fetch to load all current logs
    fetchLogs();

    setLogsStreamStatus('connecting');
    let eventSource = null;
    let fallbackPollTimer = null;

    try {
      const streamUrl = api.getLogsStreamUrl();
      eventSource = new EventSource(streamUrl);

      eventSource.onopen = () => {
        setLogsStreamStatus('connected');
      };

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'INIT' && Array.isArray(data.logs)) {
            setSystemLogs(data.logs);
            setLogsStreamStatus('connected');
          } else if (data.id && data.message) {
            setLogsStreamStatus('connected');
            setSystemLogs(prev => {
              if (prev.some(l => l.id === data.id)) return prev;
              return [...prev.slice(-2000), data];
            });
          }
        } catch (_) {}
      };

      eventSource.onerror = () => {
        setLogsStreamStatus('connecting');
        // If SSE has any temporary hiccup, start smooth polling fallback
        if (!fallbackPollTimer) {
          fallbackPollTimer = setInterval(fetchLogs, 4000);
        }
      };
    } catch (_) {
      setLogsStreamStatus('error');
      fallbackPollTimer = setInterval(fetchLogs, 4000);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackPollTimer) {
        clearInterval(fallbackPollTimer);
      }
    };
  }, [activeTab, logsLiveStream, fetchLogs]);

  // 📜 Instant Auto-scroll on new log entries
  useEffect(() => {
    if (activeTab === 'system_logs' && logsAutoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [systemLogs, activeTab, logsAutoScroll]);

  const handleRunSystemTests = async () => {
    try {
      setSystemTestsLoading(true);
      showToast('🧪 در حال اجرای آزمون‌های خودکار سیستم...');
      const res = await api.runSystemTests();
      if (res && res.success) {
        setSystemTestsResult(res);
        if (res.numFailedTests === 0) {
          showToast(`✅ تمامی ${res.numPassedTests} آزمون با موفقیت پاس شدند! (${res.durationSeconds}s)`, 'success');
        } else {
          showToast(`⚠️ ${res.numPassedTests} موفق، ${res.numFailedTests} ناموفق`, 'warning');
        }
      } else {
        showToast('خطا در اجرای آزمون‌ها', 'error');
      }
    } catch (e) {
      showToast('خطا در اجرای آزمون‌های سیستم: ' + e.message, 'error');
    } finally {
      setSystemTestsLoading(false);
    }
  };

  const fetchLiveMappingInspector = async () => {
    try {
      setLiveMappingLoading(true);
      const months = parseInt(cfg?.rebuildMonths, 10) || 3;
      const res = await api.getLiveMappingInspector(months);
      setLiveMappingData(res);
    } catch (e) {
      console.error('Failed to fetch live mapping inspector:', e);
    } finally {
      setLiveMappingLoading(false);
    }
  };

  const [syncingMissing, setSyncingMissing] = useState(false);
  const [syncingKey, setSyncingKey] = useState(null);
  const [deletingDbOnly, setDeletingDbOnly] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);

  const handleDeleteSingleKey = async (key) => {
    if (!key) return;
    try {
      setDeletingKey(key);
      showToast(`🗑️ در حال حذف تسک ${key} از دیتابیس لوکال...`);
      const res = await api.deleteDbOnlyTasks({ keys: [key], category: mismatchModalData?.category });
      showToast(res.message || `مورد ${key} از دیتابیس لوکال حذف شد.`, 'success');
      const months = parseInt(cfg?.rebuildMonths, 10) || 3;
      await fetchDbStats(months);
      await fetchJiraCount();
      const freshMismatch = await api.getMismatchDetails(mismatchModalData?.category || 'totalTasks', months);
      setMismatchModalData(freshMismatch);
    } catch (e) {
      showToast(`خطا در حذف ${key}: ` + e.message, 'error');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeleteDbOnlyTasks = async () => {
    try {
      setDeletingDbOnly(true);
      const dbOnlyKeys = (mismatchModalData?.mismatches || []).filter(i => i.mismatchType === 'DB_ONLY').map(i => i.id).filter(Boolean);
      if (dbOnlyKeys.length === 0) {
        showToast('هیچ تسک اضافی در دیتابیس برای حذف وجود ندارد.', 'info');
        return;
      }
      showToast(`🗑️ در حال حذف ${dbOnlyKeys.length} مورد اضافی از دیتابیس لوکال...`);
      const res = await api.deleteDbOnlyTasks({ keys: dbOnlyKeys, category: mismatchModalData?.category });
      showToast(res.message || 'موارد اضافی با موفقیت از دیتابیس حذف شدند.', 'success');
      const months = parseInt(cfg?.rebuildMonths, 10) || 3;
      await fetchDbStats(months);
      await fetchJiraCount();
      const freshMismatch = await api.getMismatchDetails(mismatchModalData?.category || 'totalTasks', months);
      setMismatchModalData(freshMismatch);
    } catch (e) {
      showToast('خطا در حذف موارد اضافی: ' + e.message, 'error');
    } finally {
      setDeletingDbOnly(false);
    }
  };

  const handleSyncSingleKey = async (key) => {
    if (!key) return;
    try {
      setSyncingKey(key);
      showToast(`⚡ در حال استخراج و ذخیره مستقیم تسک ${key} از Jira...`);
      const res = await api.syncMissingTasks({ keys: [key] });
      showToast(res.message || `تسک ${key} با موفقیت در دیتابیس ذخیره شد.`, 'success');
      const months = parseInt(cfg?.rebuildMonths, 10) || 3;
      await fetchDbStats(months);
      await fetchJiraCount();
      const freshMismatch = await api.getMismatchDetails(mismatchModalData?.category || 'totalTasks', months);
      setMismatchModalData(freshMismatch);
    } catch (e) {
      showToast(`خطا در ذخیره تسک ${key}: ` + e.message, 'error');
    } finally {
      setSyncingKey(null);
    }
  };

  const handleSyncMissingTasks = async () => {
    try {
      setSyncingMissing(true);
      const months = parseInt(cfg?.rebuildMonths, 10) || 3;
      const missingKeys = (mismatchModalData?.missingKeys && mismatchModalData.missingKeys.length > 0)
        ? mismatchModalData.missingKeys
        : (mismatchModalData?.mismatches || []).filter(i => i.mismatchType === 'JIRA_ONLY').map(i => i.id).filter(Boolean);

      if (missingKeys.length === 0) {
        showToast('هیچ تسک جامانده‌ای برای ذخیره در دیتابیس وجود ندارد.', 'info');
        return;
      }

      showToast(`⚡ در حال استخراج و ذخیره مستقیم ${missingKeys.length} تسک اختلاف از Jira...`);
      const res = await api.syncMissingTasks({ months, keys: missingKeys });
      showToast(res.message || 'تسک‌های اختلاف با موفقیت در دیتابیس ذخیره شدند.', 'success');
      await fetchDbStats(months);
      await fetchJiraCount();
      const freshMismatch = await api.getMismatchDetails(mismatchModalData?.category || 'totalTasks', months);
      setMismatchModalData(freshMismatch);
    } catch (e) {
      showToast('خطا در ذخیره تسک‌های اختلاف: ' + e.message, 'error');
    } finally {
      setSyncingMissing(false);
    }
  };

  const openMismatchDiagnosticModal = async (category = 'totalTasks') => {
    try {
      setMismatchLoading(true);
      showToast(`🔍 در حال استخراج و تحلیل زنده موارد اختلاف بر اساس کوئری‌های جدول...`);
      const months = parseInt(cfg?.rebuildMonths, 10) || 3;
      const res = await api.getMismatchDetails(category, months);
      setMismatchModalData(res);
      setMismatchSearch('');
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

  const [syncReportData, setSyncReportData] = useState(null);
  const [matchEvaluated, setMatchEvaluated] = useState(false);
  const [evaluatingMatch, setEvaluatingMatch] = useState(false);

  const fetchSyncReport = useCallback(async () => {
    try {
      const res = await api.getLastSyncReport();
      if (res && res.success && res.report) {
        setSyncReportData(res.report);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchSyncReport();
  }, [fetchSyncReport]);

  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  const fetchJiraCount = useCallback(async (isManualTrigger = false, customMonths = null) => {
    try {
      setJiraCountLoading(true);
      setJiraCountError(null);
      setJiraCountData(null);
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
    } catch (e) {
      console.error('Failed to fetch DB stats:', e);
    } finally {
      setDbStatsLoading(false);
    }
  }, []);

  const fetchBothStatsSync = useCallback(async (customMonths = null, isManualJira = false) => {
    const targetMonths = customMonths || cfgRef.current?.rebuildMonths || 3;
    await Promise.all([
      fetchDbStats(targetMonths),
      fetchJiraCount(isManualJira, targetMonths)
    ]);
  }, [fetchDbStats, fetchJiraCount]);

  const handleEvaluateAndMatch = () => {
    setMatchEvaluated(true);
    showToast('✅ وضعیت تطابق بر اساس مقادیر فعلی ستون جیرا و دیتابیس با موفقیت محاسبه گردید.', 'success');
  };

  const fetchSchedulerConfig = useCallback(async () => {
    try {
      const res = await api.getSchedulerConfig().catch(() => null);
      if (res && res.success && res.config) {
        setSchedulerConfig(res.config);
        setSchedulerForm({
          enabled: res.config.enabled !== false,
          mode: res.config.mode || 'daily',
          time: res.config.time || '02:00',
          interval_hours: res.config.interval_hours || 1,
          timeframe_months: res.config.timeframe_months || 6,
          sync_type: res.config.sync_type || 'timeframe'
        });
      }
    } catch (e) {
      console.error('Failed to fetch scheduler config:', e);
    }
  }, []);

  const handleOpenSchedulerModal = () => {
    fetchSchedulerConfig();
    setShowSchedulerModal(true);
  };

  const handleSaveScheduler = async (e) => {
    if (e) e.preventDefault();
    try {
      setSchedulerSaving(true);
      const res = await api.saveSchedulerConfig(schedulerForm);
      if (res && res.success) {
        setSchedulerConfig(res.config);
        showToast(res.message || 'تنظیمات زمان‌بندی خودکار با موفقیت ذخیره شد.', 'success');
        setShowSchedulerModal(false);
      } else {
        showToast(res?.message || 'خطا در ذخیره تنظیمات زمان‌بندی', 'error');
      }
    } catch (e) {
      showToast('خطا در ذخیره تنظیمات زمان‌بندی: ' + e.message, 'error');
    } finally {
      setSchedulerSaving(false);
    }
  };

  const handleRunSchedulerNow = async () => {
    try {
      setSchedulerRunLoading(true);
      const res = await api.runSchedulerNow();
      if (res && res.success) {
        showToast(res.message || 'همگام‌سازی زمان‌بندی‌شده آغاز گردید.', 'success');
        setTimeout(() => fetchSchedulerConfig(), 3000);
      } else {
        showToast(res?.message || 'خطا در آغاز همگام‌سازی', 'error');
      }
    } catch (e) {
      showToast('خطا در اجرای همگام‌سازی: ' + e.message, 'error');
    } finally {
      setSchedulerRunLoading(false);
    }
  };

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getJiraConfig();
      setCfg(data);
      const m = data?.rebuildMonths || 3;
      fetchDbStats(m);
      fetchSchedulerConfig();
    } catch (e) {
      showToast('خطا در دریافت تنظیمات جیرا: ' + (e.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchDbStats, fetchSchedulerConfig]);

  useEffect(() => { fetchConfig(); }, []);

  const handleSelectRebuildMonths = (months) => {
    const validMonths = Math.max(1, parseInt(months, 10) || 3);
    setCfg(prev => ({ ...prev, rebuildMonths: validMonths }));
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

  // 🔄 UNIFIED STEP-BY-STEP SYNC ENGINE (Rebuild, Range & Monthly)
  const executeFlowStepByStep = async (monthRanges, titlePrefix) => {
    let totalTasksSynced = 0;
    const results = [];

    try {
      await api.saveJiraConfig(cfg);
    } catch (_) {}

    // STEP 0: Sync all Epics first with immediate real-time progress update
    setSyncFlowModal(prev => ({
      ...prev,
      stepNum: 0,
      totalSteps: monthRanges.length,
      progressPercent: 5,
      currentMonthLabel: 'دریافت و ذخیره اپیک‌های پروژه‌ها از سرور جیرا...',
      dateRange: 'تمامی اپیک‌های فعال',
      totalTasksSoFar: 0
    }));

    try {
      const epicRes = await api.syncEpics();
      if (epicRes && epicRes.epicCount !== undefined) {
        results.push({
          monthIndex: 0,
          monthLabel: 'اپیک‌های پروژه',
          jalaliName: `اپیک‌های پروژه‌ها (${epicRes.epicCount} اپیک)`,
          gregorianName: 'Jira Epics',
          dateRange: 'تمامی پروژه‌ها',
          status: 'success',
          taskCount: epicRes.epicCount,
          jql: 'issuetype = Epic',
          message: `همگام‌سازی ${epicRes.epicCount} اپیک با موفقیت انجام شد.`
        });
      }
    } catch (e) {
      console.warn('Epics sync warning:', e.message);
    }

    setSyncFlowModal(prev => ({
      ...prev,
      progressPercent: 10,
      results: [...results]
    }));

    for (let i = 0; i < monthRanges.length; i++) {
      const mRange = monthRanges[i];
      const stepNum = i + 1;
      const totalSteps = monthRanges.length;
      
      // Calculate realistic smooth progress starting at 10% up to 95%
      const currentStartPercent = 10 + Math.round((i / totalSteps) * 85);

      setSyncFlowModal(prev => ({
        ...prev,
        stepNum,
        totalSteps,
        progressPercent: currentStartPercent,
        currentMonthLabel: `ماه ${mRange.jalaliName} (در حال دریافت از جیرا...)`,
        dateRange: `${mRange.startStr.split(' ')[0]} تا ${mRange.endStr.split(' ')[0]}`,
        totalTasksSoFar: totalTasksSynced
      }));

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
          message: res.message || ''
        };

        totalTasksSynced += (monthRes.taskCount || 0);
        results.push(monthRes);

        const currentDonePercent = 10 + Math.round(((i + 1) / totalSteps) * 85);

        setSyncFlowModal(prev => ({
          ...prev,
          progressPercent: currentDonePercent,
          totalTasksSoFar: totalTasksSynced,
          results: [...results]
        }));

        setMonthlyResults({
          totalTasksSynced,
          monthlyResults: [...results]
        });

        fetchDbStats(cfgRef.current?.rebuildMonths || 3);
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

        setSyncFlowModal(prev => ({
          ...prev,
          results: [...results]
        }));
      }
    }

    // 🚀 FINAL STEP: Automatic gap-free reconciliation (instantly catches any edge dates or Internal Requests)
    try {
      const activeMonths = cfgRef.current?.rebuildMonths || monthRanges.length || 3;
      const missingRes = await api.syncMissingTasks({ months: activeMonths });
      if (missingRes && missingRes.savedCount > 0) {
        totalTasksSynced += missingRes.savedCount;
        results.push({
          monthIndex: monthRanges.length + 1,
          monthLabel: 'تکمیلی و درخواست‌ها',
          jalaliName: `تکمیلی و درخواست‌ها (${missingRes.savedCount} تسک)`,
          gregorianName: 'Supplemental & Internal Requests',
          dateRange: 'تمامی پروژه‌ها',
          status: 'success',
          taskCount: missingRes.savedCount,
          jql: 'Missing & Internal Requests Reconciliation',
          message: `همگام‌سازی و ثبت خودکار ${missingRes.savedCount} تسک و درخواست جامانده`
        });
      }
    } catch (mErr) {
      console.warn('Final reconciliation warning:', mErr.message);
    }

    setSyncFlowModal(prev => ({
      ...prev,
      phase: 'completed',
      progressPercent: 100,
      totalTasksSoFar: totalTasksSynced,
      results: [...results]
    }));

    try {
      const activeMonths = cfgRef.current?.rebuildMonths || 3;
      await Promise.all([
        fetchDbStats(activeMonths),
        fetchJiraCount(false, activeMonths)
      ]);
    } catch (_) {}
  };

  useEffect(() => {
    if (syncLogsWrapperRef.current && monthlyResults?.monthlyResults?.length) {
      syncLogsWrapperRef.current.scrollTop = syncLogsWrapperRef.current.scrollHeight;
    }
  }, [monthlyResults?.monthlyResults?.length]);

  // 🚀 Open Rebuild Modal (Confirmation Stage)
  const handleOpenRebuildModal = () => {
    if (!canRebuildDb) {
      showToast('⚠️ شما مجوز بازسازی دیتابیس (db_rebuild) را ندارید. دسترسی به این بخش فقط برای کاربران دارای مجوز مربوطه امکان‌پذیر است.', 'error');
      return;
    }
    const rebuildMonths = parseInt(cfg?.rebuildMonths, 10) || 3;
    setSyncFlowModal({
      isOpen: true,
      type: 'rebuild',
      phase: 'confirm',
      title: '🔥 بازسازی کامل دیتابیس و سیستم',
      badge: `${rebuildMonths} ماه گذشته`,
      description: `آیا از اجرای بازسازی کامل دیتابیس اطمینان دارید؟ دیتابیس فعلی پاکسازی شده و تمام اطلاعات ${rebuildMonths} ماه گذشته به صورت گام به گام و زنده از سرور جیرا استخراج و بازسازی خواهد شد.`,
      stepNum: 0,
      totalSteps: rebuildMonths,
      progressPercent: 0,
      currentMonthLabel: '',
      dateRange: '',
      totalTasksSoFar: 0,
      results: [],
      error: null
    });
  };

  // 🚀 Start Rebuild Execution (In the same modal)
  const startRebuildExecution = async () => {
    const rebuildMonths = parseInt(cfg?.rebuildMonths, 10) || 3;
    setMonthlySyncing(true);
    setSyncFlowModal(prev => ({
      ...prev,
      phase: 'running',
      stepNum: 0,
      totalSteps: rebuildMonths,
      progressPercent: 0,
      totalTasksSoFar: 0,
      results: [],
      error: null
    }));

    try {
      setMatchEvaluated(false);
      setDbStats({
        totalTasks: 0,
        totalProjects: 0,
        withEpicCount: 0,
        withoutEpicCount: 0,
        epicsWithoutTasksCount: 0,
        totalSprints: 0,
        totalComponents: 0,
        projectTaskCounts: []
      });
      await api.clearDatabase();
      await fetchDbStats(rebuildMonths);

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

      await executeFlowStepByStep(monthRanges, `🔥 بازسازی کامل دیتابیس (${rebuildMonths} ماه گذشته)`);
    } catch (e) {
      setSyncFlowModal(prev => ({
        ...prev,
        phase: 'error',
        error: e.message || 'خطا در بازسازی کامل سایت'
      }));
    } finally {
      setMonthlySyncing(false);
    }
  };

  // 🚀 Open Date Range Modal (Picker Stage)
  const handleOpenRangeModal = () => {
    if (!canSyncRange) {
      showToast('⚠️ شما مجوز استخراج بازه زمانی (jira_sync_range) را ندارید.', 'error');
      return;
    }
    setSyncFlowModal({
      isOpen: true,
      type: 'range',
      phase: 'picker',
      title: '📅 همگام‌سازی و استخراج داده‌های جیرا در بازه زمانی دلخواه',
      badge: 'انتخاب بازه تاریخ',
      description: 'بازه تاریخ شمسی مورد نظر خود را با میان‌برهای سریع یا انتخاب‌گر تاریخ تعیین فرمایید.',
      stepNum: 0,
      totalSteps: 1,
      progressPercent: 0,
      currentMonthLabel: '',
      dateRange: '',
      totalTasksSoFar: 0,
      results: [],
      error: null
    });
  };

  // 🚀 Start Date Range Execution (In the same modal)
  const startRangeExecution = async () => {
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
    let monthRanges = [];

    if (diffDays <= 60) {
      const startStr = `${startG.gy}-${String(startG.gm).padStart(2, '0')}-${String(startG.gd).padStart(2, '0')} 00:00`;
      const endStr = `${endG.gy}-${String(endG.gm).padStart(2, '0')}-${String(endG.gd).padStart(2, '0')} 23:59`;
      const jalaliStartStr = `${rangeStartJalali.jy}/${String(rangeStartJalali.jm).padStart(2, '0')}/${String(rangeStartJalali.jd).padStart(2, '0')} 00:00`;
      const jalaliEndStr = `${rangeEndJalali.jy}/${String(rangeEndJalali.jm).padStart(2, '0')}/${String(rangeEndJalali.jd).padStart(2, '0')} 23:59`;

      monthRanges = [{
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
    } else {
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
    }

    setMonthlySyncing(true);
    setSyncFlowModal(prev => ({
      ...prev,
      phase: 'running',
      stepNum: 0,
      totalSteps: monthRanges.length,
      progressPercent: 0,
      totalTasksSoFar: 0,
      results: [],
      error: null
    }));

    try {
      await executeFlowStepByStep(monthRanges, '📅 در حال استخراج و همگام‌سازی بازه تاریخی');
    } catch (e) {
      setSyncFlowModal(prev => ({
        ...prev,
        phase: 'error',
        error: e.message || 'خطا در استخراج بازه زمانی'
      }));
    } finally {
      setMonthlySyncing(false);
    }
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
          <div style={{
            position: 'fixed',
            top: '28px',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999,
            pointerEvents: 'none',
            padding: '0 1rem'
          }}>
            <motion.div
              initial={{ opacity: 0, y: -25, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -25, scale: 0.92 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.85rem 1.6rem',
                borderRadius: '16px',
                backdropFilter: 'blur(25px)',
                WebkitBackdropFilter: 'blur(25px)',
                background: toast.type === 'error'
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.96), rgba(185, 28, 28, 0.96))'
                  : toast.type === 'warning'
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.96), rgba(217, 119, 6, 0.96))'
                  : toast.type === 'info'
                  ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.96), rgba(14, 165, 233, 0.96))'
                  : 'linear-gradient(135deg, rgba(16, 185, 129, 0.96), rgba(5, 150, 105, 0.96))',
                border: toast.type === 'error'
                  ? '1px solid rgba(254, 202, 202, 0.5)'
                  : toast.type === 'warning'
                  ? '1px solid rgba(254, 240, 138, 0.5)'
                  : toast.type === 'info'
                  ? '1px solid rgba(186, 230, 253, 0.5)'
                  : '1px solid rgba(167, 243, 208, 0.5)',
                boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 0, 0, 0.35)',
                color: '#FFFFFF',
                fontSize: '0.92rem',
                fontWeight: 700,
                maxWidth: '680px',
                textAlign: 'right',
                direction: 'rtl'
              }}
            >
              {toast.type === 'error' ? (
                <AlertTriangle size={22} color="#FFFFFF" style={{ flexShrink: 0 }} />
              ) : toast.type === 'warning' ? (
                <AlertTriangle size={22} color="#FFFFFF" style={{ flexShrink: 0 }} />
              ) : (
                <CheckCircle2 size={22} color="#FFFFFF" style={{ flexShrink: 0 }} />
              )}
              <span style={{ lineHeight: 1.5, flex: 1 }}>{toast.msg}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  marginRight: '0.25rem',
                  flexShrink: 0
                }}
                title="بستن"
              >
                <X size={14} />
              </button>
            </motion.div>
          </div>
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
          <h1 className="jsp-title"><Settings size={22} className="text-accent-cyan" />تنظیمات</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button 
            className="jsp-save-btn" 
            onClick={handleSave} 
            disabled={saving}
            title="ذخیره تمام تنظیمات و مپینگ‌ها"
          >
            <Save size={16} className={saving ? 'spin' : ''} />
            <span>{saving ? 'در حال ذخیره...' : 'ذخیره'}</span>
          </button>
        </div>
      </div>

      {/* 🔮 UNIFIED SINGLE SYNC FLOW MODAL (Rebuild DB & Date Range Extraction) */}
      <AnimatePresence>
        {syncFlowModal.isOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99999,
              background: 'rgba(11, 15, 25, 0.88)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              direction: 'rtl'
            }}
            onClick={() => {
              if (syncFlowModal.phase !== 'running') {
                setSyncFlowModal(prev => ({ ...prev, isOpen: false }));
              }
            }}
          >
            <motion.div
              style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.99))',
                border: syncFlowModal.phase === 'error'
                  ? '1px solid rgba(239, 68, 68, 0.5)'
                  : syncFlowModal.phase === 'completed'
                  ? '1px solid rgba(16, 185, 129, 0.5)'
                  : syncFlowModal.type === 'rebuild'
                  ? '1px solid rgba(239, 68, 68, 0.45)'
                  : '1px solid rgba(16, 185, 129, 0.45)',
                borderRadius: '24px',
                padding: '2rem',
                maxWidth: syncFlowModal.phase === 'running' || syncFlowModal.phase === 'completed' ? '820px' : '680px',
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(0, 0, 0, 0.6)',
                color: '#FFFFFF',
                direction: 'rtl'
              }}
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: syncFlowModal.phase === 'completed'
                      ? 'rgba(16, 185, 129, 0.2)'
                      : syncFlowModal.phase === 'running'
                      ? 'rgba(56, 189, 248, 0.2)'
                      : syncFlowModal.type === 'rebuild'
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(16, 185, 129, 0.2)',
                    border: syncFlowModal.phase === 'completed'
                      ? '1px solid rgba(16, 185, 129, 0.5)'
                      : syncFlowModal.phase === 'running'
                      ? '1px solid rgba(56, 189, 248, 0.5)'
                      : syncFlowModal.type === 'rebuild'
                      ? '1px solid rgba(239, 68, 68, 0.5)'
                      : '1px solid rgba(16, 185, 129, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    color: syncFlowModal.phase === 'completed' ? '#34D399' : syncFlowModal.phase === 'running' ? '#38BDF8' : '#FFFFFF'
                  }}>
                    {syncFlowModal.phase === 'completed' ? (
                      <CheckCircle2 size={26} />
                    ) : syncFlowModal.phase === 'running' ? (
                      <RefreshCw size={24} className="spin" />
                    ) : syncFlowModal.type === 'rebuild' ? (
                      '🔥'
                    ) : (
                      <Calendar size={24} />
                    )}
                  </div>

                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#F8FAFC' }}>
                      {syncFlowModal.phase === 'running'
                        ? 'در حال همگام‌سازی و واکشی ماه به ماه از Jira'
                        : syncFlowModal.phase === 'completed'
                        ? 'همگام‌سازی با موفقیت انجام شد'
                        : syncFlowModal.title}
                    </h2>
                    <span style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '0.2rem', display: 'block' }}>
                      {syncFlowModal.phase === 'running'
                        ? `مرحله ${syncFlowModal.stepNum} از ${syncFlowModal.totalSteps}: ${syncFlowModal.currentMonthLabel || 'در حال پردازش...'}`
                        : syncFlowModal.badge ? `📌 بازه زمانی: ${syncFlowModal.badge}` : ''}
                    </span>
                  </div>
                </div>

                {syncFlowModal.phase !== 'running' && (
                  <button
                    type="button"
                    onClick={() => setSyncFlowModal(prev => ({ ...prev, isOpen: false }))}
                    style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', color: '#94A3B8', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              {/* ── PHASE 1: CONFIRM REBUILD ── */}
              {syncFlowModal.phase === 'confirm' && (
                <div>
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1.25rem',
                    fontSize: '0.88rem',
                    lineHeight: '1.8',
                    color: '#CBD5E1',
                    marginBottom: '1.25rem'
                  }}>
                    <p style={{ margin: '0 0 0.5rem', color: '#FCD34D', fontWeight: 800 }}>
                      ⚠️ توجه: این عملیات دیتابیس جاری را کاملاً خالی کرده و تمامی اطلاعات را مجدداً از Jira دریافت می‌کند.
                    </p>
                    <p style={{ margin: 0 }}>
                      اطلاعات مربوط به بازه انتخابی به صورت گام به گام و زنده از سرور جیرا استخراج و بازسازی خواهد شد.
                    </p>
                    {selectedProjectKeys.length > 0 && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>پروژه‌های هدف: </span>
                        <strong style={{ color: '#38BDF8' }}>{selectedProjectKeys.join(', ')}</strong>
                      </div>
                    )}
                  </div>

                  {/* 🗓️ Timeframe Month Selector directly in Rebuild Confirmation Modal */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    borderRadius: '14px',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Calendar size={16} color="#EF4444" />
                        انتخاب بازه زمانی بازسازی:
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#FCA5A5', background: 'rgba(239, 68, 68, 0.2)', padding: '0.15rem 0.65rem', borderRadius: '8px', fontWeight: 800, border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                        {cfg?.rebuildMonths || 3} ماه گذشته
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      {[
                        { m: 1, label: '🚀 ۱ ماه' },
                        { m: 3, label: '📅 ۳ ماه' },
                        { m: 6, label: '🗓️ ۶ ماه' },
                        { m: 12, label: '📅 ۱ سال' },
                        { m: 60, label: '🔥 ۵ سال' }
                      ].map(item => {
                        const isSel = (parseInt(cfg?.rebuildMonths, 10) || 3) === item.m;
                        return (
                          <button
                            key={item.m}
                            type="button"
                            onClick={() => handleSelectRebuildMonths(item.m)}
                            style={{
                              padding: '0.35rem 0.8rem',
                              borderRadius: '10px',
                              border: isSel ? '1px solid #EF4444' : '1px solid rgba(255, 255, 255, 0.12)',
                              background: isSel ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                              color: isSel ? '#FFFFFF' : '#94A3B8',
                              fontWeight: isSel ? 800 : 500,
                              fontSize: '0.82rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: isSel ? '0 0 12px rgba(239, 68, 68, 0.35)' : 'none'
                            }}
                          >
                            {item.label}
                          </button>
                        );
                      })}

                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginRight: '0.5rem', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '0.6rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>دستی:</span>
                        <input
                          type="number"
                          value={cfg?.rebuildMonths || 3}
                          onChange={e => handleSelectRebuildMonths(e.target.value)}
                          placeholder="3"
                          style={{
                            width: '60px',
                            padding: '0.25rem 0.45rem',
                            fontSize: '0.82rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(0,0,0,0.3)',
                            color: '#FFFFFF',
                            textAlign: 'center',
                            outline: 'none'
                          }}
                        />
                        <span style={{ fontSize: '0.78rem', color: '#64748B' }}>ماه</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.85rem' }}>
                    <button
                      type="button"
                      onClick={() => setSyncFlowModal(prev => ({ ...prev, isOpen: false }))}
                      style={{
                        padding: '0.65rem 1.4rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#94A3B8',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      onClick={startRebuildExecution}
                      style={{
                        padding: '0.65rem 1.6rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                        boxShadow: '0 8px 20px -4px rgba(239, 68, 68, 0.4)',
                        color: '#FFFFFF',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <RefreshCw size={15} />
                      <span>🚀 بله، شروع بازسازی دیتابیس</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── PHASE 2: DATE RANGE PICKER ── */}
              {syncFlowModal.phase === 'picker' && (
                <div>
                  {/* Quick Presets Pills */}
                  <div style={{ marginBottom: '1.25rem', background: 'rgba(255, 255, 255, 0.04)', padding: '0.85rem 1rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 'bold', color: '#CBD5E1', marginBottom: '0.5rem' }}>⚡ میان‌برهای سریع بازه زمانی:</span>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
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
                    <button type="button" onClick={() => { setSyncFlowModal(prev => ({ ...prev, isOpen: false })); setJqlPreview(null); setJqlTestResults(null); }}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#94A3B8', borderRadius: '12px', padding: '0.6rem 1.1rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                      ✕ بستن
                    </button>
                    <button type="button" onClick={handleTestAllJql} disabled={jqlTestLoading || jqlPreviewLoading}
                      style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)', color: '#fff', border: 'none', borderRadius: '12px', padding: '0.6rem 1.1rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {jqlTestLoading ? '⏳ در حال تست...' : '⚡ تست کوئری جیرا'}
                    </button>
                    <button type="button" onClick={startRangeExecution} disabled={monthlySyncing}
                      style={{ background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', border: 'none', borderRadius: '12px', padding: '0.6rem 1.4rem', fontSize: '0.9rem', fontWeight: 800, cursor: monthlySyncing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(16,185,129,0.4)' }}>
                      <RefreshCw size={16} />
                      <span>🚀 شروع همگام‌سازی</span>
                    </button>
                  </div>

                  {/* JQL Test Results Box */}
                  {jqlTestResults && (
                    <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(245,158,11,0.35)', paddingTop: '1rem' }}>
                      <div style={{ fontSize: '0.77rem', color: '#94A3B8', marginBottom: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <span>سرور: <strong style={{ color: '#38BDF8' }}>{jqlTestResults.jiraBaseUrl}</strong></span>
                        <span>پروژه: <strong style={{ color: '#38BDF8' }}>{jqlTestResults.projectKey}</strong></span>
                        <span>شمسی: <strong style={{ color: '#10B981' }}>{jqlTestResults.jalaliRange}</strong></span>
                        <span>میلادی: <strong style={{ color: '#F59E0B' }}>{jqlTestResults.gregorianRange}</strong></span>
                      </div>
                      {jqlTestResults.winnerId
                        ? <div style={{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.4)', borderRadius:'8px', padding:'0.4rem 0.85rem', marginBottom:'0.55rem', fontSize:'0.78rem', color:'#6EE7B7' }}>برنده: <strong>#{jqlTestResults.winnerId}</strong> - این کوئری پاسخ داد</div>
                        : <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', padding:'0.4rem 0.85rem', marginBottom:'0.55rem', fontSize:'0.78rem', color:'#FCA5A5' }}>هیچ کوئری تسک برنگرداند</div>
                      }
                      <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem', maxHeight:'240px', overflowY:'auto' }}>
                        {jqlTestResults.results.map(r => {
                          const win = r.id === jqlTestResults.winnerId;
                          const bg = win ? 'rgba(16,185,129,0.1)' : r.status==='error' ? 'rgba(239,68,68,0.07)' : r.status==='zero' ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.03)';
                          const bdr = win ? '1.5px solid rgba(16,185,129,0.5)' : r.status==='error' ? '1px solid rgba(239,68,68,0.22)' : '1px solid rgba(255,255,255,0.07)';
                          return (
                            <div key={r.id} style={{ background:bg, border:bdr, borderRadius:'9px', padding:'0.5rem 0.8rem' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.3rem', marginBottom:'0.25rem' }}>
                                <span style={{ fontSize:'0.75rem', color: win ? '#A7F3D0' : '#94A3B8', fontWeight: win ? 700 : 400 }}>#{r.id} - {r.name}</span>
                                <span style={{ fontSize:'0.69rem', color:'#64748B' }}>{r.total} تسک ({r.ms}ms)</span>
                              </div>
                              <code style={{ fontSize:'0.71rem', color: win ? '#6EE7B7' : '#475569', wordBreak:'break-all', fontFamily:'monospace', lineHeight:1.5, display:'block' }}>{r.jql}</code>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── PHASE 3: RUNNING (LIVE STEP-BY-STEP PROGRESS IN SAME MODAL) ── */}
              {syncFlowModal.phase === 'running' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Progress Header Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '1rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: '#94A3B8', display: 'block', marginBottom: '0.3rem' }}>⚡ کل تسک‌های دریافت‌شده تا این لحظه</span>
                      <strong style={{ fontSize: '1.8rem', color: '#38BDF8', fontWeight: 900 }}>
                        {syncFlowModal.totalTasksSoFar.toLocaleString()}
                      </strong>
                    </div>

                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '16px', padding: '1rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: '#94A3B8', display: 'block', marginBottom: '0.3rem' }}>🗓️ مرحله در حال پردازش</span>
                      <strong style={{ fontSize: '1.15rem', color: '#34D399', fontWeight: 800 }}>
                        {syncFlowModal.currentMonthLabel || 'در حال آماده‌سازی...'}
                      </strong>
                      <span style={{ fontSize: '0.72rem', color: '#6EE7B7', display: 'block', marginTop: '0.2rem' }}>
                        ماه {syncFlowModal.stepNum} از {syncFlowModal.totalSteps}
                      </span>
                    </div>
                  </div>

                  {/* High Visibility Gradient Progress Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', fontSize: '0.82rem', color: '#CBD5E1' }}>
                      <span>پیشرفت کلی عملیات:</span>
                      <strong style={{ color: '#38BDF8', fontWeight: 800 }}>{syncFlowModal.progressPercent}%</strong>
                    </div>
                    <div style={{ width: '100%', background: 'rgba(255, 255, 255, 0.1)', height: '10px', borderRadius: '6px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${syncFlowModal.progressPercent}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #38BDF8, #10B981)',
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>
                  </div>

                  {/* Live Progress Table */}
                  <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.5)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'right' }}>
                      <thead>
                        <tr style={{ background: '#1E293B', color: '#94A3B8', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', position: 'sticky', top: 0, zIndex: 5 }}>
                          <th style={{ padding: '0.6rem 0.8rem', width: '70px' }}>ردیف</th>
                          <th style={{ padding: '0.6rem 0.8rem' }}>دوره / ماه</th>
                          <th style={{ padding: '0.6rem 0.8rem' }}>بازه میلادی</th>
                          <th style={{ padding: '0.6rem 0.8rem', width: '100px', textAlign: 'center' }}>وضعیت</th>
                          <th style={{ padding: '0.6rem 0.8rem', width: '110px', textAlign: 'center' }}>تعداد تسک</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncFlowModal.results.map((r, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', background: r.status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'transparent' }}>
                            <td style={{ padding: '0.55rem 0.8rem', color: '#94A3B8', fontFamily: 'monospace' }}>#{r.monthIndex}</td>
                            <td style={{ padding: '0.55rem 0.8rem', fontWeight: 700, color: '#F8FAFC' }}>{r.jalaliName}</td>
                            <td style={{ padding: '0.55rem 0.8rem', color: '#CBD5E1', fontSize: '0.74rem', fontFamily: 'monospace' }}>{r.dateRange}</td>
                            <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center' }}>
                              <span style={{
                                padding: '0.12rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                background: r.status === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: r.status === 'success' ? '#6EE7B7' : '#FCA5A5'
                              }}>
                                {r.status === 'success' ? '✅ موفق' : '❌ خطا'}
                              </span>
                            </td>
                            <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', fontWeight: 800, color: '#38BDF8' }}>
                              {r.taskCount} تسک
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── PHASE 4: COMPLETED (SUMMARY & REFRESH) ── */}
              {syncFlowModal.phase === 'completed' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Summary Metric Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '16px', padding: '1.1rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94A3B8', display: 'block', marginBottom: '0.3rem' }}>📥 مجموع کل تسک‌های ثبت‌شده در دیتابیس</span>
                      <strong style={{ fontSize: '2rem', color: '#34D399', fontWeight: 900 }}>
                        {syncFlowModal.totalTasksSoFar.toLocaleString()}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: '#6EE7B7', display: 'block', marginTop: '0.2rem' }}>تسک</span>
                    </div>

                    <div style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '16px', padding: '1.1rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94A3B8', display: 'block', marginBottom: '0.3rem' }}>🗓️ تعداد ماه‌ها / دوره‌های پردازش‌شده</span>
                      <strong style={{ fontSize: '2rem', color: '#38BDF8', fontWeight: 900 }}>
                        {syncFlowModal.results.length}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: '#7DD3FC', display: 'block', marginTop: '0.2rem' }}>دوره زمانی</span>
                    </div>
                  </div>

                  {/* Summary Table */}
                  <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.5)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'right' }}>
                      <thead>
                        <tr style={{ background: '#1E293B', color: '#94A3B8', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', position: 'sticky', top: 0 }}>
                          <th style={{ padding: '0.6rem 0.8rem', width: '70px' }}>ردیف</th>
                          <th style={{ padding: '0.6rem 0.8rem' }}>دوره / ماه</th>
                          <th style={{ padding: '0.6rem 0.8rem' }}>بازه میلادی</th>
                          <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>وضعیت</th>
                          <th style={{ padding: '0.6rem 0.8rem', textAlign: 'center' }}>تعداد تسک</th>
                        </tr>
                      </thead>
                      <tbody>
                        {syncFlowModal.results.map((r, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <td style={{ padding: '0.55rem 0.8rem', color: '#94A3B8', fontFamily: 'monospace' }}>#{r.monthIndex}</td>
                            <td style={{ padding: '0.55rem 0.8rem', fontWeight: 700, color: '#F8FAFC' }}>{r.jalaliName}</td>
                            <td style={{ padding: '0.55rem 0.8rem', color: '#CBD5E1', fontSize: '0.74rem', fontFamily: 'monospace' }}>{r.dateRange}</td>
                            <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center' }}>
                              <span style={{ padding: '0.12rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7' }}>
                                ✅ موفق
                              </span>
                            </td>
                            <td style={{ padding: '0.55rem 0.8rem', textAlign: 'center', fontWeight: 800, color: '#38BDF8' }}>
                              {r.taskCount} تسک
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.85rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setSyncFlowModal(prev => ({ ...prev, isOpen: false }))}
                      style={{
                        padding: '0.65rem 1.4rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#94A3B8',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      متوجه شدم (بستن)
                    </button>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      style={{
                        padding: '0.65rem 1.6rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #10B981, #059669)',
                        boxShadow: '0 8px 20px -4px rgba(16, 185, 129, 0.4)',
                        color: '#FFFFFF',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <RefreshCw size={15} />
                      <span>به‌روزرسانی صفحه داشبورد</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── PHASE 5: ERROR ── */}
              {syncFlowModal.phase === 'error' && (
                <div>
                  <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '14px', padding: '1.25rem', color: '#FCA5A5', fontSize: '0.88rem', lineHeight: '1.7', marginBottom: '1.5rem' }}>
                    {syncFlowModal.error}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setSyncFlowModal(prev => ({ ...prev, isOpen: false }))}
                      style={{
                        padding: '0.65rem 1.4rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#94A3B8',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      بستن
                    </button>
                    <button
                      type="button"
                      onClick={syncFlowModal.type === 'rebuild' ? startRebuildExecution : startRangeExecution}
                      style={{
                        padding: '0.65rem 1.6rem',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                        boxShadow: '0 8px 20px -4px rgba(239, 68, 68, 0.4)',
                        color: '#FFFFFF',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      تلاش مجدد
                    </button>
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
          {/* Tab 1: Database (Diagnostic & Stats) */}
          {(isAdmin || canViewDiag) && (
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
              <span>📊 پایش دیتابیس</span>
              {activeTab === 'database' && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981', marginRight: '0.4rem' }} />
              )}
            </button>
          )}

          {/* Tab 2: Connection */}
          {(isAdmin || canConfigJira) && (
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
              <span>🔌 تنظیمات جیرا</span>
              {activeTab === 'connection' && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38BDF8', boxShadow: '0 0 8px #38BDF8', marginRight: '0.4rem' }} />
              )}
            </button>
          )}

          {/* Tab 3: Mapping */}
          {(isAdmin || canMapping) && (
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
          )}

          {/* Tab 4: System Tests */}
          {(isAdmin || canSystemTests) && (
            <button
              type="button"
              onClick={() => setActiveTab('system_tests')}
              style={{
                padding: '0.85rem 1.6rem',
                borderTopLeftRadius: '14px',
                borderTopRightRadius: '14px',
                borderBottomLeftRadius: '0px',
                borderBottomRightRadius: '0px',
                border: activeTab === 'system_tests' ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid transparent',
                borderBottom: activeTab === 'system_tests' ? '2px solid #0F172A' : '1px solid transparent',
                background: activeTab === 'system_tests' ? 'linear-gradient(180deg, rgba(168, 85, 247, 0.22) 0%, rgba(15, 23, 42, 0.95) 100%)' : 'transparent',
                color: activeTab === 'system_tests' ? '#C084FC' : '#94A3B8',
                fontWeight: activeTab === 'system_tests' ? 800 : 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                fontSize: '0.94rem',
                position: 'relative',
                marginBottom: '-1px',
                zIndex: activeTab === 'system_tests' ? 2 : 1,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div style={{
                background: activeTab === 'system_tests' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                padding: '0.35rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: activeTab === 'system_tests' ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid transparent'
              }}>
                <FlaskConical size={18} color={activeTab === 'system_tests' ? '#C084FC' : '#94A3B8'} />
              </div>
              <span>🧪 آزمون‌های خودکار سیستم</span>
              {activeTab === 'system_tests' && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#A855F7', boxShadow: '0 0 8px #A855F7', marginRight: '0.4rem' }} />
              )}
            </button>
          )}

          {/* Tab 5: 📜 لاگ‌های زنده بک‌اند */}
          {(isAdmin || canSystemLogs) && (
            <button
              type="button"
              onClick={() => setActiveTab('system_logs')}
              style={{
                padding: '0.85rem 1.4rem',
                borderRadius: '12px 12px 0 0',
                border: activeTab === 'system_logs' ? '1px solid rgba(6, 182, 212, 0.5)' : '1px solid transparent',
                borderBottom: activeTab === 'system_logs' ? '2px solid #0F172A' : '1px solid transparent',
                background: activeTab === 'system_logs' ? 'linear-gradient(180deg, rgba(6, 182, 212, 0.22) 0%, rgba(15, 23, 42, 0.95) 100%)' : 'transparent',
                color: activeTab === 'system_logs' ? '#22D3EE' : '#94A3B8',
                fontWeight: activeTab === 'system_logs' ? 800 : 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                fontSize: '0.94rem',
                position: 'relative',
                marginBottom: '-1px',
                zIndex: activeTab === 'system_logs' ? 2 : 1,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div style={{
                background: activeTab === 'system_logs' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                padding: '0.35rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: activeTab === 'system_logs' ? '1px solid rgba(6, 182, 212, 0.5)' : '1px solid transparent'
              }}>
                <Terminal size={18} color={activeTab === 'system_logs' ? '#22D3EE' : '#94A3B8'} />
              </div>
              <span>📜 لاگ‌های زنده بک‌اند</span>
              {activeTab === 'system_logs' && (
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#06B6D4', boxShadow: '0 0 8px #06B6D4', marginRight: '0.4rem' }} />
              )}
            </button>
          )}
        </div>

        {/* Panel Body Content Container */}
        <div style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.35)' }}>
          <AnimatePresence mode="wait">
            {activeTab === 'database' && (
              <motion.div key="database" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
<Section icon={Server} title="تنظیمات سرور و دیتابیس (Server & Database Management)" color="#10B981" defaultOpen={true}>
        <p className="jsp-section-desc">پایش زنده وضعیت دیتابیس SQLite، تعداد کل تسک‌های ثبت‌شده، حجم فایل و به‌روزرسانی سیستم.</p>

        {/* 📊 DATABASE STATS TILE CARD */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.8))',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '20px',
          padding: '1.25rem 1.6rem',
          marginBottom: '1.5rem',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35), 0 0 20px rgba(16, 185, 129, 0.15)'
        }}>
          {/* 📊 DATABASE STATS HEADER & ACTION BUTTONS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10B981', color: '#6EE7B7', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Database size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#6EE7B7' }}>پایش آمار دیتابیس</h3>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* 🔴 بازسازی دیتابیس */}
              <button
                type="button"
                className="jsp-run-diag-btn"
                style={{
                  background: canRebuildDb ? 'linear-gradient(135deg, #EF4444, #DC2626)' : 'rgba(255, 255, 255, 0.08)',
                  boxShadow: canRebuildDb ? '0 4px 15px rgba(239, 68, 68, 0.4)' : 'none',
                  cursor: canRebuildDb ? 'pointer' : 'not-allowed',
                  opacity: canRebuildDb ? 1 : 0.65,
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.8rem',
                  borderRadius: '10px'
                }}
                onClick={handleOpenRebuildModal}
                disabled={monthlySyncing}
                title={canRebuildDb ? 'بازسازی کامل دیتابیس بر اساس بازه انتخابی در پاپ‌آپ' : 'دسترسی محدود: نیاز به مجوز «بازسازی دیتابیس (db_rebuild)»'}
              >
                {canRebuildDb ? <RefreshCw size={13} className={monthlySyncing ? 'spin' : ''} /> : <Lock size={13} color="#FCA5A5" />}
                <span>{monthlySyncing ? 'در حال بازسازی...' : 'بازسازی دیتابیس'}</span>
              </button>

              {/* 🟢 استخراج بازه زمانی */}
              <button
                type="button"
                className="jsp-run-diag-btn"
                style={{
                  background: canSyncRange ? 'linear-gradient(135deg, #10B981, #059669)' : 'rgba(255, 255, 255, 0.08)',
                  boxShadow: canSyncRange ? '0 4px 15px rgba(16, 185, 129, 0.35)' : 'none',
                  cursor: canSyncRange ? 'pointer' : 'not-allowed',
                  opacity: canSyncRange ? 1 : 0.65,
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.8rem',
                  borderRadius: '10px'
                }}
                onClick={handleOpenRangeModal}
                disabled={monthlySyncing}
                title={canSyncRange ? 'استخراج و همگام‌سازی دیتای جیرا در بازه زمانی دلخواه' : 'دسترسی محدود: نیاز به مجوز «استخراج بازه زمانی (jira_sync_range)»'}
              >
                {canSyncRange ? <Calendar size={13} /> : <Lock size={13} color="#6EE7B7" />}
                <span>{monthlySyncing ? 'در حال استخراج...' : 'استخراج بازه زمانی'}</span>
              </button>

              {/* ⏰ دکمه زمان‌بندی همگام‌سازی خودکار (Scheduler) */}
              <button
                type="button"
                className="jsp-run-diag-btn"
                style={{
                  background: schedulerConfig?.enabled ? 'linear-gradient(135deg, #0284C7, #0369A1)' : 'rgba(255, 255, 255, 0.08)',
                  boxShadow: schedulerConfig?.enabled ? '0 4px 15px rgba(2, 132, 199, 0.35)' : 'none',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  color: '#FFFFFF',
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.8rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
                onClick={handleOpenSchedulerModal}
                title="تنظیم زمان‌بندی همگام‌سازی خودکار دیتابیس با جیرا"
              >
                <Clock size={13} className="text-accent-cyan" />
                <span>
                  {schedulerConfig?.enabled
                    ? `زمان‌بندی: ${schedulerConfig.mode === 'daily' ? `هر شب ${schedulerConfig.time}` : `هر ${schedulerConfig.interval_hours} ساعت`}`
                    : 'زمان‌بندی خودکار'}
                </span>
              </button>

              <button
                type="button"
                onClick={fetchDbStats}
                disabled={dbStatsLoading}
                title="به‌روزرسانی ستون دیتابیس لوکال"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#38BDF8',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <RefreshCw size={13} className={dbStatsLoading ? 'spin' : ''} />
                <span>{dbStatsLoading ? 'در حال بروزرسانی...' : 'بروزرسانی DB'}</span>
              </button>

              <button
                type="button"
                onClick={() => fetchJiraCount(true)}
                disabled={jiraCountLoading}
                title="استخراج آمار زنده از سرور جیرا"
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#38BDF8',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <RefreshCw size={13} className={jiraCountLoading ? 'spin' : ''} />
                <span>{jiraCountLoading ? 'در حال دریافت...' : 'آمار جیرا'}</span>
              </button>

              <button
                type="button"
                onClick={() => openMismatchDiagnosticModal('totalTasks')}
                disabled={mismatchLoading}
                title="بررسی و استخراج موارد اختلاف بین جیرا و دیتابیس"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)'
                }}
              >
                <Search size={13} />
                <span>بررسی اختلاف</span>
              </button>
            </div>
          </div>

          {/* ⚖️ UNIFIED COMPREHENSIVE JIRA VS DATABASE COMPARISON TABLE */}
          <div style={{ marginTop: '0.5rem', marginBottom: '1.25rem' }}>
            <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38BDF8', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span>جدول مقایسه شاخص‌ها (جیرا vs دیتابیس)</span>
                {Array.isArray(dbStats?.projectTaskCounts) && dbStats.projectTaskCounts.length > 0 && (
                  <span style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.35)', color: '#FCD34D', padding: '0.15rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}>
                    {dbStats.projectTaskCounts.map(p => `پروژه ${p.id}: ${p.epicCount || 0} اپیک کل — ${p.taskCount || 0} تسک`).join(' | ')}
                  </span>
                )}
                <span style={{ background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.4)', color: '#38BDF8', padding: '0.15rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Database size={13} />
                  <span>حجم دیتابیس: <strong>{dbStats?.dbSizeMb ?? '0.00'} MB</strong></span>
                </span>
              </span>
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
                  {/* Row 1: Tasks with epic (includes subtasks with epic) */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 700, color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle2 size={16} color="#6EE7B7" />
                      <span>⚡ تسک‌های دارای اپیک (شامل زیرتسک‌های دارای اپیک)</span>
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#38BDF8' }}>
                      {jiraCountLoading || monthlySyncing || syncing ? (
                        <span style={{ color: '#FBBF24', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><RefreshCw size={12} className="animate-spin" /> ⏳ در حال دریافت...</span>
                      ) : jiraCountData?.withEpicCount !== undefined ? `${jiraCountData.withEpicCount.toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#C084FC' }}>
                      {dbStatsLoading || monthlySyncing || syncing ? '⏳...' : dbStats?.withEpicTasksCount !== undefined ? `${(dbStats.withEpicTasksCount || 0).toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', textAlign: 'center' }}>
                      {jiraCountLoading || dbStatsLoading || !jiraCountData || !dbStats ? (
                        <span style={{ color: '#94A3B8', fontSize: '0.74rem' }}>⏳ در حال محاسبه...</span>
                      ) : (jiraCountData?.withEpicCount === dbStats?.withEpicTasksCount) ? (
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>✅ بدون اختلاف (تطابق کامل)</span>
                      ) : (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>⚠️ اختلاف دارد ({Math.abs((jiraCountData?.withEpicCount || 0) - (dbStats?.withEpicTasksCount || 0))} مورد)</span>
                      )}
                    </td>
                  </tr>

                  {/* Row 2: Tasks without epic (includes subtasks without epic) */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 700, color: '#E2E8F0' }}>
                      ⚠️ تسک‌های بدون اپیک (شامل زیرتسک‌های بدون اپیک)
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#38BDF8' }}>
                      {jiraCountLoading || monthlySyncing || syncing ? (
                        <span style={{ color: '#FBBF24', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><RefreshCw size={12} className="animate-spin" /> ⏳ در حال دریافت...</span>
                      ) : jiraCountData?.withoutEpicCount !== undefined ? `${jiraCountData.withoutEpicCount.toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: (dbStats?.unlinkedTasksCount || 0) > 0 ? '#FCA5A5' : '#6EE7B7' }}>
                      {dbStatsLoading || monthlySyncing || syncing ? '⏳...' : dbStats?.unlinkedTasksCount !== undefined ? `${(dbStats.unlinkedTasksCount || 0).toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', textAlign: 'center' }}>
                      {jiraCountLoading || dbStatsLoading || !jiraCountData || !dbStats ? (
                        <span style={{ color: '#94A3B8', fontSize: '0.74rem' }}>⏳ در حال محاسبه...</span>
                      ) : (jiraCountData?.withoutEpicCount === dbStats?.unlinkedTasksCount) ? (
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>✅ بدون اختلاف (تطابق کامل)</span>
                      ) : (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>⚠️ اختلاف دارد ({Math.abs((jiraCountData?.withoutEpicCount || 0) - (dbStats?.unlinkedTasksCount || 0))} مورد)</span>
                      )}
                    </td>
                  </tr>

                  {/* Row 3: Sub-tasks */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 700, color: '#E2E8F0' }}>
                      🔹 زیرتسک‌ها (Sub-tasks)
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#38BDF8' }}>
                      {jiraCountLoading || monthlySyncing || syncing ? (
                        <span style={{ color: '#FBBF24', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><RefreshCw size={12} className="animate-spin" /> ⏳ در حال دریافت...</span>
                      ) : jiraCountData?.subtaskCount !== undefined ? `${jiraCountData.subtaskCount.toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#60A5FA' }}>
                      {dbStatsLoading || monthlySyncing || syncing ? '⏳...' : dbStats?.subtasksCount !== undefined ? `${(dbStats.subtasksCount || 0).toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', textAlign: 'center' }}>
                      {jiraCountLoading || dbStatsLoading || !jiraCountData || !dbStats ? (
                        <span style={{ color: '#94A3B8', fontSize: '0.74rem' }}>⏳ در حال محاسبه...</span>
                      ) : (jiraCountData?.subtaskCount === dbStats?.subtasksCount) ? (
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>✅ بدون اختلاف (تطابق کامل)</span>
                      ) : (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>⚠️ اختلاف دارد ({Math.abs((jiraCountData?.subtaskCount || 0) - (dbStats?.subtasksCount || 0))} مورد)</span>
                      )}
                    </td>
                  </tr>

                  {/* Row 4: Total Non-Epic Tasks */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#FFFFFF' }}>
                      📝 مجموع کل تسک‌ها
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#38BDF8', fontSize: '0.88rem' }}>
                      {jiraCountLoading || monthlySyncing || syncing ? (
                        <span style={{ color: '#FBBF24', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><RefreshCw size={12} className="animate-spin" /> ⏳ در حال دریافت...</span>
                      ) : jiraCountData?.total !== undefined ? `${jiraCountData.total.toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#C084FC', fontSize: '0.88rem' }}>
                      {dbStatsLoading || monthlySyncing || syncing ? '⏳...' : dbStats?.totalTasks !== undefined ? `${dbStats.totalTasks.toLocaleString()} تسک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', textAlign: 'center' }}>
                      {jiraCountLoading || dbStatsLoading || !jiraCountData || !dbStats ? (
                        <span style={{ color: '#94A3B8', fontSize: '0.74rem' }}>⏳ در حال محاسبه...</span>
                      ) : (jiraCountData?.total === dbStats?.totalTasks) ? (
                        <span style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#6EE7B7', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>✅ بدون اختلاف (همگام کامل)</span>
                      ) : (
                        <span style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#FCA5A5', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>⚠️ اختلاف دارد ({Math.abs((jiraCountData?.total || 0) - (dbStats?.totalTasks || 0))} تسک)</span>
                      )}
                    </td>
                  </tr>

                  {/* Row 5: Total Epics with Per-Project Breakdown */}
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 700, color: '#E2E8F0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                        <span>📂 کل اپیک‌ها (پروژه‌ها)</span>
                      </div>
                      {/* Live Per-Project Epics & Tasks Breakdown Badge Pills */}
                      {Array.isArray(dbStats?.projectTaskCounts) && dbStats.projectTaskCounts.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                          {dbStats.projectTaskCounts.map((p, pIdx) => (
                            <span key={pIdx} style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38BDF8', padding: '0.12rem 0.45rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                              📌 پروژه {p.id}: {p.epicCount || 0} اپیک کل — {p.taskCount || 0} تسک
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#38BDF8', verticalAlign: 'top' }}>
                      {jiraCountLoading ? (
                        <span style={{ color: '#FBBF24', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><RefreshCw size={12} className="animate-spin" /> ⏳ در حال دریافت...</span>
                      ) : jiraCountData?.jiraEpicsCount !== undefined ? `${jiraCountData.jiraEpicsCount.toLocaleString()} اپیک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', fontWeight: 800, color: '#C084FC', verticalAlign: 'top' }}>
                      {dbStatsLoading ? '⏳...' : dbStats?.totalProjects !== undefined ? `${(dbStats.totalProjects || 0).toLocaleString()} اپیک` : '—'}
                    </td>
                    <td style={{ padding: '0.65rem 0.9rem', textAlign: 'center', verticalAlign: 'top' }}>
                      {jiraCountLoading || dbStatsLoading || !jiraCountData || !dbStats ? (
                        <span style={{ color: '#94A3B8', fontSize: '0.74rem' }}>⏳ در حال محاسبه...</span>
                      ) : (jiraCountData?.jiraEpicsCount === dbStats?.totalProjects) ? (
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>✅ بدون اختلاف (تطابق کامل)</span>
                      ) : (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>⚠️ اختلاف دارد ({Math.abs((jiraCountData?.jiraEpicsCount || 0) - (dbStats?.totalProjects || 0))} اپیک)</span>
                      )}
                    </td>
                  </tr>

                  {/* Row 6: Epics without tasks */}
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
                      {jiraCountLoading || dbStatsLoading || !jiraCountData || !dbStats ? (
                        <span style={{ color: '#94A3B8', fontSize: '0.74rem' }}>⏳ در حال محاسبه...</span>
                      ) : (jiraCountData?.jiraEpicsWithoutTasksCount === dbStats?.epicsWithoutTasksCount) ? (
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>✅ بدون اختلاف (تطابق کامل)</span>
                      ) : (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>⚠️ اختلاف دارد ({Math.abs((jiraCountData?.jiraEpicsWithoutTasksCount || 0) - (dbStats?.epicsWithoutTasksCount || 0))} مورد)</span>
                      )}
                    </td>
                  </tr>

                  {/* Row 7: Sprints */}
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
                      <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>✅ ثبتی در دیتابیس</span>
                    </td>
                  </tr>

                  {/* Row 8: Components */}
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
                      <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6EE7B7', padding: '0.2rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>✅ ثبتی در دیتابیس</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
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
                onClick={handleOpenRebuildModal}
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
        {/* Top Actions Row: Section Description + Diagnose / Test API Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem', marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', flexWrap: 'wrap', gap: '0.75rem' }}>
          <p className="jsp-section-desc" style={{ margin: 0 }}>
            پیکربندی اطلاعات اتصال، آدرس سرور جیرا و تست زنده دسترسی به API
          </p>

          <button 
            type="button"
            className="jsp-diag-trigger-btn" 
            onClick={handleDiagnose} 
            disabled={diagLoading}
            title="پایش زنده ارتباط API جیرا و تست سلامت اتصال"
          >
            <Zap size={15} className={diagLoading ? 'spin' : ''} />
            <span>{diagLoading ? 'در حال پایش...' : '⚡ پایش و تست API Jira'}</span>
          </button>
        </div>

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

<Section defaultOpen={false} icon={Cpu} title="نسخه و مسیرهای API جیرا (API Version & Custom Endpoints)" color="#6366F1">
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
              </motion.div>
            )}

            {activeTab === 'mapping' && (
              <motion.div key="motion_mapping" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
<Section defaultOpen={false} icon={Cpu} title="فیلدهای کاستوم Jira (Custom Fields Mapping)" color="#EC4899">
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

<Section defaultOpen={false} icon={Tag} title="نگاشت وضعیت‌های Jira به داشبورد (Status Mapping)" color="#10B981">
        <p className="jsp-section-desc">هر وضعیت اصلی جیرا را به وضعیت داشبورد نگاشت کنید. وضعیت‌های داشبورد: Done، In Progress، Waiting، To Do</p>
        <StatusMappingEditor
          mapping={cfg.statusMapping || {}}
          onChange={v => setCfg(prev => ({ ...prev, statusMapping: v }))}
        />
      </Section>

<Section defaultOpen={false} icon={AlertTriangle} title="وضعیت‌های «منتظر» (Waiting Status List)" color="#FBBF24">
        <p className="jsp-section-desc">وضعیت‌های جیرا که باید به‌عنوان «منتظر تیم‌های دیگر» شناسایی شوند. هر وضعیت را وارد کرده و Enter بزنید.</p>
        <TagList
          items={cfg.waitingStatuses || []}
          onChange={v => setCfg(prev => ({ ...prev, waitingStatuses: v }))}
          placeholder="OnHolding، Waiting، Blocked..."
        />
      </Section>

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

<Section icon={Cpu} title="کامپوننت‌های برجسته داشبورد (Featured Components)" color="#8B5CF6" defaultOpen={false}>
        <p className="jsp-section-desc">کامپوننت‌هایی که به‌عنوان دکمه فیلتر سریع در صفحه داشبورد نمایش داده می‌شوند.</p>
        <TagList
          items={cfg.featuredComponents || []}
          onChange={v => setCfg(prev => ({ ...prev, featuredComponents: v }))}
          placeholder="learning، meeting، support..."
        />
      </Section>
              </motion.div>
            )}

            {activeTab === 'system_tests' && (
              <motion.div
                key="system_tests"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
              >
                <div className="glass-card" style={{
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.5) 0%, rgba(15, 23, 42, 0.95) 100%)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)'
                }}>
                  {/* Top Action Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1.2rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div style={{ background: 'rgba(168, 85, 247, 0.25)', border: '1px solid #A855F7', color: '#C084FC', width: '46px', height: '46px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FlaskConical size={24} />
                      </div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#C084FC' }}>
                          آزمون‌های خودکار و سلامت کل سیستم
                        </h2>
                        <p style={{ margin: '0.3rem 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                          اجرای یکپارچه آزمون‌های صحت منطق، تبدیل تقویم، امنیت API و اتصالات به صورت آنی
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRunSystemTests}
                      disabled={systemTestsLoading}
                      style={{
                        background: systemTestsLoading ? 'rgba(168, 85, 247, 0.3)' : 'linear-gradient(135deg, #9333EA, #7E22CE)',
                        border: '1px solid #A855F7',
                        color: '#FFFFFF',
                        padding: '0.65rem 1.4rem',
                        borderRadius: '12px',
                        fontSize: '0.92rem',
                        fontWeight: 800,
                        cursor: systemTestsLoading ? 'wait' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        boxShadow: '0 4px 15px rgba(147, 51, 234, 0.4)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <RefreshCw size={17} className={systemTestsLoading ? 'spin' : ''} />
                      <span>{systemTestsLoading ? 'در حال اجرای آزمون‌ها...' : '⚡ اجرای آزمون‌های سیستم (Run Tests)'}</span>
                    </button>
                  </div>

                  {/* Summary Metric Cards */}
                  {systemTestsResult && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '12px', padding: '0.9rem 1.1rem' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>🟢 آزمون‌های موفق</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34D399', marginTop: '0.2rem' }}>
                          {systemTestsResult.numPassedTests} / {systemTestsResult.numTotalTests}
                        </div>
                      </div>

                      <div style={{ background: systemTestsResult.numFailedTests > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.04)', border: systemTestsResult.numFailedTests > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '0.9rem 1.1rem' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>🔴 آزمون‌های ناموفق</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: systemTestsResult.numFailedTests > 0 ? '#F87171' : '#94A3B8', marginTop: '0.2rem' }}>
                          {systemTestsResult.numFailedTests}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '12px', padding: '0.9rem 1.1rem' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>📁 سوئیت‌های تست فعال</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38BDF8', marginTop: '0.2rem' }}>
                          {systemTestsResult.numPassedTestSuites} / {systemTestsResult.numTotalTestSuites}
                        </div>
                      </div>

                      <div style={{ background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.35)', borderRadius: '12px', padding: '0.9rem 1.1rem' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 600 }}>⏱️ مدت زمان اجرا</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#C084FC', marginTop: '0.2rem' }}>
                          {systemTestsResult.durationSeconds || '0.95'} ثانیه
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Test Suites List */}
                  {systemTestsResult && Array.isArray(systemTestsResult.suites) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <h3 style={{ margin: '0.5rem 0 0', fontSize: '1rem', color: '#E2E8F0', fontWeight: 700 }}>
                        📋 جزئیات اجرای هر سوئیت تست:
                      </h3>
                      {systemTestsResult.suites.map((suite, sIdx) => {
                        const isSuitePassed = suite.status === 'passed';
                        return (
                          <div key={sIdx} style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: `1px solid ${isSuitePassed ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.45)'}`,
                            borderRadius: '12px',
                            padding: '1rem 1.25rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{
                                  background: isSuitePassed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                  color: isSuitePassed ? '#34D399' : '#F87171',
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  padding: '0.2rem 0.65rem',
                                  borderRadius: '20px',
                                  border: `1px solid ${isSuitePassed ? '#10B981' : '#EF4444'}`
                                }}>
                                  {isSuitePassed ? 'PASS' : 'FAIL'}
                                </span>
                                <strong style={{ color: '#F1F5F9', fontSize: '0.92rem', fontFamily: 'monospace' }}>
                                  {suite.name}
                                </strong>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                                {suite.passCount} از {suite.totalCount} آزمون موفق {suite.durationMs ? `(${suite.durationMs}ms)` : ''}
                              </span>
                            </div>

                            {/* Assertions */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {(suite.assertions || []).map((ast, aIdx) => (
                                <div key={aIdx} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: 'rgba(255, 255, 255, 0.02)',
                                  padding: '0.4rem 0.75rem',
                                  borderRadius: '8px',
                                  fontSize: '0.82rem'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: ast.status === 'passed' ? '#10B981' : '#EF4444', fontWeight: 800 }}>
                                      {ast.status === 'passed' ? '✓' : '✕'}
                                    </span>
                                    <span style={{ color: ast.status === 'passed' ? '#E2E8F0' : '#FCA5A5' }}>
                                      {ast.title}
                                    </span>
                                  </div>
                                  <span style={{ color: '#64748B', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                    {ast.durationMs || 1}ms
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!systemTestsResult && !systemTestsLoading && (
                    <div style={{
                      textAlign: 'center',
                      padding: '3rem 1.5rem',
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '12px',
                      border: '1px dashed rgba(168, 85, 247, 0.3)'
                    }}>
                      <FlaskConical size={42} style={{ color: '#C084FC', opacity: 0.6, marginBottom: '0.75rem' }} />
                      <h4 style={{ color: '#E2E8F0', margin: '0 0 0.4rem', fontSize: '1.05rem' }}>آزمون‌های خودکار هنوز اجرا نشده‌اند</h4>
                      <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
                        برای تست صحت تبدیل تاریخ‌های شمسی/میلادی، کوئری‌های JQL، نگاشت وضعیت‌ها و کلیه APIها دکمه زیر را کلیک نمایید.
                      </p>
                      <button
                        type="button"
                        onClick={handleRunSystemTests}
                        style={{
                          background: 'linear-gradient(135deg, #9333EA, #7E22CE)',
                          border: 'none',
                          color: '#FFFFFF',
                          padding: '0.6rem 1.5rem',
                          borderRadius: '10px',
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(147, 51, 234, 0.35)'
                        }}
                      >
                        ⚡ شروع آزمون‌های سیستم
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'system_logs' && (
              <motion.div
                key="system_logs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
              >
                {/* 📜 LOGS PANEL HEADER & CONTROLS */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: '16px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
                }}>
                  {/* Top Row: Title, Live Status Badge, and Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        background: 'rgba(6, 182, 212, 0.2)',
                        border: '1px solid #06B6D4',
                        color: '#22D3EE',
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Terminal size={22} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#F1F5F9' }}>
                            لاگ‌های زنده بک‌اند (Live Stream)
                          </h3>
                          {logsLiveStream ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              background: logsStreamStatus === 'connected' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                              color: logsStreamStatus === 'connected' ? '#34D399' : '#FCD34D',
                              padding: '0.22rem 0.75rem',
                              borderRadius: '20px',
                              border: logsStreamStatus === 'connected' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(245, 158, 11, 0.5)',
                              fontSize: '0.76rem',
                              fontWeight: 800
                            }}>
                              <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: logsStreamStatus === 'connected' ? '#10B981' : '#F59E0B',
                                boxShadow: logsStreamStatus === 'connected' ? '0 0 10px #10B981' : '0 0 10px #F59E0B',
                                display: 'inline-block'
                              }} />
                              {logsStreamStatus === 'connected' ? 'استریم زنده متصل (tail -f)' : 'در حال اتصال به سرور...'}
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              background: 'rgba(148, 163, 184, 0.15)',
                              color: '#94A3B8',
                              padding: '0.22rem 0.75rem',
                              borderRadius: '20px',
                              border: '1px solid rgba(148, 163, 184, 0.3)',
                              fontSize: '0.76rem',
                              fontWeight: 700
                            }}>
                              ⏸️ استریم متوقف‌شده
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#94A3B8' }}>
                          پایش زنده کلیه لاگ‌های درخواست‌های HTTP، خطاهای هندل‌شده سرور و عملیات همگام‌سازی جیرا.
                        </p>
                      </div>
                    </div>

                    {/* Toolbar Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setLogsLiveStream(!logsLiveStream)}
                        style={{
                          background: logsLiveStream ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.35))' : 'rgba(255, 255, 255, 0.08)',
                          border: `1px solid ${logsLiveStream ? 'rgba(16, 185, 129, 0.6)' : 'rgba(255, 255, 255, 0.2)'}`,
                          color: logsLiveStream ? '#34D399' : '#FFFFFF',
                          padding: '0.5rem 1rem',
                          borderRadius: '10px',
                          fontSize: '0.84rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          boxShadow: logsLiveStream ? '0 0 15px rgba(16, 185, 129, 0.25)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                        title={logsLiveStream ? 'توقف دریافت زنده لاگ‌ها' : 'شروع دریافت زنده لاگ‌ها (tail -f)'}
                      >
                        {logsLiveStream ? <Pause size={15} /> : <Play size={15} />}
                        <span>{logsLiveStream ? 'توقف استریم' : 'شروع استریم'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setLogsAutoScroll(!logsAutoScroll)}
                        style={{
                          background: logsAutoScroll ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          border: `1px solid ${logsAutoScroll ? 'rgba(6, 182, 212, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
                          color: logsAutoScroll ? '#22D3EE' : '#94A3B8',
                          padding: '0.5rem 0.9rem',
                          borderRadius: '10px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          transition: 'all 0.2s ease'
                        }}
                        title="اسکرول خودکار به آخرین لاگ دریافتی"
                      >
                        <ChevronDown size={15} />
                        <span>اسکرول خودکار: {logsAutoScroll ? 'روشن' : 'خاموش'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={fetchLogs}
                        disabled={logsLoading}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#F1F5F9',
                          padding: '0.5rem 0.9rem',
                          borderRadius: '10px',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                        title="بارگذاری مجدد لاگ‌ها از سرور"
                      >
                        <RefreshCw size={14} className={logsLoading ? 'spin' : ''} />
                        <span>بروزرسانی</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadLogs}
                        disabled={systemLogs.length === 0}
                        style={{
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          color: '#38BDF8',
                          padding: '0.5rem 0.9rem',
                          borderRadius: '10px',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                        title="دانلود لاگ‌های سرور در قالب فایل log"
                      >
                        <Download size={14} />
                        <span>دانلود لاگ</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleClearLogs}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          color: '#F87171',
                          padding: '0.5rem 0.9rem',
                          borderRadius: '10px',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                        title="پاک‌سازی بافر لاگ‌های فعلی سرور"
                      >
                        <Trash2 size={14} />
                        <span>پاک‌سازی</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter Row: Level Filter Pills and Search Input */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {/* Level Pills (Multi-Select Supported) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94A3B8', marginLeft: '0.3rem' }}>فیلتر سطح:</span>
                      {[
                        { key: 'ALL', label: 'همه لاگ‌ها', color: '#94A3B8' },
                        { key: 'ERROR', label: '🔴 ERROR', color: '#EF4444' },
                        { key: 'WARN', label: '🟡 WARN', color: '#F59E0B' },
                        { key: 'INFO', label: '🔵 INFO', color: '#38BDF8' },
                        { key: 'HTTP', label: '🟣 HTTP', color: '#A855F7' },
                        { key: 'DEBUG', label: '⚙️ DEBUG', color: '#10B981' }
                      ].map(lvl => {
                        const isSelected = lvl.key === 'ALL'
                          ? logsLevelFilters.includes('ALL')
                          : logsLevelFilters.includes(lvl.key);

                        return (
                          <button
                            key={lvl.key}
                            type="button"
                            onClick={() => toggleLogsLevelFilter(lvl.key)}
                            style={{
                              padding: '0.28rem 0.75rem',
                              borderRadius: '20px',
                              border: `1px solid ${isSelected ? lvl.color : 'rgba(255, 255, 255, 0.12)'}`,
                              background: isSelected ? `${lvl.color}28` : 'rgba(255, 255, 255, 0.03)',
                              color: isSelected ? (lvl.key === 'ALL' ? '#FFFFFF' : lvl.color) : '#94A3B8',
                              fontSize: '0.76rem',
                              fontWeight: isSelected ? 800 : 500,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              boxShadow: isSelected ? `0 0 12px ${lvl.color}35` : 'none',
                              transition: 'all 0.2s ease'
                            }}
                            title={lvl.key === 'ALL' ? 'نمایش تمام سطوح لاگ' : `انتخاب/لغو فیلتر سطح ${lvl.key}`}
                          >
                            {isSelected && lvl.key !== 'ALL' && <span style={{ fontSize: '0.75rem', fontWeight: 900 }}>✓</span>}
                            {lvl.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Search Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '260px', flex: 1, maxWidth: '400px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        padding: '0.35rem 0.75rem',
                        width: '100%'
                      }}>
                        <Search size={14} color="#64748B" />
                        <input
                          type="text"
                          value={logsSearchTerm}
                          onChange={e => setLogsSearchTerm(e.target.value)}
                          placeholder="جستجو در پیام، کامپوننت یا خطا..."
                          style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#F8FAFC',
                            fontSize: '0.82rem',
                            width: '100%',
                            fontFamily: 'inherit'
                          }}
                        />
                        {logsSearchTerm && (
                          <button
                            type="button"
                            onClick={() => setLogsSearchTerm('')}
                            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🖥️ RETRO-MODERN MONOSPACE TERMINAL CONSOLE */}
                <div style={{
                  background: '#070B13',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6), inset 0 0 15px rgba(6, 182, 212, 0.05)'
                }}>
                  {/* Terminal Window Header Bar */}
                  <div style={{
                    background: '#0F172A',
                    padding: '0.6rem 1rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
                      <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                      <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                      <span style={{ fontSize: '0.78rem', color: '#64748B', fontFamily: 'monospace', marginLeft: '0.75rem' }}>
                        backend@server: tail -f logs/app.log
                      </span>
                    </div>

                    <span style={{ fontSize: '0.75rem', color: '#06B6D4', fontFamily: 'monospace' }}>
                      {(() => {
                        const filtered = systemLogs.filter(l => {
                          if (!logsLevelFilters.includes('ALL') && !logsLevelFilters.includes(l.level)) return false;
                          if (logsSearchTerm) {
                            const q = logsSearchTerm.toLowerCase();
                            return l.message?.toLowerCase().includes(q) || l.tag?.toLowerCase().includes(q) || l.stack?.toLowerCase().includes(q);
                          }
                          return true;
                        });
                        return `${filtered.length} از ${systemLogs.length} لاگ`;
                      })()}
                    </span>
                  </div>

                  {/* Terminal Log Stream Area */}
                  <div
                    ref={logsContainerRef}
                    style={{
                      height: '520px',
                      overflowY: 'auto',
                      padding: '1rem',
                      fontFamily: '"Fira Code", "Cascadia Code", "Courier New", monospace',
                      fontSize: '0.82rem',
                      lineHeight: 1.6,
                      direction: 'ltr',
                      textAlign: 'left'
                    }}
                  >
                    {(() => {
                      const filtered = systemLogs.filter(l => {
                        if (!logsLevelFilters.includes('ALL') && !logsLevelFilters.includes(l.level)) return false;
                        if (logsSearchTerm) {
                          const q = logsSearchTerm.toLowerCase();
                          return l.message?.toLowerCase().includes(q) || l.tag?.toLowerCase().includes(q) || l.stack?.toLowerCase().includes(q);
                        }
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#475569' }}>
                            <FileText size={36} style={{ opacity: 0.4, marginBottom: '0.6rem' }} />
                            <p style={{ margin: 0, fontSize: '0.9rem' }}>هیچ لاگی با فیلترهای انتخابی یافت نشد.</p>
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {filtered.map(l => {
                            const isError = l.level === 'ERROR';
                            const isWarn = l.level === 'WARN';
                            const isHttp = l.level === 'HTTP';
                            const isExpanded = expandedLogId === l.id;

                            const levelColor = isError ? '#EF4444' : isWarn ? '#F59E0B' : isHttp ? '#C084FC' : '#38BDF8';
                            const levelBg = isError ? 'rgba(239, 68, 68, 0.18)' : isWarn ? 'rgba(245, 158, 11, 0.18)' : isHttp ? 'rgba(192, 132, 252, 0.18)' : 'rgba(56, 189, 248, 0.18)';

                            return (
                              <div
                                key={l.id}
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  borderRadius: '6px',
                                  background: isError ? 'rgba(239, 68, 68, 0.06)' : 'transparent',
                                  borderLeft: isError ? '3px solid #EF4444' : isWarn ? '3px solid #F59E0B' : '3px solid transparent',
                                  transition: 'background 0.15s'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', flexWrap: 'wrap' }}>
                                  {/* Timestamp */}
                                  <span style={{ color: '#64748B', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                                    {l.timestamp}
                                  </span>

                                  {/* Level Badge */}
                                  <span style={{
                                    background: levelBg,
                                    color: levelColor,
                                    padding: '0.08rem 0.45rem',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    border: `1px solid ${levelColor}40`,
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {l.level}
                                  </span>

                                  {/* Tag Pill */}
                                  {l.tag && (
                                    <span style={{
                                      background: 'rgba(255, 255, 255, 0.06)',
                                      color: '#CBD5E1',
                                      padding: '0.08rem 0.4rem',
                                      borderRadius: '4px',
                                      fontSize: '0.72rem',
                                      whiteSpace: 'nowrap'
                                    }}>
                                      [{l.tag}]
                                    </span>
                                  )}

                                  {/* Message */}
                                  <span style={{
                                    color: isError ? '#FCA5A5' : isWarn ? '#FDE68A' : isHttp ? '#E9D5FF' : '#E2E8F0',
                                    wordBreak: 'break-all',
                                    flex: 1
                                  }}>
                                    {l.message}
                                  </span>

                                  {/* Stack trace toggle if available */}
                                  {l.stack && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedLogId(isExpanded ? null : l.id)}
                                      style={{
                                        background: 'rgba(239, 68, 68, 0.2)',
                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                        color: '#F87171',
                                        borderRadius: '4px',
                                        padding: '0.1rem 0.4rem',
                                        fontSize: '0.7rem',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      {isExpanded ? 'بستن استک' : '🔍 Stack'}
                                    </button>
                                  )}
                                </div>

                                {/* Expanded Stack Trace */}
                                {isExpanded && l.stack && (
                                  <pre style={{
                                    margin: '0.4rem 0 0.2rem 2rem',
                                    padding: '0.6rem 0.8rem',
                                    background: 'rgba(0, 0, 0, 0.5)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '6px',
                                    color: '#F87171',
                                    fontSize: '0.74rem',
                                    overflowX: 'auto',
                                    whiteSpace: 'pre-wrap'
                                  }}>
                                    {l.stack}
                                  </pre>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #F59E0B', width: '44px', height: '44px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FBBF24', fontSize: '1.3rem' }}>
                    🔍
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC' }}>
                      بررسی دقیق موارد اختلاف Jira و دیتابیس لوکال
                    </h3>
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.3rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                      <span style={{ color: '#94A3B8' }}>بر اساس همان کوئری‌های جدول مقایسه ({mismatchModalData.rebuildMonths || 3} ماهه)</span>
                      <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#FBBF24', padding: '0.1rem 0.5rem', borderRadius: '6px', fontWeight: 800 }}>
                        ⚠️ کل اختلافات: {mismatchModalData.mismatchCount || 0} مورد
                      </span>
                      {mismatchModalData.missingCount > 0 && (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#FCA5A5', padding: '0.1rem 0.5rem', borderRadius: '6px', fontWeight: 800 }}>
                          📥 جامانده در دیتابیس: {mismatchModalData.missingCount} تسک
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {/* Batch Delete DB-Only Items Button */}
                  {(() => {
                    const dbOnlyItems = (mismatchModalData.mismatches || []).filter(i => i.mismatchType === 'DB_ONLY');
                    if (dbOnlyItems.length === 0) return null;
                    return (
                      <button
                        type="button"
                        onClick={handleDeleteDbOnlyTasks}
                        disabled={deletingDbOnly}
                        style={{
                          background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                          border: 'none',
                          color: '#FFFFFF',
                          padding: '0.5rem 1.15rem',
                          borderRadius: '10px',
                          fontSize: '0.84rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          boxShadow: '0 3px 12px rgba(239, 68, 68, 0.4)'
                        }}
                      >
                        <Trash2 size={14} className={deletingDbOnly ? 'spin' : ''} />
                        <span>{deletingDbOnly ? 'در حال حذف...' : `🗑️ حذف ${dbOnlyItems.length} مورد اضافی از دیتابیس`}</span>
                      </button>
                    );
                  })()}

                  {(mismatchModalData.missingCount > 0 || (mismatchModalData.missingKeys && mismatchModalData.missingKeys.length > 0)) && (
                    <button
                      type="button"
                      onClick={handleSyncMissingTasks}
                      disabled={syncingMissing}
                      style={{
                        background: 'linear-gradient(135deg, #10B981, #059669)',
                        border: 'none',
                        color: '#FFFFFF',
                        padding: '0.5rem 1.15rem',
                        borderRadius: '10px',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        boxShadow: '0 3px 12px rgba(16, 185, 129, 0.4)'
                      }}
                    >
                      <RefreshCw size={14} className={syncingMissing ? 'spin' : ''} />
                      <span>{syncingMissing ? 'در حال ذخیره‌سازی...' : `⚡ ذخیره و سینک ${mismatchModalData.missingCount || mismatchModalData.missingKeys.length} مورد اختلاف در دیتابیس`}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setMismatchModalData(null)}
                    style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#94A3B8', borderRadius: '10px', padding: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.82rem', color: '#94A3B8' }}>
                  فهرست زیر صرفاً شامل مواردی است که میان نتایج کوئری جیرا و دیتابیس لوکال تفاوت دارند:
                </div>

                <input
                  type="text"
                  value={mismatchSearch}
                  onChange={e => setMismatchSearch(e.target.value)}
                  placeholder="🔍 فیلتر سریع (شناسه، عنوان یا وضعیت)..."
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

              {/* Clean Differences Table */}
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.5)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#1E293B', color: '#F1F5F9', borderBottom: '2px solid rgba(245, 158, 11, 0.5)', position: 'sticky', top: 0, zIndex: 10 }}>
                      <th style={{ padding: '0.75rem 0.9rem', width: '110px', color: '#38BDF8', fontWeight: 800 }}>شناسه کلید</th>
                      <th style={{ padding: '0.75rem 0.9rem', width: '95px', color: '#C084FC', fontWeight: 800 }}>نوع</th>
                      <th style={{ padding: '0.75rem 0.9rem', color: '#F1F5F9', fontWeight: 800 }}>عنوان در Jira / DB</th>
                      <th style={{ padding: '0.75rem 0.9rem', width: '130px', color: '#38BDF8', fontWeight: 800 }}>وضعیت در Jira</th>
                      <th style={{ padding: '0.75rem 0.9rem', width: '130px', color: '#C084FC', fontWeight: 800 }}>وضعیت در DB</th>
                      <th style={{ padding: '0.75rem 0.9rem', color: '#FBBF24', fontWeight: 800 }}>نوع و شرح اختلاف</th>
                      <th style={{ padding: '0.75rem 0.9rem', width: '130px', textAlign: 'center', color: '#6EE7B7', fontWeight: 800 }}>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const list = (mismatchModalData.mismatches || []).filter(item => {
                        if (mismatchSearch.trim()) {
                          const q = mismatchSearch.trim().toLowerCase();
                          const matchId = (item.id || '').toLowerCase().includes(q);
                          const matchTitle = (item.title || '').toLowerCase().includes(q);
                          const matchReason = (item.reason || '').toLowerCase().includes(q);
                          const matchJira = (item.jiraStatus || '').toLowerCase().includes(q);
                          const matchDb = (item.dbStatus || '').toLowerCase().includes(q);
                          if (!matchId && !matchTitle && !matchReason && !matchJira && !matchDb) return false;
                        }
                        return true;
                      });

                      if (list.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: '#6EE7B7', fontWeight: 700 }}>
                              🎉 هیچ موردی دارای اختلاف نیست! تمام داده‌های این بخش بین جیرا و دیتابیس ۱۰۰٪ منطبق و یکپارچه هستند.
                            </td>
                          </tr>
                        );
                      }

                      return list.map((item, idx) => {
                        const isMissingInDb = item.mismatchType === 'JIRA_ONLY';
                        const isThisSyncing = syncingKey === item.id;
                        return (
                          <tr key={item.id || idx} style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            background: isMissingInDb ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.06)'
                          }}>
                            <td style={{ padding: '0.65rem 0.9rem', fontFamily: 'monospace', fontWeight: 800, color: isMissingInDb ? '#F87171' : '#38BDF8' }}>
                              {item.id}
                            </td>
                            <td style={{ padding: '0.65rem 0.9rem', color: '#C084FC', fontWeight: 600 }}>
                              {item.issueType || 'Task'}
                            </td>
                            <td style={{ padding: '0.65rem 0.9rem', fontWeight: 600, color: '#E2E8F0' }}>
                              {item.title}
                            </td>
                            <td style={{ padding: '0.65rem 0.9rem' }}>
                              <span style={{
                                padding: '0.15rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: item.jiraStatus.includes('🔴') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                                color: item.jiraStatus.includes('🔴') ? '#FCA5A5' : '#38BDF8'
                              }}>
                                {item.jiraStatus}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.9rem' }}>
                              <span style={{
                                padding: '0.15rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: item.dbStatus.includes('🔴') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(192, 132, 252, 0.2)',
                                color: item.dbStatus.includes('🔴') ? '#FCA5A5' : '#C084FC'
                              }}>
                                {item.dbStatus}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.9rem', fontSize: '0.78rem', color: isMissingInDb ? '#FCA5A5' : '#FBBF24', lineHeight: '1.5' }}>
                              {item.reason}
                            </td>
                            <td style={{ padding: '0.65rem 0.9rem', textAlign: 'center' }}>
                              {isMissingInDb ? (
                                <button
                                  type="button"
                                  onClick={() => handleSyncSingleKey(item.id)}
                                  disabled={isThisSyncing || syncingMissing}
                                  style={{
                                    background: 'linear-gradient(135deg, #10B981, #059669)',
                                    border: 'none',
                                    color: '#FFFFFF',
                                    padding: '0.3rem 0.75rem',
                                    borderRadius: '8px',
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
                                  }}
                                  title={`ذخیره مستقیم فقط تسک ${item.id} در دیتابیس`}
                                >
                                  <RefreshCw size={11} className={isThisSyncing ? 'spin' : ''} />
                                  <span>{isThisSyncing ? 'در حال ذخیره...' : '⚡ ذخیره در DB'}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSingleKey(item.id)}
                                  disabled={deletingKey === item.id || deletingDbOnly}
                                  style={{
                                    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                                    border: 'none',
                                    color: '#FFFFFF',
                                    padding: '0.3rem 0.75rem',
                                    borderRadius: '8px',
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.35)'
                                  }}
                                  title={`حذف فقط تسک ${item.id} از دیتابیس لوکال`}
                                >
                                  <Trash2 size={11} className={deletingKey === item.id ? 'spin' : ''} />
                                  <span>{deletingKey === item.id ? 'در حال حذف...' : '🗑️ حذف از DB'}</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                  💡 با زدن دکمه سبز رنگ بالا، تسک‌های جامانده به صورت هدفمند و مستقیم در دیتابیس ثبت می‌گردند.
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

      {/* ⏰ JIRA SYNC SCHEDULER CONFIGURATION MODAL */}
      <AnimatePresence>
        {showSchedulerModal && (
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
          }} onClick={() => setShowSchedulerModal(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98))',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                boxShadow: '0 25px 70px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(56, 189, 248, 0.2)',
                borderRadius: '24px',
                padding: '1.85rem',
                maxWidth: '620px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                color: '#F8FAFC',
                direction: 'rtl'
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '14px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38BDF8'
                  }}>
                    <Clock size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#F8FAFC' }}>
                      زمان‌بندی همگام‌سازی خودکار دیتابیس با جیرا
                    </h3>
                    <span style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '0.2rem', display: 'inline-block' }}>
                      اجرای منظم و خودکار به‌روزرسانی داده‌های جیرا در پس‌زمینه سرور
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSchedulerModal(false)}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveScheduler}>
                {/* 1. Master Toggle */}
                <div style={{
                  background: schedulerForm.enabled ? 'rgba(14, 165, 233, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  border: schedulerForm.enabled ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                  transition: 'all 0.2s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: schedulerForm.enabled ? '#34D399' : '#94A3B8',
                      boxShadow: schedulerForm.enabled ? '0 0 10px #34D399' : 'none'
                    }} />
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: '#FFFFFF' }}>وضعیت زمان‌بندی خودکار:</strong>
                      <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: '2px' }}>
                        {schedulerForm.enabled ? 'همگام‌سازی طبق زمان و بازه انتخابی در سرور فعال است.' : 'همگام‌سازی خودکار غیرفعال است (فقط دستی).'}
                      </div>
                    </div>
                  </div>

                  <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={schedulerForm.enabled}
                      onChange={e => setSchedulerForm({ ...schedulerForm, enabled: e.target.checked })}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: schedulerForm.enabled ? '#0284C7' : 'rgba(255, 255, 255, 0.2)',
                      borderRadius: '34px',
                      transition: '0.3s'
                    }}>
                      <span style={{
                        position: 'absolute',
                        height: '20px',
                        width: '20px',
                        left: schedulerForm.enabled ? '25px' : '3px',
                        bottom: '3px',
                        background: '#FFFFFF',
                        borderRadius: '50%',
                        transition: '0.3s'
                      }} />
                    </span>
                  </label>
                </div>

                {/* 2. Frequency Mode Selection */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '1.15rem',
                  marginBottom: '1.25rem'
                }}>
                  <label style={{ fontSize: '0.86rem', fontWeight: 800, color: '#38BDF8', display: 'block', marginBottom: '0.75rem' }}>
                    ⏰ الگوی زمان اجرا (Schedule Mode):
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => setSchedulerForm({ ...schedulerForm, mode: 'daily' })}
                      style={{
                        padding: '0.65rem 0.9rem',
                        borderRadius: '12px',
                        border: schedulerForm.mode === 'daily' ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: schedulerForm.mode === 'daily' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                        color: schedulerForm.mode === 'daily' ? '#FFFFFF' : '#94A3B8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>🌙 روزانه در ساعت مشخص</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSchedulerForm({ ...schedulerForm, mode: 'interval' })}
                      style={{
                        padding: '0.65rem 0.9rem',
                        borderRadius: '12px',
                        border: schedulerForm.mode === 'interval' ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: schedulerForm.mode === 'interval' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                        color: schedulerForm.mode === 'interval' ? '#FFFFFF' : '#94A3B8',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>⏱️ دوره‌ای (هر چند ساعت)</span>
                    </button>
                  </div>

                  {schedulerForm.mode === 'daily' ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.82rem', color: '#E2E8F0' }}>ساعت اجرای هر شب:</span>
                        <input
                          type="time"
                          value={schedulerForm.time || '02:00'}
                          onChange={e => setSchedulerForm({ ...schedulerForm, time: e.target.value })}
                          style={{
                            background: '#0F172A',
                            border: '1px solid #38BDF8',
                            color: '#38BDF8',
                            borderRadius: '10px',
                            padding: '0.4rem 0.85rem',
                            fontSize: '1rem',
                            fontWeight: 800,
                            direction: 'ltr',
                            outline: 'none'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {['01:00', '02:00', '03:00', '04:00'].map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setSchedulerForm({ ...schedulerForm, time: t })}
                              style={{
                                background: schedulerForm.time === t ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: schedulerForm.time === t ? '#38BDF8' : '#CBD5E1',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: '#94A3B8', marginTop: '0.5rem', display: 'block' }}>
                        💡 پیشنهاد: ساعت ۲ الی ۴ بامداد خلوت‌ترین زمان سرور جیرا و شبکه می‌باشد.
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.82rem', color: '#E2E8F0' }}>فاصله تکرار:</span>
                        {[1, 2, 3, 6, 12].map(hrs => (
                          <button
                            key={hrs}
                            type="button"
                            onClick={() => setSchedulerForm({ ...schedulerForm, interval_hours: hrs })}
                            style={{
                              background: schedulerForm.interval_hours === hrs ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                              border: schedulerForm.interval_hours === hrs ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.15)',
                              color: schedulerForm.interval_hours === hrs ? '#38BDF8' : '#CBD5E1',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '8px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            هر {hrs} ساعت
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Data Range / Timeframe Selection */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '1.15rem',
                  marginBottom: '1.25rem'
                }}>
                  <label style={{ fontSize: '0.86rem', fontWeight: 800, color: '#38BDF8', display: 'block', marginBottom: '0.75rem' }}>
                    📅 بازه زمانی استخراج داده از جیرا (Sync Timeframe):
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
                    {[
                      { type: 'incremental', months: 0, label: '🚀 ۱۰ روز اخیر (سریع)', desc: 'تغییرات اخیر' },
                      { type: 'timeframe', months: 1, label: '۱ ماه اخیر', desc: '۱ ماه گذشته' },
                      { type: 'timeframe', months: 3, label: '۳ ماه اخیر', desc: 'فصل جاری' },
                      { type: 'timeframe', months: 6, label: '🌟 ۶ ماه اخیر', desc: 'پیشنهادی' },
                      { type: 'timeframe', months: 12, label: '۱۲ ماه اخیر', desc: 'یک سال گذشته' },
                      { type: 'full', months: 0, label: '⚡ بازسازی کامل', desc: 'تمام تاریخچه' }
                    ].map(opt => {
                      const isSelected = schedulerForm.sync_type === opt.type && (opt.type !== 'timeframe' || schedulerForm.timeframe_months === opt.months);
                      return (
                        <div
                          key={opt.label}
                          onClick={() => setSchedulerForm({
                            ...schedulerForm,
                            sync_type: opt.type,
                            timeframe_months: opt.months || schedulerForm.timeframe_months
                          })}
                          style={{
                            background: isSelected ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                            border: isSelected ? '1px solid #34D399' : '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            padding: '0.65rem 0.75rem',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <strong style={{ fontSize: '0.82rem', color: isSelected ? '#34D399' : '#FFFFFF', display: 'block' }}>
                            {opt.label}
                          </strong>
                          <span style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '2px', display: 'block' }}>
                            {opt.desc}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Live Status Panel */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '14px',
                  padding: '0.85rem 1rem',
                  fontSize: '0.78rem',
                  color: '#94A3B8',
                  marginBottom: '1.5rem',
                  lineHeight: '1.6'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span>
                      وضعیت آخرین اجرا: 
                      <strong style={{
                        color: schedulerConfig?.last_status === 'running' ? '#FBBF24' : schedulerConfig?.last_status === 'success' ? '#34D399' : schedulerConfig?.last_status === 'error' ? '#EF4444' : '#94A3B8',
                        marginRight: '6px'
                      }}>
                        {schedulerConfig?.last_status === 'running' ? '⏳ در حال اجرا...' : schedulerConfig?.last_status === 'success' ? '✅ موفق' : schedulerConfig?.last_status === 'error' ? '❌ خطا' : '⚪ در انتظار'}
                      </strong>
                    </span>
                    {schedulerConfig?.last_run && (
                      <span style={{ fontSize: '0.72rem', color: '#CBD5E1', direction: 'ltr' }}>
                        {new Date(schedulerConfig.last_run).toLocaleString('fa-IR')}
                      </span>
                    )}
                  </div>
                  {schedulerConfig?.last_message && (
                    <div style={{ color: '#CBD5E1', fontSize: '0.74rem' }}>
                      {schedulerConfig.last_message}
                    </div>
                  )}
                </div>

                {/* Modal Footer Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
                  <button
                    type="button"
                    onClick={handleRunSchedulerNow}
                    disabled={schedulerRunLoading || schedulerConfig?.is_running}
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                      color: '#38BDF8',
                      padding: '0.55rem 1.1rem',
                      borderRadius: '12px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: (schedulerRunLoading || schedulerConfig?.is_running) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem'
                    }}
                  >
                    <RefreshCw size={14} className={(schedulerRunLoading || schedulerConfig?.is_running) ? 'spin' : ''} />
                    <span>{schedulerRunLoading ? 'در حال ارسال دستور...' : 'اجرای آزمایشی الان'}</span>
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowSchedulerModal(false)}
                      style={{
                        padding: '0.55rem 1.25rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: '#94A3B8',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      disabled={schedulerSaving}
                      style={{
                        padding: '0.55rem 1.5rem',
                        borderRadius: '12px',
                        border: '1px solid rgba(52, 211, 153, 0.5)',
                        background: 'linear-gradient(135deg, #10B981, #059669)',
                        boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                        color: '#FFFFFF',
                        fontSize: '0.84rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem'
                      }}
                    >
                      <Save size={15} />
                      <span>{schedulerSaving ? 'در حال ذخیره...' : 'ذخیره تنظیمات زمان‌بندی'}</span>
                    </button>
                  </div>
                </div>
              </form>
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
