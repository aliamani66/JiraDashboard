import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, Calendar, Clock, ExternalLink, User, Layers, ArrowLeft, Filter, Search, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import './SprintsPage.css';

const JIRA_BASE_URL = 'https://aliamani6.atlassian.net';

const SprintsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState('Sprint 5');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [componentFilter, setComponentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const sprintList = [
    'Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5', 
    'Sprint 6', 'Sprint 7', 'Sprint 8', 'Sprint 9', 'Sprint 10', 'all'
  ];

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
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await api.getAllSprints();
        setTasks(data.tasks || []);
      } catch (err) {
        console.error('Failed to fetch sprints data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="loading-screen">در حال دریافت داده‌های اسپرینت پروژه‌ها...</div>;

  // Extract unique project options
  const projectOptions = Array.from(new Set(tasks.map(t => JSON.stringify({ id: t.project_id, title: t.project_title }))))
    .map(s => JSON.parse(s));

  // Filter Tasks
  const filteredTasks = tasks.filter(task => {
    // Sprint Filter
    if (selectedSprint !== 'all' && (task.sprint_name || 'Sprint 10') !== selectedSprint) return false;

    // Project Filter
    if (projectFilter !== 'all' && task.project_id !== projectFilter) return false;

    // Status Filter
    if (statusFilter === 'active' && !(task.status === 'In Progress' || task.status === 'in_progress')) return false;
    if (statusFilter === 'done' && !(task.status === 'Done' || task.status === 'done')) return false;
    if (statusFilter === 'waiting' && !(task.status === 'Waiting' || task.status === 'OnHolding' || task.is_waiting)) return false;
    if (statusFilter === 'todo' && !(task.status === 'To Do' || task.status === 'to_do')) return false;

    // Component Filter
    if (componentFilter !== 'all' && (task.component || 'dev') !== componentFilter) return false;

    // Search Query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchKey = (task.id || '').toLowerCase().includes(q);
      const matchTitle = (task.title || '').toLowerCase().includes(q);
      const matchDesc = (task.description || '').toLowerCase().includes(q);
      const matchProj = (task.project_title || '').toLowerCase().includes(q);
      if (!matchKey && !matchTitle && !matchDesc && !matchProj) return false;
    }

    return true;
  });

  // Calculate Sprint Stats
  const totalSprintTasks = filteredTasks.length;
  const doneTasksCount = filteredTasks.filter(t => t.status === 'Done' || t.status === 'done').length;
  const activeTasksCount = filteredTasks.filter(t => t.status === 'In Progress' || t.status === 'in_progress').length;
  const waitingTasksCount = filteredTasks.filter(t => t.is_waiting || t.status === 'Waiting' || t.status === 'OnHolding').length;

  const totalSpentHours = Math.round(filteredTasks.reduce((sum, t) => sum + (t.spent_hours || 0), 0));
  const totalEstHours = Math.round(filteredTasks.reduce((sum, t) => sum + (t.estimate_hours || 0), 0));
  const sprintProgress = totalEstHours > 0 
    ? Math.min(100, Math.round((totalSpentHours / totalEstHours) * 100))
    : (totalSprintTasks > 0 ? Math.round((doneTasksCount / totalSprintTasks) * 100) : 0);

  // Group filtered tasks by Project for the Sprint Board View
  const tasksByProjectMap = new Map();
  for (const t of filteredTasks) {
    const pKey = t.project_id;
    if (!tasksByProjectMap.has(pKey)) {
      tasksByProjectMap.set(pKey, {
        projectId: pKey,
        projectTitle: t.project_title,
        tasks: []
      });
    }
    tasksByProjectMap.get(pKey).tasks.push(t);
  }

  const projectGroups = Array.from(tasksByProjectMap.values());
  const selectedDates = sprintDates[selectedSprint] || { start: '---', due: '---' };

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
      </div>

      {/* Sprint Selector Tabs Bar */}
      <div className="main-filter-tile sp-sprint-selector-tile">
        <div className="sp-tabs-header">
          <span className="sp-tabs-label">انتخاب اسپرینت:</span>
          <div className="sp-tabs-wrap">
            {sprintList.map(s => (
              <button
                key={s}
                className={`sp-sprint-tab ${selectedSprint === s ? 'active' : ''}`}
                onClick={() => setSelectedSprint(s)}
              >
                {s === 'all' ? '🌐 همه اسپرینت‌ها' : `🔥 ${s}`}
              </button>
            ))}
          </div>
        </div>

        {selectedSprint !== 'all' && (
          <div className="sp-sprint-dates-banner">
            <Calendar size={16} className="text-accent-cyan" />
            <span>بازه زمان‌بندی {selectedSprint}: <strong>از {selectedDates.start} تا {selectedDates.due}</strong></span>
          </div>
        )}
      </div>

      {/* Sprint Summary KPI Cards */}
      <div className="sp-kpi-grid">
        <div className="glass-card sp-kpi-card orange">
          <div className="sp-kpi-icon"><Flame size={24} /></div>
          <div className="sp-kpi-info">
            <span className="sp-kpi-title">تسک‌های اسپرینت</span>
            <h2 className="sp-kpi-value">{totalSprintTasks} <small>تسک</small></h2>
          </div>
        </div>

        <div className="glass-card sp-kpi-card green">
          <div className="sp-kpi-icon"><CheckCircle2 size={24} /></div>
          <div className="sp-kpi-info">
            <span className="sp-kpi-title">انجام‌شده / در حال اجرا</span>
            <h2 className="sp-kpi-value">{doneTasksCount} <small>انجام‌شده ({activeTasksCount} در حال انجام)</small></h2>
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
        <div className="sp-filter-item">
          <Filter size={16} className="text-accent-cyan" />
          <span className="sp-filter-label">پروژه:</span>
          <select 
            value={projectFilter} 
            onChange={(e) => setProjectFilter(e.target.value)}
            className="sp-select"
          >
            <option value="all">همه پروژه‌ها ({projectOptions.length})</option>
            {projectOptions.map(p => (
              <option key={p.id} value={p.id}>{p.id}: {p.title}</option>
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

        <div className="sp-filter-item">
          <span className="sp-filter-label">کامپوننت:</span>
          <select 
            value={componentFilter} 
            onChange={(e) => setComponentFilter(e.target.value)}
            className="sp-select"
          >
            <option value="all">همه کامپوننت‌ها</option>
            <option value="dev">🚀 توسعه</option>
            <option value="infrastructure">🌐 زیرساخت</option>
            <option value="monitoring">📊 مانیتورینگ</option>
            <option value="security">🔐 امنیت</option>
            <option value="ai">🤖 هوش مصنوعی</option>
            <option value="database">🗄️ دیتابیس</option>
            <option value="testing">🧪 تست</option>
            <option value="support">🛠️ پشتیبانی</option>
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
                {group.tasks.map(task => {
                  const est = task.estimate_hours || 0;
                  const spent = task.spent_hours || 0;
                  const timeProg = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : (task.status === 'Done' ? 100 : 0);
                  const jiraUrl = `${JIRA_BASE_URL}/browse/${task.id}`;

                  return (
                    <div key={task.id} className={`sp-task-card ${task.is_waiting ? 'task-waiting-border' : ''}`}>
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
