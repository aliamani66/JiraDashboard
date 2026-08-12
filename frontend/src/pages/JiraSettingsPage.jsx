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
      showToast('در حال دریافت لیست پروژه‌های موجود در Jira...');
      const res = await api.fetchJiraProjects();
      if (res.projects && res.projects.length > 0) {
        setDiscoveredProjects(res.projects);
        showToast(`${res.projects.length} پروژه از سرور Jira به همراه نام کامل شناسایی گردید.`);
      } else {
        showToast('پروژه‌ای دریافت نشد. لطفاً آدرس و توکن جیرا را بررسی بفرمایید.', 'error');
      }
    } catch (e) {
      showToast('خطا در دریافت پروژه‌ها از Jira: ' + (e.message || ''), 'error');
    } finally {
      setFetchingProjects(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await api.saveJiraConfig(cfg);
      showToast(res.message || 'تنظیمات و کلید جدید پروژه با موفقیت ذخیره و به صورت زنده اعمال گردید.');
    } catch (e) {
      showToast('خطا در ذخیره تنظیمات: ' + (e.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      showToast(`در حال ذخیره تنظیمات و دریافت داده‌های پروژه (${cfg?.connection?.projectKey || 'اصلی'})...`);
      // Auto-save current config first so newly entered Project Key is immediately active
      await api.saveJiraConfig(cfg);
      // Execute live sync from Jira
      const res = await api.resetDatabase();
      showToast(res.message || 'همگام‌سازی با موفقیت انجام گردید.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      showToast('خطا در همگام‌سازی با Jira: ' + (e.message || ''), 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDiagnose = async () => {
    try {
      setDiagLoading(true);
      setDiagResult(null);
      const res = await api.runJiraDiagnostic(cfg?.connection || {});
      setDiagResult(res);
    } catch (e) {
      setDiagResult({ success: false, message: e.message });
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
          <button className="jsp-run-diag-btn" style={{ background: '#0EA5E9' }} onClick={handleSync} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'spin' : ''} />
            {syncing ? 'در حال دریافت...' : '🔄 همگام‌سازی با Jira'}
          </button>
          <button className="jsp-run-diag-btn" onClick={handleSave} disabled={saving}>
            <Save size={16} className={saving ? 'spin' : ''} />
            {saving ? 'در حال ذخیره...' : '💾 ذخیره تنظیمات'}
          </button>
        </div>
      </div>

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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.25)', padding: '0.85rem', borderRadius: '12px', border: '1px solid var(--glass-border)', maxHeight: '180px', overflowY: 'auto' }}>
                {discoveredProjects.map(p => {
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
                    </button>
                  );
                })}
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
                        {k} {found ? `(${found.name})` : ''}
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
          <Field label="فیلد Sprint" hint="معمولاً customfield_10020">
            <Input value={cfg.customFields?.sprintField} onChange={v => set('customFields', 'sprintField', v)} placeholder="customfield_10020" mono />
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
