import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, Calendar, Clock, ExternalLink, User, Layers, ArrowLeft, Filter, Search, CheckCircle2, Printer, FileText, AlertTriangle, FolderGit2 } from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import './SprintsPage.css';

// Jira Base Server URL configuration for quick links
const JIRA_BASE_URL = 'https://10.100.71.140:8443';

const SprintsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState('Sprint 5');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [componentFilter, setComponentFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const sprintDates = {
    'Sprint 1':  { start: '۱۴۰۵/۰۱/۲۶', due: '۱۴۰۵/۰۲/۲۱' },
    'Sprint 2':  { start: '۱۴۰۵/۰۲/۱۱', due: '۱۴۰۵/۰۳/۱۵' },
    'Sprint 3':  { start: '۱۴۰۵/۰۲/۳۰', due: '۱۴۰۵/۰۴/۰۴' },
    'Sprint 4':  { start: '۱۴۰۵/۰۳/۱۵', due: '۱۴۰۵/۰۴/۱۹' },
    'Sprint 5':  { start: '۱۴۰۵/۰۳/۳۰', due: '۱۴۰۵/۰۵/۰۳' },
    'Sprint 6':  { start: '۱۴۰۵/۰۴/۱۴', due: '۱۴۰۵/۰۵/۱۹' },
    'Sprint 7':  { start: '۱۴۰۵/۰۴/۲۹', due: '۱۴۰۵/۰۶/۰۳' },
    'Sprint 8':  { start: '۱۴۰۵/۰۵/۱۰', due: '۱۴۰۵/۰۶/۱۴' },
    'Sprint 9':  { start: '۱۴۰۵/۰۵/۲۱', due: '۱۴۰۵/۰۶/۲۴' },
    'Sprint 10': { start: '۱۴۰۵/۰۵/۲۹', due: '۱۴۰۵/۰۷/۰۳' },
  };

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getAllSprints();
        if (!isMounted) return;
        const tList = Array.isArray(data?.tasks) ? data.tasks : [];
        setTasks(tList);

        if (tList.length > 0) {
          const sNames = Array.from(new Set(tList.map(t => String(t?.sprint_name || 'Sprint 10')))).sort((a, b) => {
            const numA = parseInt(String(a).replace(/\D/g, '')) || 0;
            const numB = parseInt(String(b).replace(/\D/g, '')) || 0;
            return numA - numB;
          });
          if (sNames.length > 0) {
            setSelectedSprint(sNames[sNames.length - 1]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch sprints data:', err);
        if (isMounted) {
          setError(err?.message || 'خطا در دریافت داده‌های اسپرینت');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="sprints-page">
        <div className="sp-top-bar">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
            <span>بازگشت به داشبورد</span>
          </button>
        </div>
        <div className="glass-card sp-empty-state">
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '1rem' }}>در حال دریافت داده‌های اسپرینت پروژه‌ها...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sprints-page">
        <div className="sp-top-bar">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
            <span>بازگشت به داشبورد</span>
          </button>
        </div>
        <div className="glass-card sp-empty-state" style={{ color: '#F87171' }}>
          <AlertTriangle size={36} />
          <h3 style={{ marginTop: '0.5rem' }}>خطا در دریافت اطلاعات اسپرینت‌ها</h3>
          <p>{error}</p>
          <button className="sp-export-btn" onClick={() => window.location.reload()} style={{ marginTop: '1rem' }}>
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  const defaultSprintList = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5', 'Sprint 6', 'Sprint 7', 'Sprint 8', 'Sprint 9', 'Sprint 10'];

  // Extract unique Jira Project Keys (e.g. ORD, OPS, DEV)
  const jiraProjectOptions = Array.from(
    new Set(
      (tasks || [])
        .map(t => (t.project_key || (t.project_id ? String(t.project_id).split('-')[0] : '')))
        .filter(Boolean)
    )
  ).sort();

  // Dynamically extract all unique sprint names from backend tasks with fallback
  const extractedSprints = Array.from(
    new Set(
      (tasks || [])
        .filter(t => {
          if (!t || !t.sprint_name) return false;
          if (projectFilter !== 'all') {
            const jKey = t.project_key || (t.project_id ? String(t.project_id).split('-')[0] : '');
            if (jKey !== projectFilter) return false;
          }
          return true;
        })
        .map(t => String(t.sprint_name).trim())
    )
  ).sort((a, b) => {
    const numA = parseInt(String(a).replace(/\D/g, '')) || 0;
    const numB = parseInt(String(b).replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  const allSprintNames = extractedSprints.length > 0 ? extractedSprints : defaultSprintList;

  // Get 5 most recent sprints for quick pill bar
  const recent5Sprints = allSprintNames.slice(-5);
  const quickPills = [...recent5Sprints];
  if (selectedSprint !== 'all' && !quickPills.includes(selectedSprint)) {
    quickPills.unshift(selectedSprint);
  }

  // Extract unique assignee / person options
  const assigneeOptions = Array.from(
    new Set(
      (tasks || [])
        .map(t => (t && t.assignee ? String(t.assignee).trim() : ''))
        .filter(Boolean)
    )
  ).sort();

  // Filter Tasks
  const filteredTasks = (tasks || []).filter(task => {
    if (!task) return false;

    // Jira Project Filter
    if (projectFilter !== 'all') {
      const jKey = task.project_key || (task.project_id ? String(task.project_id).split('-')[0] : '');
      if (jKey !== projectFilter) return false;
    }

    // Sprint Filter
    if (selectedSprint !== 'all' && String(task.sprint_name || 'Sprint 10') !== selectedSprint) return false;

    // Assignee / Person Filter
    if (assigneeFilter !== 'all' && String(task.assignee || 'تخصیص‌نیافته') !== assigneeFilter) return false;

    // Status Filter
    if (statusFilter === 'active' && !(task.status === 'In Progress' || task.status === 'in_progress')) return false;
    if (statusFilter === 'done' && !(task.status === 'Done' || task.status === 'done')) return false;
    if (statusFilter === 'waiting' && !(task.status === 'Waiting' || task.status === 'OnHolding' || task.is_waiting)) return false;
    if (statusFilter === 'todo' && !(task.status === 'To Do' || task.status === 'to_do')) return false;

    // Component Filter
    if (componentFilter !== 'all' && String(task.component || 'dev') !== componentFilter) return false;

    // Search Query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchKey = String(task.id || '').toLowerCase().includes(q);
      const matchTitle = String(task.title || '').toLowerCase().includes(q);
      const matchDesc = String(task.description || '').toLowerCase().includes(q);
      const matchProj = String(task.project_title || '').toLowerCase().includes(q);
      const matchAssignee = String(task.assignee || '').toLowerCase().includes(q);
      if (!matchKey && !matchTitle && !matchDesc && !matchProj && !matchAssignee) return false;
    }

    return true;
  });

  // Calculate Sprint Stats with Strict Mutual Exclusivity
  const totalSprintTasks = filteredTasks.length;

  let doneCount = 0;
  let activeCount = 0;
  let waitingCount = 0;
  let todoCount = 0;

  for (const t of filteredTasks) {
    if (!t) continue;
    if (t.status === 'Done' || t.status === 'done') {
      doneCount++;
    } else if (t.is_waiting || t.status === 'Waiting' || t.status === 'OnHolding') {
      waitingCount++;
    } else if (t.status === 'In Progress' || t.status === 'in_progress') {
      activeCount++;
    } else {
      todoCount++;
    }
  }

  const totalSpentHours = Math.round(filteredTasks.reduce((sum, t) => sum + (parseFloat(t?.spent_hours) || 0), 0) * 100) / 100;
  const totalEstHours = Math.round(filteredTasks.reduce((sum, t) => sum + (parseFloat(t?.estimate_hours) || 0), 0) * 100) / 100;
  const sprintProgress = totalEstHours > 0 
    ? Math.min(100, Math.round((totalSpentHours / totalEstHours) * 100))
    : (totalSprintTasks > 0 ? Math.round((doneCount / totalSprintTasks) * 100) : 0);

  // Group filtered tasks by Project for the Sprint Board View
  const tasksByProjectMap = new Map();
  for (const t of filteredTasks) {
    if (!t) continue;
    const pKey = String(t.project_id || 'GENERAL');
    if (!tasksByProjectMap.has(pKey)) {
      tasksByProjectMap.set(pKey, {
        projectId: pKey,
        projectTitle: String(t.project_title || pKey),
        tasks: []
      });
    }
    tasksByProjectMap.get(pKey).tasks.push(t);
  }

  const projectGroups = Array.from(tasksByProjectMap.values());

  // Dynamically extract sprint start and end dates from Jira task dates
  let dynamicStart = null;
  let dynamicDue = null;

  for (const t of filteredTasks) {
    if (!t) continue;
    const sDate = t.sprint_start_date || t.start_date;
    const eDate = t.sprint_end_date || t.due_date;
    if (sDate && (!dynamicStart || sDate < dynamicStart)) dynamicStart = sDate;
    if (eDate && (!dynamicDue || eDate > dynamicDue)) dynamicDue = eDate;
  }

  const formatJalali = (isoStr) => {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    } catch {
      return isoStr;
    }
  };

  const formattedStart = formatJalali(dynamicStart);
  const formattedDue = formatJalali(dynamicDue);

  const selectedDates = {
    start: formattedStart || sprintDates[selectedSprint]?.start || dynamicStart || '۱۴۰۵/۰۵/۰۱',
    due: formattedDue || sprintDates[selectedSprint]?.due || dynamicDue || '۱۴۰۵/۰۵/۲۵'
  };

  const token = localStorage.getItem('token') || '';

  return (
    <motion.div 
      className="sprints-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Top Header Bar */}
      <div className="sp-top-bar">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={18} />
          <span>بازگشت به داشبورد</span>
        </button>
        <div className="sp-title-area">
          <h1 className="sp-page-title">
            <Flame size={28} className="text-accent-orange" />
            جلسات اسپرینت و پایش هفتگی پروژه‌ها (Sprint Review)
          </h1>
          <p className="sp-subtitle">بررسی تجمیعی تسک‌ها به تفکیک اسپرینت‌های هفتگی برای تمامی پروژه‌های R&D عملیات</p>
        </div>
        <div className="sp-export-btns-group">
          <button 
            className="sp-export-btn" 
            onClick={() => window.open(`/api/reports/sprints-html?sprint=${encodeURIComponent(selectedSprint)}${token ? `&token=${token}` : ''}`, '_blank')} 
            title="خروجی و چاپ گزارش رسمی تحویل‌دادنی‌ها (PDF Printable)"
          >
            <Printer size={15} />
            <span>چاپ گزارش اسپرینت ({selectedSprint})</span>
          </button>

          {selectedSprint !== 'all' && (
            <button 
              className="sp-export-btn secondary" 
              onClick={() => window.open(`/api/reports/sprints-html?sprint=all${token ? `&token=${token}` : ''}`, '_blank')} 
              title="خروجی و چاپ گزارش تمام اسپرینت‌ها"
            >
              <FileText size={15} />
              <span>گزارش جامع تمام اسپرینت‌ها</span>
            </button>
          )}
        </div>
      </div>

      {/* Sprint Summary KPI Cards */}
      <div className="sp-kpi-grid">
        <div className="glass-card sp-kpi-card orange">
          <div className="sp-kpi-icon"><Flame size={24} /></div>
          <div className="sp-kpi-info">
            <span className="sp-kpi-title">مجموع کل تسک‌های اسپرینت</span>
            <h2 className="sp-kpi-value">{totalSprintTasks} <small>تسک</small></h2>
          </div>
        </div>

        <div className="glass-card sp-kpi-card status-breakdown-card">
          <div className="sp-status-grid-mini">
            <div className="sp-mini-chip done" title="تسک‌هایی که کامل انجام شده‌اند">
              <span className="dot green"></span>
              <span className="lbl">✅ انجام‌شده:</span>
              <strong>{doneCount}</strong>
            </div>
            <div className="sp-mini-chip active" title="تسک‌های در حال اجرا">
              <span className="dot blue"></span>
              <span className="lbl">⚡ در حال انجام:</span>
              <strong>{activeCount}</strong>
            </div>
            <div className="sp-mini-chip waiting" title="تسک‌های منتظر / آن‌هولد">
              <span className="dot orange"></span>
              <span className="lbl">⏳ منتظر:</span>
              <strong>{waitingCount}</strong>
            </div>
            <div className="sp-mini-chip todo" title="تسک‌های در صف شروع">
              <span className="dot purple"></span>
              <span className="lbl">📋 برای انجام:</span>
              <strong>{todoCount}</strong>
            </div>
          </div>
          <div className="sp-sum-verify-badge">
            مجموع ({doneCount} + {activeCount} + {waitingCount} + {todoCount}) = {totalSprintTasks} تسک
          </div>
        </div>

        <div className="glass-card sp-kpi-card cyan">
          <div className="sp-kpi-icon"><Clock size={24} /></div>
          <div className="sp-kpi-info">
            <span className="sp-kpi-title">کارکرد / تخمین اسپرینت</span>
            <h2 className="sp-kpi-value">{totalSpentHours}h <small>({totalEstHours}h تخمین)</small></h2>
          </div>
        </div>

        <div className="glass-card sp-kpi-card purple">
          <div className="sp-kpi-icon"><Layers size={24} /></div>
          <div className="sp-kpi-info">
            <span className="sp-kpi-title">پیشرفت اسپرینت</span>
            <h2 className="sp-kpi-value">%{sprintProgress}</h2>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card sp-filter-bar">
        {/* Sprint Filter Dropdown */}
        <div className="sp-filter-item">
          <Flame size={16} className="text-accent-orange" />
          <span className="sp-filter-label">انتخاب اسپرینت:</span>
          <select 
            value={selectedSprint} 
            onChange={(e) => setSelectedSprint(e.target.value)}
            className="sp-select sp-filter-sprint-dropdown"
          >
            <option value="all">🌐 همه اسپرینت‌ها ({allSprintNames.length})</option>
            {allSprintNames.map(s => (
              <option key={s} value={s}>🔥 {s}</option>
            ))}
          </select>
        </div>

        {/* Jira Project Filter */}
        <div className="sp-filter-item">
          <FolderGit2 size={16} className="text-accent-purple" style={{ color: '#C084FC' }} />
          <span className="sp-filter-label">پروژه Jira:</span>
          <select 
            value={projectFilter} 
            onChange={(e) => setProjectFilter(e.target.value)}
            className="sp-select"
            style={{ fontWeight: 'bold', color: '#E9D5FF' }}
          >
            <option value="all">🌐 همه پروژه‌های Jira ({jiraProjectOptions.length})</option>
            {jiraProjectOptions.map(pKey => (
              <option key={pKey} value={pKey}>
                📂 پروژه {pKey}
              </option>
            ))}
          </select>
        </div>

        {/* Assignee / Person Filter */}
        <div className="sp-filter-item">
          <User size={16} className="text-accent-blue" />
          <span className="sp-filter-label">مسئول تسک:</span>
          <select 
            value={assigneeFilter} 
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="sp-select"
          >
            <option value="all">همه افراد ({assigneeOptions.length})</option>
            {assigneeOptions.map(person => (
              <option key={person} value={person}>👤 {person}</option>
            ))}
          </select>
        </div>

        <div className="sp-filter-item">
          <span className="sp-filter-label">وضعیت:</span>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="sp-select"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="active">⚡ در حال انجام</option>
            <option value="done">✅ انجام‌شده</option>
            <option value="waiting">⏳ منتظر / آن‌هولد</option>
            <option value="todo">📋 برای انجام</option>
          </select>
        </div>

        <div className="sp-search-box">
          <Search size={16} className="sp-search-icon" />
          <input 
            type="text"
            placeholder="جستجوی عنوان، کد تسک یا پروژه..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sp-search-input"
          />
        </div>
      </div>

      {/* Selected Sprint Date Schedule Tag */}
      {selectedSprint !== 'all' && (
        <div className="sp-sprint-dates-banner" style={{ margin: '0.85rem 0 1.5rem 0' }}>
          <Calendar size={15} className="text-accent-cyan" />
          <span>زمان‌بندی {selectedSprint}: <strong>از {selectedDates.start} تا {selectedDates.due}</strong></span>
        </div>
      )}

      {/* Sprint Project Groups & Task Cards View */}
      <div className="sp-project-groups-list">
        {projectGroups.length === 0 ? (
          <div className="glass-card sp-empty-state">
            تسکی در این اسپرینت با فیلترهای انتخابی یافت نشد.
          </div>
        ) : (
          projectGroups.map(group => (
            <div key={group.projectId} className="glass-card sp-project-group-card">
              <div className="sp-group-header">
                <div className="sp-group-title-wrap">
                  <span className="task-id-badge">{group.projectId}</span>
                  <h3 className="sp-group-title">{group.projectTitle}</h3>
                </div>
                <span className="sp-group-count-badge">
                  {group.tasks.length} تسک در اسپرینت
                </span>
              </div>

              <div className="sp-tasks-grid">
                {(group.tasks || []).map((task, idx) => {
                  if (!task) return null;
                  const est = Math.round((parseFloat(task.estimate_hours) || 0) * 100) / 100;
                  const spent = Math.round((parseFloat(task.spent_hours) || 0) * 100) / 100;
                  const timeProg = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : (task.status === 'Done' ? 100 : 0);
                  const taskId = task.id || `task-${idx}`;
                  const jiraUrl = `${JIRA_BASE_URL}/browse/${taskId}`;

                  return (
                    <div key={taskId} className={`sp-task-card ${task.is_waiting ? 'task-waiting-border' : ''}`}>
                      <div className="sp-task-card-top">
                        <a 
                          href={jiraUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="task-jira-link"
                          title={`مشاهده ${task.id} در جیرا`}
                        >
                          <span className="task-id-badge">
                            {task.id}
                            <ExternalLink size={11} className="jira-link-icon" />
                          </span>
                        </a>

                        <StatusBadge status={task.status} />
                      </div>

                      <h4 className="sp-task-title">
                        <a href={jiraUrl} target="_blank" rel="noopener noreferrer">
                          {task.title}
                        </a>
                      </h4>

                      {task.description && (
                        <p className="sp-task-desc" title={task.description}>
                          📝 {task.description}
                        </p>
                      )}

                      {task.blocked_by_team && (
                        <div className="sp-blocked-tag">
                          ⏳ بلاک شده توسط: <strong>{task.blocked_by_team}</strong>
                        </div>
                      )}

                      <div className="sp-task-meta-row">
                        <div className="sp-assignee-badge">
                          <User size={13} className="text-accent-blue" />
                          <span>{task.assignee || 'تخصیص‌نیافته'}</span>
                        </div>

                        {task.sprint_name && (
                          <span className="sprint-tag">🔥 {task.sprint_name}</span>
                        )}
                      </div>

                      {/* Time Progress Bar */}
                      <div className="sp-task-time-bar">
                        <div className="sp-time-info">
                          <span>ساعات کارکرد: <strong>{spent}h</strong> / {est}h</span>
                          <span>%{timeProg}</span>
                        </div>
                        <div className="mini-progress-bar">
                          <div className="mini-progress-fill" style={{ width: `${timeProg}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default SprintsPage;
