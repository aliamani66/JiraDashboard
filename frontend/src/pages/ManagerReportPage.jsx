import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, AlertTriangle, Clock, Calendar, CheckCircle2,
  FileText, Search, Printer, RotateCcw, Zap, ExternalLink,
  ShieldCheck, Layers, Users, Activity, Tag, ArrowUpRight
} from 'lucide-react';
import { api } from '../services/api';
import './ManagerReportPage.css';

const ManagerReportPage = () => {
  const [data, setData] = useState({ stats: {}, tasks: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [auditTypeFilter, setAuditTypeFilter] = useState('all'); // 'all', 'orphan', 'no_sprint', 'no_estimate', 'no_due_date'
  const [selectedProjectKeys, setSelectedProjectKeys] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchAuditReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getManagerAuditReport();
      if (res && res.success) {
        setData(res);
      } else {
        setError(res.message || 'خطا در دریافت گزارش ممیزی مدیر');
      }
    } catch (e) {
      setError(e.message || 'ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditReport();
  }, []);

  // Collect available Jira Project Keys dynamically
  const availableProjectKeys = useMemo(() => {
    const keys = new Set();
    (data.tasks || []).forEach(t => {
      if (t.project_key) keys.add(t.project_key);
    });
    return Array.from(keys).sort();
  }, [data.tasks]);

  const toggleProjectKey = (key) => {
    setSelectedProjectKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Filter tasks based on audit type, project key, and search query
  const filteredTasks = useMemo(() => {
    return (data.tasks || []).filter(t => {
      // 1. Audit Type Filter
      if (auditTypeFilter === 'orphan' && !t.is_orphan) return false;
      if (auditTypeFilter === 'no_sprint' && !t.is_no_sprint) return false;
      if (auditTypeFilter === 'no_estimate' && !t.is_no_estimate) return false;
      if (auditTypeFilter === 'no_due_date' && !t.is_no_due_date) return false;
      if (auditTypeFilter === 'revised' && !t.is_estimate_revised) return false;

      // 2. Project Key Filter
      if (selectedProjectKeys.length > 0 && !selectedProjectKeys.includes(t.project_key)) {
        return false;
      }

      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchKey = (t.id || '').toLowerCase().includes(q);
        const matchTitle = (t.title || '').toLowerCase().includes(q);
        const matchAssignee = (t.assignee || '').toLowerCase().includes(q);
        const matchEpic = (t.epic_title || '').toLowerCase().includes(q);
        if (!matchKey && !matchTitle && !matchAssignee && !matchEpic) return false;
      }

      return true;
    });
  }, [data.tasks, auditTypeFilter, selectedProjectKeys, searchQuery]);

  // Aggregate Metrics for Currently Filtered View
  const filteredMetrics = useMemo(() => {
    let spentSum = 0;
    let estSum = 0;
    let orphanCount = 0;
    let noSprintCount = 0;
    let noEstimateCount = 0;
    let noDueDateCount = 0;
    let revisedCount = 0;

    filteredTasks.forEach(t => {
      spentSum += (t.spent_hours || 0);
      estSum += (t.estimate_hours || 0);
      if (t.is_orphan) orphanCount++;
      if (t.is_no_sprint) noSprintCount++;
      if (t.is_no_estimate) noEstimateCount++;
      if (t.is_no_due_date) noDueDateCount++;
      if (t.is_estimate_revised) revisedCount++;
    });

    return {
      total: filteredTasks.length,
      spentSum: Math.round(spentSum * 10) / 10,
      estSum: Math.round(estSum * 10) / 10,
      orphanCount,
      noSprintCount,
      noEstimateCount,
      noDueDateCount,
      revisedCount
    };
  }, [filteredTasks]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="mr-loading-screen">
        <Activity size={32} className="spin text-accent-cyan" />
        <span>در حال آنالیز داده‌ها و آماده‌سازی گزارش ممیزی مدیر...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mr-error-screen glass-card">
        <AlertTriangle size={42} className="text-accent-red" />
        <h3>خطا در دریافت گزارش مدیر</h3>
        <p>{error}</p>
        <button onClick={fetchAuditReport} className="mr-retry-btn">
          <RotateCcw size={16} />
          تلاش مجدد
        </button>
      </div>
    );
  }

  const { stats } = data;

  return (
    <motion.div
      className="manager-report-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* ─── Header Banner ─────────────────────────────────────────────── */}
      <div className="mr-header glass-card">
        <div className="mr-header-main">
          <div className="mr-header-icon-wrap">
            <BarChart3 size={26} className="text-accent-cyan" />
          </div>
          <div>
            <h1 className="mr-title">گزارش ممیزی مدیر (Executive Audit Report)</h1>
            <p className="mr-subtitle">
              پایش کیفیت ثبت اطلاعات، تغییرات استیمیت، تسک‌های خارج از اسپرینت، فاقد تخمین/سررسید و تسک‌های خارج از اپیک به همراه مجموع ساعت کارکرد
            </p>
          </div>
        </div>

        <div className="mr-header-actions">
          <button className="mr-print-btn" onClick={handlePrint} title="چاپ یا ذخیره گزارش مدیریتی به عنوان PDF">
            <Printer size={16} />
            <span>چاپ و خروجی PDF</span>
          </button>
        </div>
      </div>

      {/* ─── Top KPI Cards ─────────────────────────────────────────────── */}
      <div className="mr-kpi-grid">
        
        {/* KPI 1: Orphan Tasks */}
        <div className={`mr-kpi-card glass-card ${auditTypeFilter === 'orphan' ? 'active-kpi' : ''}`} onClick={() => setAuditTypeFilter('orphan')}>
          <div className="mr-kpi-top">
            <span className="mr-kpi-label">📂 تسک‌های بدون اپیک (خارج از اپیک)</span>
            <div className="mr-kpi-badge warning">
              <AlertTriangle size={14} />
            </div>
          </div>
          <div className="mr-kpi-value">{stats.orphanCount || 0} <small>تسک</small></div>
          <div className="mr-kpi-subtext">
            <span>⏱️ <strong>{stats.orphanSpentHours || 0}h</strong> کارکرد ثبت‌شده بدون اپیک</span>
          </div>
        </div>

        {/* KPI 2: Revised Estimate Tasks */}
        <div className={`mr-kpi-card glass-card ${auditTypeFilter === 'revised' ? 'active-kpi' : ''}`} onClick={() => setAuditTypeFilter('revised')}>
          <div className="mr-kpi-top">
            <span className="mr-kpi-label">📈 تغییرات استیمیت (دست‌خورده)</span>
            <div className="mr-kpi-badge orange">
              <Zap size={14} />
            </div>
          </div>
          <div className="mr-kpi-value">{stats.estimateRevisionCount || 0} <small>تسک</small></div>
          <div className="mr-kpi-subtext">
            <span>تسک‌های دارای تغییر و نوسان تخمین زمان</span>
          </div>
        </div>

        {/* KPI 3: No Sprint Tasks */}
        <div className={`mr-kpi-card glass-card ${auditTypeFilter === 'no_sprint' ? 'active-kpi' : ''}`} onClick={() => setAuditTypeFilter('no_sprint')}>
          <div className="mr-kpi-top">
            <span className="mr-kpi-label">🏃 تسک‌های خارج از اسپرینت</span>
            <div className="mr-kpi-badge info">
              <Clock size={14} />
            </div>
          </div>
          <div className="mr-kpi-value">{stats.noSprintCount || 0} <small>تسک</small></div>
          <div className="mr-kpi-subtext">
            <span>تخصیص نیافته به هیچ اسپرینتی</span>
          </div>
        </div>

        {/* KPI 4: No Estimate Tasks */}
        <div className={`mr-kpi-card glass-card ${auditTypeFilter === 'no_estimate' ? 'active-kpi' : ''}`} onClick={() => setAuditTypeFilter('no_estimate')}>
          <div className="mr-kpi-top">
            <span className="mr-kpi-label">⏱️ تسک‌های بدون تخمین زمان</span>
            <div className="mr-kpi-badge danger">
              <AlertTriangle size={14} />
            </div>
          </div>
          <div className="mr-kpi-value">{stats.noEstimateCount || 0} <small>تسک</small></div>
          <div className="mr-kpi-subtext">
            <span>فاقد Estimate مشخص اولیه</span>
          </div>
        </div>

        {/* KPI 5: No Due Date Tasks */}
        <div className={`mr-kpi-card glass-card ${auditTypeFilter === 'no_due_date' ? 'active-kpi' : ''}`} onClick={() => setAuditTypeFilter('no_due_date')}>
          <div className="mr-kpi-top">
            <span className="mr-kpi-label">📅 تسک‌های بدون تاریخ سررسید</span>
            <div className="mr-kpi-badge purple">
              <Calendar size={14} />
            </div>
          </div>
          <div className="mr-kpi-value">{stats.noDueDateCount || 0} <small>تسک</small></div>
          <div className="mr-kpi-subtext">
            <span>زمان‌بندی پایانی تعیین نشده</span>
          </div>
        </div>

      </div>

      {/* ─── Audit Filter Control Panel ────────────────────────────────── */}
      <div className="mr-filter-panel glass-card">
        <div className="mr-fp-row">

          {/* Audit Category Filter Pills */}
          <div className="mr-fp-group">
            <span className="mr-fp-title"><ShieldCheck size={16} /> فیلتر موضوعی اختلال:</span>
            <div className="mr-pills-wrap">
              <button
                className={`mr-pill ${auditTypeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setAuditTypeFilter('all')}
              >
                🌐 همه اختلالات ({data.tasks?.length || 0})
              </button>
              <button
                className={`mr-pill ${auditTypeFilter === 'orphan' ? 'active warning' : ''}`}
                onClick={() => setAuditTypeFilter('orphan')}
              >
                📂 بدون اپیک ({stats.orphanCount || 0})
              </button>
              <button
                className={`mr-pill ${auditTypeFilter === 'revised' ? 'active orange' : ''}`}
                onClick={() => setAuditTypeFilter('revised')}
              >
                📈 تغییر استیمیت ({stats.estimateRevisionCount || 0})
              </button>
              <button
                className={`mr-pill ${auditTypeFilter === 'no_sprint' ? 'active info' : ''}`}
                onClick={() => setAuditTypeFilter('no_sprint')}
              >
                🏃 بدون اسپرینت ({stats.noSprintCount || 0})
              </button>
              <button
                className={`mr-pill ${auditTypeFilter === 'no_estimate' ? 'active danger' : ''}`}
                onClick={() => setAuditTypeFilter('no_estimate')}
              >
                ⏱️ بدون تخمین ({stats.noEstimateCount || 0})
              </button>
              <button
                className={`mr-pill ${auditTypeFilter === 'no_due_date' ? 'active purple' : ''}`}
                onClick={() => setAuditTypeFilter('no_due_date')}
              >
                📅 بدون سررسید ({stats.noDueDateCount || 0})
              </button>
            </div>
          </div>

          {/* Jira Project Key Pills */}
          {availableProjectKeys.length > 0 && (
            <div className="mr-fp-group" style={{ marginTop: '0.85rem' }}>
              <span className="mr-fp-title"><Layers size={16} /> فیلتر پروژه جیرا:</span>
              <div className="mr-pills-wrap scrollable">
                {availableProjectKeys.map(key => {
                  const isSel = selectedProjectKeys.includes(key);
                  return (
                    <button
                      key={key}
                      className={`mr-pill ${isSel ? 'active project-key-pill' : ''}`}
                      onClick={() => toggleProjectKey(key)}
                    >
                      {isSel ? '✅' : '➕'} پروژه {key}
                    </button>
                  );
                })}
                {selectedProjectKeys.length > 0 && (
                  <button className="mr-clear-btn" onClick={() => setSelectedProjectKeys([])}>
                    پاک‌سازی ({selectedProjectKeys.length})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Search Box */}
          <div className="mr-search-box-wrap" style={{ marginTop: '0.85rem' }}>
            <div className="mr-search-box">
              <Search size={15} className="mr-search-icon" />
              <input
                type="text"
                placeholder="جستجوی عنوان تسک، مسئول، شناسه یا اپیک..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="mr-search-input"
              />
              {searchQuery && (
                <button className="mr-search-clear" onClick={() => setSearchQuery('')}>×</button>
              )}
            </div>

            <div className="mr-summary-tag">
              نمایش <strong>{filteredTasks.length}</strong> از <strong>{data.tasks?.length || 0}</strong> تسک | مجموع کارکرد: <strong>{filteredMetrics.spentSum} ساعت</strong>
            </div>
          </div>

        </div>
      </div>

      {/* ─── Task Audit Results Table ───────────────────────────────────── */}
      <div className="mr-results-card glass-card">
        <div className="mr-rc-header">
          <h3>
            <FileText size={18} className="text-accent-cyan" />
            فهرست تسک‌های استخراج‌شده بر اساس فیلترهای ممیزی
          </h3>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="mr-empty-state">
            <CheckCircle2 size={48} className="text-accent-green" />
            <h4>هیچ تسکی با این ترکیب فیلتر یافت نشد.</h4>
            <p>تمام تسک‌های این بخش مطابق با استانداردهای تعریف‌شده می‌باشند.</p>
          </div>
        ) : (
          <div className="mr-table-responsive">
            <table className="mr-audit-table">
              <thead>
                <tr>
                  <th>شناسه تسک</th>
                  <th>عنوان تسک</th>
                  <th>اپیک / پروژه مرجع</th>
                  <th>مسئول (Assignee)</th>
                  <th>اسپرینت</th>
                  <th>تخمین اولیه</th>
                  <th>کارکرد (Spent)</th>
                  <th>تاریخ سررسید</th>
                  <th>اختلالات شناسایی‌شده</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(t => {
                  const issueBadges = [];
                  if (t.is_orphan) issueBadges.push({ label: '📂 بدون اپیک', type: 'warning' });
                  
                  if (t.is_estimate_revised) {
                    if (t.total_delta > 0) {
                      issueBadges.push({
                        label: `📈 استیمیت ${Math.abs(t.total_delta)}h افزایش یافت (${t.initial_estimate}h ➔ ${t.estimate_hours}h - ${t.revision_count} بار ویرایش)`,
                        type: 'danger'
                      });
                    } else if (t.total_delta < 0) {
                      issueBadges.push({
                        label: `📉 استیمیت ${Math.abs(t.total_delta)}h کاهش یافت (${t.initial_estimate}h ➔ ${t.estimate_hours}h - ${t.revision_count} بار ویرایش)`,
                        type: 'green'
                      });
                    } else {
                      issueBadges.push({
                        label: `🔄 استیمیت دست‌خورده (${t.revision_count} بار ویرایش)`,
                        type: 'orange'
                      });
                    }
                  }

                  if (t.is_no_sprint) issueBadges.push({ label: '🏃 بدون اسپرینت', type: 'info' });
                  if (t.is_no_estimate) issueBadges.push({ label: '⏱️ بدون تخمین اولیه', type: 'danger' });
                  if (t.is_no_due_date) issueBadges.push({ label: '📅 بدون تاریخ سررسید', type: 'purple' });

                  return (
                    <tr key={t.id}>
                      <td className="td-key">
                        <span className="task-key-tag">{t.id}</span>
                      </td>
                      <td className="td-title">
                        <strong className="task-title-text">{t.title}</strong>
                      </td>
                      <td className="td-epic">
                        {t.is_orphan ? (
                          <span className="badge-missing warning">⚠️ فاقد اپیک</span>
                        ) : (
                          <span className="epic-name-tag">📂 {t.epic_title || t.project_id}</span>
                        )}
                      </td>
                      <td className="td-assignee">
                        {t.assignee ? (
                          <span className="assignee-tag">👤 {t.assignee}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="td-sprint">
                        {t.is_no_sprint ? (
                          <span className="badge-missing info">🏃 خارج از اسپرینت</span>
                        ) : (
                          <span className="sprint-tag">🏃 {t.sprint_name}</span>
                        )}
                      </td>
                      <td className="td-estimate">
                        {t.is_no_estimate ? (
                          <span className="badge-missing danger">⏱️ بدون تخمین</span>
                        ) : (
                          <span className="estimate-tag">{t.estimate_hours}h</span>
                        )}
                      </td>
                      <td className="td-spent">
                        <span className={`spent-hours-tag ${t.spent_hours > 0 ? 'has-hours' : ''}`}>
                          {t.spent_hours || 0}h
                        </span>
                      </td>
                      <td className="td-duedate">
                        {t.is_no_due_date ? (
                          <span className="badge-missing purple">📅 بدون سررسید</span>
                        ) : (
                          <span className="duedate-tag">{t.due_date}</span>
                        )}
                      </td>
                      <td className="td-issues">
                        <div className="issues-badge-wrap">
                          {issueBadges.map((b, i) => (
                            <span key={i} className={`mr-issue-badge ${b.type}`}>
                              {b.label}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ManagerReportPage;
