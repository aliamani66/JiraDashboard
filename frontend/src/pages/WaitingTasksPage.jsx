import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft, ChevronDown, ChevronUp, Clock, ClipboardList, AlertCircle, 
  Calendar, Flag, ExternalLink, Printer, Search, FolderGit2, Link2, Users2, LayoutList, LayoutGrid, Sparkles
} from 'lucide-react';
import { useWaitingTasks } from '../hooks/useProjects';
import { api } from '../services/api';
import './WaitingTasksPage.css';

const JIRA_BASE_URL = 'https://10.100.71.140:8443';

const priorityMap = {
  'High': { label: 'بالا', className: 'high' },
  'Medium': { label: 'متوسط', className: 'normal' },
  'Low': { label: 'پایین', className: 'low' },
  'Critical': { label: 'بحرانی', className: 'critical' },
};

const isWaitingStatus = (st) => ['waiting', 'onholding', 'on hold', 'on_holding', 'blocked', 'منتظر', 'متوقف'].includes(String(st || '').toLowerCase().trim());

const WaitingTasksPage = () => {
  const { data, loading } = useWaitingTasks();
  const [selectedProjectKeys, setSelectedProjectKeys] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [configuredProjects, setConfiguredProjects] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'list' (flat all tasks) | 'project' (grouped by epic)
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedTaskLinks, setExpandedTaskLinks] = useState({});

  const toggleTaskLinks = (taskId) => {
    setExpandedTaskLinks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const toggleProject = (pId) => {
    setExpandedProjects(prev => ({
      ...prev,
      [pId]: !prev[pId]
    }));
  };

  const toggleProjectKey = (key) => {
    setSelectedProjectKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleTeam = (teamName) => {
    setSelectedTeams(prev => 
      prev.includes(teamName) ? prev.filter(t => t !== teamName) : [...prev, teamName]
    );
  };

  useEffect(() => {
    api.getJiraConfig().then(cfg => {
      const keys = (cfg?.connection?.projectKey || '')
        .split(',')
        .map(k => k.trim().toUpperCase())
        .filter(Boolean);
      setConfiguredProjects(keys);
    }).catch(() => {});
  }, []);

  const { totalWaiting = 0, byProject = [], tasks = [] } = data || {};

  // Extract all flat valid waiting tasks
  const allWaitingTasks = useMemo(() => {
    let list = [];
    if (Array.isArray(tasks) && tasks.length > 0) {
      list = tasks;
    } else if (Array.isArray(byProject) && byProject.length > 0) {
      const seen = new Set();
      for (const p of byProject) {
        for (const t of (p.tasks || [])) {
          const tId = t.task_id || t.id;
          if (tId && !seen.has(tId)) {
            seen.add(tId);
            list.push({ ...t, projectTitle: t.projectTitle || p.projectTitle || p.projectId });
          }
        }
      }
    }
    return list.filter(t => isWaitingStatus(t.status));
  }, [tasks, byProject]);

  // Extract unique Jira Project Keys
  const jiraProjectsList = useMemo(() => {
    if (configuredProjects.length > 0) {
      return [...configuredProjects].sort();
    }
    const keys = new Set();
    allWaitingTasks.forEach(t => {
      const tId = t.task_id || t.id || '';
      const tKey = tId ? tId.split('-')[0].toUpperCase() : '';
      if (tKey && tKey !== 'UNKNOWN') keys.add(tKey);
    });
    return Array.from(keys).sort();
  }, [configuredProjects, allWaitingTasks]);

  // Extract unique Team dependencies with count
  const allTeamsList = useMemo(() => {
    const map = new Map();
    allWaitingTasks.forEach(t => {
      const team = (t.waiting_for_team || t.blocked_by_team || 'سایر وابستگی‌ها').trim();
      map.set(team, (map.get(team) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allWaitingTasks]);

  // Filter tasks based on selected Jira projects, selected teams, and search query
  const filteredTasks = useMemo(() => {
    return allWaitingTasks.filter(t => {
      const tId = (t.task_id || t.id || '').toUpperCase();
      const tKey = tId ? tId.split('-')[0] : '';
      const pKey = (t.project_id || '').toUpperCase();

      // Project Filter
      if (selectedProjectKeys.length > 0) {
        const matchesProj = selectedProjectKeys.includes(tKey) || selectedProjectKeys.some(k => pKey.startsWith(k));
        if (!matchesProj) return false;
      }

      // Team Dependency Filter
      const team = (t.waiting_for_team || t.blocked_by_team || 'سایر وابستگی‌ها').trim();
      if (selectedTeams.length > 0) {
        if (!selectedTeams.includes(team)) return false;
      }

      // Search Query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const title = (t.title || '').toLowerCase();
        const tid = (t.task_id || t.id || '').toLowerCase();
        const reason = (t.waiting_reason || '').toLowerCase();
        const assignee = (t.assignee || '').toLowerCase();
        const proj = (t.projectTitle || t.project_id || '').toLowerCase();
        const teamName = team.toLowerCase();

        const match = title.includes(q) || tid.includes(q) || reason.includes(q) || assignee.includes(q) || proj.includes(q) || teamName.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [allWaitingTasks, selectedProjectKeys, selectedTeams, searchQuery]);

  // Group filtered tasks by project if in project view
  const groupedByProject = useMemo(() => {
    const pMap = new Map();
    filteredTasks.forEach(t => {
      const pId = t.project_id || (t.id ? t.id.split('-')[0] : 'ORD');
      const pTitle = t.projectTitle || pId;
      if (!pMap.has(pId)) {
        pMap.set(pId, {
          projectId: pId,
          projectTitle: pTitle,
          tasks: []
        });
      }
      pMap.get(pId).tasks.push(t);
    });
    return Array.from(pMap.values());
  }, [filteredTasks]);

  if (loading) {
    return <div className="page-loading">در حال دریافت اطلاعات تسک‌های منتظر...</div>;
  }

  const renderTaskCard = (task) => {
    const pri = priorityMap[task.priority] || { label: task.priority || 'متوسط', className: 'normal' };
    const taskIdStr = task.task_id || task.id;
    const teamName = (task.waiting_for_team || task.blocked_by_team || 'سایر وابستگی‌ها').trim();
    const jiraUrl = `${JIRA_BASE_URL}/browse/${taskIdStr}`;
    const pId = task.project_id || (taskIdStr ? taskIdStr.split('-')[0] : 'ORD');
    const pTitle = task.projectTitle || pId;

    let links = [];
    try {
      links = typeof task.linked_tasks === 'string' ? JSON.parse(task.linked_tasks) : (task.linked_tasks || []);
    } catch (_) {}
    const hasLinks = Array.isArray(links) && links.length > 0;
    const isExpLinks = !!expandedTaskLinks[taskIdStr];

    const sortedLinks = hasLinks ? [...links].sort((a, b) => {
      const aRel = String(a.relationship || a.linkType || '').toLowerCase();
      const bRel = String(b.relationship || b.linkType || '').toLowerCase();
      const aCrit = aRel.includes('block') || aRel.includes('serve') || aRel.includes('operat') || aRel.includes('depend') || aRel.includes('wait');
      const bCrit = bRel.includes('block') || bRel.includes('serve') || bRel.includes('operat') || bRel.includes('depend') || bRel.includes('wait');
      if (aCrit && !bCrit) return -1;
      if (!aCrit && bCrit) return 1;
      return 0;
    }) : [];

    const visibleLinks = isExpLinks ? sortedLinks : sortedLinks.slice(0, 2);
    const hiddenCount = sortedLinks.length - 2;

    return (
      <div key={task.id || taskIdStr} className="waiting-task-card">
        <div className="task-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <a 
                href={jiraUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="task-jira-link"
                title={`مشاهده تسک ${taskIdStr} در جیرا`}
              >
                <span className="task-id-badge">
                  {taskIdStr}
                  <ExternalLink size={12} className="jira-link-icon" />
                </span>
              </a>

              {pId && (
                <Link to={`/project/${pId}`} className="task-project-pill" title={`پروژه: ${pTitle}`}>
                  📁 {pId}
                </Link>
              )}
            </div>

            <span className={`task-priority-badge priority-${pri.className}`}>
              {pri.label}
            </span>
          </div>
          
          <h3 className="task-title">
            <a href={jiraUrl} target="_blank" rel="noopener noreferrer" className="task-title-link">
              {task.title}
            </a>
          </h3>
        </div>
        
        <div className="task-details">
          {/* Team Dependency Badge */}
          <div className="detail-item wt-team-highlight">
            <Users2 size={15} style={{ color: '#F97316' }} />
            <span>وابسته به تیم: <strong>{teamName}</strong></span>
          </div>
          
          {/* Waiting Reason */}
          {task.waiting_reason && (
            <div className="detail-item wt-reason-highlight">
              <AlertCircle size={15} style={{ color: '#EF4444' }} />
              <span>دلیل توقف: {task.waiting_reason}</span>
            </div>
          )}

          {/* Assignee & Dates */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {task.assignee ? (
              <span>👤 مسئول: <strong style={{ color: 'var(--text-secondary)' }}>{task.assignee}</strong></span>
            ) : <span></span>}
            {task.due_date && (
              <span>📅 سررسید: {task.due_date}</span>
            )}
          </div>

          {/* Linked Tasks */}
          {hasLinks && (
            <div className="detail-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem', marginTop: '0.4rem', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '0.4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Link2 size={13} style={{ color: '#38BDF8' }} /> تسک‌های وابسته/لینک‌شده:
                </span>
                {sortedLinks.length > 2 && (
                  <button
                    type="button"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px dashed rgba(255, 255, 255, 0.25)',
                      color: isExpLinks ? '#FDE68A' : 'var(--text-secondary)',
                      fontSize: '0.7rem',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTaskLinks(taskIdStr);
                    }}
                  >
                    {isExpLinks ? '▲ کمتر' : `+${hiddenCount} دیگر ▾`}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {visibleLinks.map((lt, lIdx) => {
                  const lUrl = `${JIRA_BASE_URL}/browse/${lt.key}`;
                  const rel = lt.relationship || lt.linkType || 'وابسته به';
                  const rLow = String(rel).toLowerCase();
                  const isBlock = rLow.includes('block');
                  const isServeOperate = rLow.includes('serve') || rLow.includes('operat') || rLow.includes('depend') || rLow.includes('wait') || rLow.includes('hold');

                  const bg = isBlock 
                    ? 'rgba(239, 68, 68, 0.18)' 
                    : isServeOperate 
                      ? 'rgba(249, 115, 22, 0.18)' 
                      : 'rgba(56, 189, 248, 0.12)';
                  const border = isBlock 
                    ? '1px solid rgba(239, 68, 68, 0.45)' 
                    : isServeOperate 
                      ? '1px solid rgba(249, 115, 22, 0.4)' 
                      : '1px solid rgba(56, 189, 248, 0.3)';
                  const col = isBlock ? '#FCA5A5' : isServeOperate ? '#FDBA74' : '#7DD3FC';

                  return (
                    <a
                      key={lIdx}
                      href={lUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="linked-issue-pill"
                      style={{
                        background: bg,
                        border: border,
                        color: col,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontFamily: 'monospace',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease'
                      }}
                      title={`${rel} ${lt.key}: ${lt.title || ''}`}
                    >
                      <span>{rel}:</span>
                      <strong>{lt.key}</strong>
                      <ExternalLink size={10} />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      className="waiting-tasks-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="page-header">
        <Link to="/" className="back-link" title="بازگشت به داشبورد">
          <ChevronLeft size={18} />
          <span>داشبورد</span>
        </Link>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 className="page-title">
            <Clock size={24} className="text-accent-orange" />
            <span>تسک‌های منتظر و متوقف</span>
            <span className="wt-header-count-badge">
              {filteredTasks.length} تسک
            </span>
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* View Mode Toggle */}
            <div className="view-mode-toggle-group">
              <button 
                type="button"
                className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="نمایش یکپارچه تمام تسک‌های منتظر"
              >
                <LayoutGrid size={15} />
                <span>همه تسک‌ها ({filteredTasks.length})</span>
              </button>
              <button 
                type="button"
                className={`view-mode-btn ${viewMode === 'project' ? 'active' : ''}`}
                onClick={() => setViewMode('project')}
                title="نمایش دسته‌بندی‌شده بر اساس پروژه‌ها"
              >
                <LayoutList size={15} />
                <span>بر اساس پروژه ({groupedByProject.length})</span>
              </button>
            </div>

            <button 
              className="wt-export-btn icon-only-btn"
              onClick={() => window.open(`/api/reports/waiting-html?token=${localStorage.getItem('token')}`, '_blank')}
              title="دانلود و چاپ گزارش تسک‌های منتظر"
            >
              <Printer size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* TOP FILTERS BAR: Jira Projects & Team Dependencies & Search */}
      <div className="glass-card wt-filters-card">
        {/* 1. Team Dependencies Filter Bar */}
        <div className="filter-row-wrap">
          <div className="jira-filter-pills-bar">
            <span className="filter-label">
              <Users2 size={16} style={{ color: '#F97316' }} /> فیلتر وابستگی به تیم‌ها:
            </span>
            
            <div className="jira-pills-wrap">
              {allTeamsList.map(({ name, count }) => {
                const isSel = selectedTeams.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    className={`jira-pill-btn team-pill ${isSel ? 'active' : ''}`}
                    onClick={() => toggleTeam(name)}
                  >
                    {isSel ? '✅' : '➕'} {name} <span className="pill-count-badge">({count})</span>
                  </button>
                );
              })}
              {selectedTeams.length > 0 && (
                <button className="jira-pills-clear-btn" onClick={() => setSelectedTeams([])}>
                  پاک‌سازی تیم‌ها ({selectedTeams.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. Jira Projects Filter Bar */}
        <div className="filter-row-wrap" style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="jira-filter-pills-bar">
            <span className="filter-label">
              <FolderGit2 size={16} style={{ color: '#38BDF8' }} /> فیلتر پروژه جیرا:
            </span>
            
            <div className="jira-pills-wrap">
              {jiraProjectsList.map(key => {
                const isSel = selectedProjectKeys.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`jira-pill-btn ${isSel ? 'active' : ''}`}
                    onClick={() => toggleProjectKey(key)}
                  >
                    {isSel ? '✅' : '➕'} پروژه {key}
                  </button>
                );
              })}
              {selectedProjectKeys.length > 0 && (
                <button className="jira-pills-clear-btn" onClick={() => setSelectedProjectKeys([])}>
                  پاک‌سازی پروژه‌ها ({selectedProjectKeys.length})
                </button>
              )}
            </div>
          </div>

          {/* Quick Universal Search Box */}
          <div className="universal-search-box">
            <Search size={15} />
            <input
              type="text"
              placeholder="جستجوی عنوان تسک، مسئول، دلیل توقف، تیم..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="universal-search-clear" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>
        </div>
      </div>

      {/* ACTIVE FILTERS SUMMARY CHIPS */}
      {(selectedTeams.length > 0 || selectedProjectKeys.length > 0 || searchQuery) && (
        <div className="active-filters-summary">
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>فیلترهای فعال:</span>
          {selectedTeams.map(team => (
            <span key={team} className="active-chip team-chip">
              تیم: {team}
              <button onClick={() => toggleTeam(team)}>×</button>
            </span>
          ))}
          {selectedProjectKeys.map(key => (
            <span key={key} className="active-chip proj-chip">
              پروژه: {key}
              <button onClick={() => toggleProjectKey(key)}>×</button>
            </span>
          ))}
          {searchQuery && (
            <span className="active-chip search-chip">
              متن: «{searchQuery}»
              <button onClick={() => setSearchQuery('')}>×</button>
            </span>
          )}
          <button 
            className="clear-all-filters-btn"
            onClick={() => {
              setSelectedTeams([]);
              setSelectedProjectKeys([]);
              setSearchQuery('');
            }}
          >
            حذف همه فیلترها
          </button>
        </div>
      )}

      {/* MAIN CONTENT: Flat Unified List vs Grouped By Project */}
      <div className="wt-content-area">
        {filteredTasks.length === 0 ? (
          <div className="glass-card empty-state" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <AlertCircle size={40} style={{ color: '#F97316', margin: '0 auto 1rem auto', opacity: 0.8 }} />
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>تسکی در انتظار با فیلترهای انتخابی یافت نشد</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>می‌توانید فیلترهای تیم یا پروژه را بازنشانی فرمایید.</p>
          </div>
        ) : viewMode === 'list' ? (
          /* 🌟 Unified Grid of All Waiting Tasks */
          <div className="unified-waiting-grid">
            {filteredTasks.map(task => renderTaskCard(task))}
          </div>
        ) : (
          /* 🌟 Grouped by Project Accordion Cards */
          <div className="projects-container">
            {groupedByProject.map(project => {
              const pId = project.projectId;
              const pTitle = project.projectTitle;
              const isExpanded = expandedProjects[pId] !== false; // Default open in project view

              return (
                <div key={pId} className="glass-card project-group-card">
                  <div 
                    className="project-group-header" 
                    onClick={() => toggleProject(pId)}
                    style={{ 
                      cursor: 'pointer',
                      marginBottom: isExpanded ? '1rem' : '0',
                      paddingBottom: isExpanded ? '1rem' : '0',
                      borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <button 
                        type="button"
                        className="accordion-toggle-btn"
                        style={{ 
                          background: 'rgba(255,255,255,0.08)', 
                          border: '1px solid var(--glass-border)', 
                          color: 'var(--text-secondary)', 
                          width: '28px', 
                          height: '28px', 
                          borderRadius: '8px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title={isExpanded ? 'بستن' : 'باز کردن'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>

                      <h2 className="project-group-title">
                        <ClipboardList size={20} className="text-accent-cyan" />
                        <Link to={`/project/${pId}`} className="project-group-link" title="مشاهده جزئیات پروژه" onClick={e => e.stopPropagation()}>
                          <span>{pTitle}</span>
                          <span className="project-id-badge">({pId})</span>
                          <ExternalLink size={14} className="link-icon" />
                        </Link>
                      </h2>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span className="waiting-count-tag">
                        {project.tasks.length} تسک منتظر
                      </span>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="unified-waiting-grid">
                      {project.tasks.map(task => renderTaskCard(task))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default WaitingTasksPage;
