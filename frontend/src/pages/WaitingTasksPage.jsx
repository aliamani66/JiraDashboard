import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, Clock, ClipboardList, AlertCircle, Calendar, Flag, ExternalLink, Printer, Search, FolderGit2 } from 'lucide-react';
import { useWaitingTasks } from '../hooks/useProjects';
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
  const [jiraProjectFilter, setJiraProjectFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (loading) {
    return <div className="page-loading">در حال دریافت اطلاعات تسک‌های منتظر...</div>;
  }

  const { totalWaiting = 0, byProject = [] } = data || {};

  // Extract unique Jira Project Keys (e.g. ORD, OPS, DEV)
  const jiraProjectsList = Array.from(
    new Set(
      byProject.map(p => {
        const pId = p.projectId || p.project_id || '';
        return pId ? pId.split('-')[0] : '';
      }).filter(Boolean)
    )
  ).sort();

  // Filter projects by Jira Project Key and search query
  const filteredByProject = byProject.filter(project => {
    const pId = project.projectId || project.project_id || '';
    const pTitle = project.projectTitle || project.project_name || '';
    const jKey = pId ? pId.split('-')[0] : '';

    if (jiraProjectFilter !== 'all' && jKey !== jiraProjectFilter) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchId = pId.toLowerCase().includes(q);
      const matchTitle = pTitle.toLowerCase().includes(q);
      const matchTask = (project.tasks || []).some(t =>
        (t.task_id || t.id || '').toLowerCase().includes(q) ||
        (t.title || '').toLowerCase().includes(q) ||
        (t.waiting_for_team || '').toLowerCase().includes(q)
      );
      if (!matchId && !matchTitle && !matchTask) return false;
    }

    return true;
  });

  return (
    <motion.div 
      className="waiting-tasks-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="page-header">
        <Link to="/" className="back-link">
          <ChevronLeft size={20} />
          بازگشت به داشبورد
        </Link>
        <h1 className="page-title">
          <Clock size={28} className="text-accent-orange" />
          تسک‌های منتظر و آن‌هولد تیم‌های دیگر ({totalWaiting} تسک)
        </h1>

        <button 
          className="wt-export-btn"
          onClick={() => window.open(`/api/reports/waiting-html?token=${localStorage.getItem('token')}`, '_blank')}
          title="دانلود و چاپ خروجی گزارش تسک‌های منتظر و آن‌هولد"
        >
          <Printer size={16} />
          <span>چاپ / خروجی PDF تسک‌های منتظر</span>
        </button>
      </div>

      {/* Jira Project Filter & Search Bar */}
      <div className="glass-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <FolderGit2 size={18} style={{ color: '#C084FC' }} />
          <strong style={{ fontSize: '0.9rem', color: '#E9D5FF' }}>فیلتر بر اساس پروژه Jira:</strong>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            <button
              onClick={() => setJiraProjectFilter('all')}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '16px',
                border: jiraProjectFilter === 'all' ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.15)',
                background: jiraProjectFilter === 'all' ? 'rgba(14,165,233,0.3)' : 'rgba(255,255,255,0.05)',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🌐 همه پروژه‌های Jira ({jiraProjectsList.length})
            </button>

            {jiraProjectsList.map(pKey => {
              const isSel = jiraProjectFilter === pKey;
              return (
                <button
                  key={pKey}
                  onClick={() => setJiraProjectFilter(pKey)}
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: '16px',
                    border: isSel ? '1px solid #C084FC' : '1px solid rgba(255,255,255,0.15)',
                    background: isSel ? 'linear-gradient(135deg, rgba(168,85,247,0.35), rgba(192,132,252,0.35))' : 'rgba(255,255,255,0.05)',
                    color: '#FFFFFF',
                    fontSize: '0.82rem',
                    fontWeight: isSel ? '800' : '500',
                    cursor: 'pointer'
                  }}
                >
                  📂 پروژه {pKey}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={15} style={{ position: 'absolute', right: '0.85rem', color: '#38BDF8', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="جستجوی عنوان تسک یا تیم وابسته..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '20px',
              padding: '0.4rem 2.2rem 0.4rem 1rem',
              color: '#FFFFFF',
              fontSize: '0.84rem',
              outline: 'none',
              width: '240px'
            }}
          />
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

            return (
              <div key={pId} className="glass-card project-group-card">
                <div className="project-group-header">
                  <h2 className="project-group-title">
                    <ClipboardList size={22} className="text-accent-cyan" />
                    <Link to={`/project/${pId}`} className="project-group-link" title="مشاهده جزئیات پروژه">
                      <span>{pTitle}</span>
                      <span className="project-id-badge">({pId})</span>
                      <ExternalLink size={16} className="link-icon" />
                    </Link>
                  </h2>
                  <span className="waiting-count-tag">{project.tasks?.length || 0} تسک منتظر</span>
                </div>
                
                <div className="tasks-grid">
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
                            <Clock size={16} />
                            <span>منتظر: <strong>{teamName}</strong></span>
                          </div>
                          
                          {task.waiting_reason && (
                            <div className="detail-item">
                              <AlertCircle size={16} />
                              <span>دلیل توقف: {task.waiting_reason}</span>
                            </div>
                          )}
                          
                          <div className="task-meta">
                            <span className={`priority-tag ${pri.className}`}>
                              <Flag size={14} />
                              اولویت: {pri.label}
                            </span>
                            
                            {task.due_date && (
                              <span className="due-date-tag">
                                <Calendar size={14} />
                                سررسید: {task.due_date}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};

export default WaitingTasksPage;
