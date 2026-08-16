import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronDown, ChevronUp, Clock, ClipboardList, AlertCircle, Calendar, Flag, ExternalLink, Printer, Search, FolderGit2, Link2 } from 'lucide-react';
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

const WaitingTasksPage = () => {
  const { data, loading } = useWaitingTasks();
  const [selectedProjectKeys, setSelectedProjectKeys] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [configuredProjects, setConfiguredProjects] = useState([]);
  const [expandedProjects, setExpandedProjects] = useState({}); // Default closed for all

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

  useEffect(() => {
    api.getJiraConfig().then(cfg => {
      const keys = (cfg?.connection?.projectKey || '')
        .split(',')
        .map(k => k.trim().toUpperCase())
        .filter(Boolean);
      setConfiguredProjects(keys);
    }).catch(() => {});
  }, []);

  const { totalWaiting = 0, byProject = [] } = data || {};

  // Extract unique Jira Project Keys (STRICTLY showing configured projects from Jira Settings)
  const jiraProjectsList = useMemo(() => {
    if (configuredProjects.length > 0) {
      return [...configuredProjects].sort();
    }
    const keys = new Set();
    (byProject || []).forEach(p => {
      (p.tasks || []).forEach(t => {
        const tId = t.task_id || t.id || '';
        const tKey = tId ? tId.split('-')[0].toUpperCase() : '';
        if (tKey && tKey !== 'UNKNOWN') keys.add(tKey);
      });
    });
    return Array.from(keys).sort();
  }, [configuredProjects, byProject]);

  if (loading) {
    return <div className="page-loading">در حال دریافت اطلاعات تسک‌های منتظر...</div>;
  }

  // Filter projects by Jira Project Key and search query
  const filteredByProject = byProject.filter(project => {
    const pId = project.projectId || project.project_id || '';
    const pTitle = project.projectTitle || project.project_name || '';
    const jKey = (project.project_key || (pId ? pId.split('-')[0] : '')).toUpperCase();

    const hasMatchingTask = (project.tasks || []).some(t => {
      const tId = t.task_id || t.id || '';
      const tKey = tId ? tId.split('-')[0].toUpperCase() : '';
      return selectedProjectKeys.length === 0 || selectedProjectKeys.includes(tKey);
    });

    if (selectedProjectKeys.length > 0 && !selectedProjectKeys.includes(jKey) && !hasMatchingTask) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchPTitle = pTitle.toLowerCase().includes(q);
      const matchPId = pId.toLowerCase().includes(q);
      const matchTasks = (project.tasks || []).some(t => {
        const title = (t.title || '').toLowerCase();
        const tid = (t.task_id || t.id || '').toLowerCase();
        const team = (t.waiting_for_team || t.blocked_by_team || '').toLowerCase();
        const reason = (t.waiting_reason || '').toLowerCase();
        return title.includes(q) || tid.includes(q) || team.includes(q) || reason.includes(q);
      });
      if (!matchPTitle && !matchPId && !matchTasks) return false;
    }

    return true;
  });

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
        <h1 className="page-title">
          <Clock size={22} className="text-accent-orange" />
          <span>تسک‌های منتظر</span>
        </h1>

        <button 
          className="wt-export-btn icon-only-btn"
          onClick={() => window.open(`/api/reports/waiting-html?token=${localStorage.getItem('token')}`, '_blank')}
          title="دانلود و چاپ گزارش تسک‌های منتظر"
        >
          <Printer size={16} />
        </button>
      </div>

      {/* Jira Project Filter & Search Bar */}
      <div className="glass-card" style={{ padding: '0.85rem 1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem', borderRadius: '16px' }}>
        <div className="jira-filter-pills-bar">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
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
                پاک‌سازی ({selectedProjectKeys.length})
              </button>
            )}
          </div>
        </div>

        {/* Quick Universal Search Box */}
        <div className="universal-search-box">
          <Search size={15} />
          <input
            type="text"
            placeholder="جستجوی عنوان تسک، مسئول، تیم منتظر..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="universal-search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
      </div>

      <div className="projects-container">
        {filteredByProject.length === 0 ? (
          <div className="glass-card empty-state">
            تسکی در انتظار با فیلترهای انتخاب‌شده یافت نشد.
          </div>
        ) : (
          filteredByProject.map((project, idx) => {
            const pId = project.projectId || project.project_id || `proj-${idx}`;
            const pTitle = project.projectTitle || project.project_name || pId || 'پروژه عملیاتی';
            const isExpanded = !!expandedProjects[pId];

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
                    <span className="waiting-count-tag">{project.tasks?.length || 0} تسک منتظر</span>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="tasks-grid scrollable-tasks-grid">
                    {(project.tasks || []).map(task => {
                      const pri = priorityMap[task.priority] || { label: task.priority || 'متوسط', className: 'normal' };
                      const taskIdStr = task.task_id || task.id;
                      const teamName = task.waiting_for_team || task.blocked_by_team || 'تیم وابسته';
                      const jiraUrl = `${JIRA_BASE_URL}/browse/${taskIdStr}`;
                      
                      return (
                        <div key={task.id} className="waiting-task-card">
                          <div className="task-header">
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
                            
                            <h3 className="task-title">
                              <a href={jiraUrl} target="_blank" rel="noopener noreferrer" className="task-title-link">
                                {task.title}
                              </a>
                            </h3>
                          </div>
                          
                          <div className="task-details">
                            <div className="detail-item text-accent-orange">
                              <Clock size={15} />
                              <span>منتظر: <strong>{teamName}</strong></span>
                            </div>
                            
                            {task.waiting_reason && (
                              <div className="detail-item">
                                <AlertCircle size={15} />
                                <span>دلیل توقف: {task.waiting_reason}</span>
                              </div>
                            )}

                            {(() => {
                              let links = [];
                              try {
                                links = typeof task.linked_tasks === 'string' ? JSON.parse(task.linked_tasks) : (task.linked_tasks || []);
                              } catch (_) {}
                              if (!Array.isArray(links) || links.length === 0) return null;
                              return (
                                <div className="detail-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem', marginTop: '0.2rem' }}>
                                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <Link2 size={13} style={{ color: '#38BDF8' }} /> تسک‌های لینک‌شده / وابسته:
                                  </span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                    {links.map((lt, lIdx) => {
                                      const lUrl = `${JIRA_BASE_URL}/browse/${lt.key}`;
                                      const rel = lt.relationship || lt.linkType || 'وابسته به';
                                      const isServed = String(rel).toLowerCase().includes('served') || String(rel).toLowerCase().includes('serves');
                                      return (
                                        <a
                                          key={lIdx}
                                          href={lUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.3rem',
                                            fontSize: '0.74rem',
                                            padding: '0.18rem 0.55rem',
                                            borderRadius: '6px',
                                            background: isServed ? 'rgba(245, 158, 11, 0.18)' : 'rgba(56, 189, 248, 0.15)',
                                            border: isServed ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(56, 189, 248, 0.35)',
                                            color: isServed ? '#FDE68A' : '#7DD3FC',
                                            textDecoration: 'none',
                                            fontWeight: 600
                                          }}
                                          title={`${rel}: ${lt.title || lt.key} (${lt.status || ''})`}
                                        >
                                          <span>{rel}:</span>
                                          <strong style={{ color: '#FFFFFF' }}>{lt.key}</strong>
                                          {lt.status && <span style={{ opacity: 0.85, fontSize: '0.7rem' }}>({lt.status})</span>}
                                          <ExternalLink size={10} style={{ opacity: 0.7 }} />
                                        </a>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                            
                            <div className="task-meta">
                              <span className={`priority-tag ${pri.className}`}>
                                <Flag size={13} />
                                {pri.label}
                              </span>
                              
                              {task.due_date && (
                                <span className="due-date-tag">
                                  <Calendar size={13} />
                                  {task.due_date}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};

export default WaitingTasksPage;
