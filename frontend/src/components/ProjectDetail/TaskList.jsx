import React, { useState } from 'react';
import { ListTodo, ExternalLink, User, Link2 } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import './TaskList.css';
import './TaskListFeatures.css';

const JIRA_BASE_URL = 'https://10.100.71.140:8443';

const priorityMap = {
  'High': { label: 'بالا', className: 'high' },
  'Medium': { label: 'متوسط', className: 'normal' },
  'Low': { label: 'پایین', className: 'low' },
  'Critical': { label: 'بحرانی', className: 'critical' },
};

const compBadgeMap = {
  learning: { label: '📘 یادگیری', className: 'comp-learning' },
  meeting: { label: '👥 جلسه', className: 'comp-meeting' },
  support: { label: '🛠️ پشتیبانی', className: 'comp-support' },
  dev: { label: '🚀 توسعه', className: 'comp-dev' },
};

const TaskList = ({ tasks }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [compFilter, setCompFilter] = useState('all');

  const filteredTasks = tasks.filter(task => {
    // Status Filter
    if (statusFilter === 'active' && !(task.status === 'In Progress' || task.status === 'in_progress')) return false;
    if (statusFilter === 'done' && !(task.status === 'Done' || task.status === 'done')) return false;
    if (statusFilter === 'waiting' && !(task.status === 'Waiting' || task.status === 'OnHolding' || task.status === 'waiting' || task.status === 'onholding' || task.is_blocked)) return false;

    // Component Filter
    if (compFilter !== 'all' && (task.component || 'dev') !== compFilter) return false;

    return true;
  });

  return (
    <div className="glass-card task-list-card">
      <div className="task-list-header">
        <h3 className="section-title">
          <ListTodo size={20} className="text-accent-blue" />
          لیست تسک‌ها
        </h3>
        
        <div className="task-filters-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div className="task-filters">
            <button className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>همه ({tasks.length})</button>
            <button className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`} onClick={() => setStatusFilter('active')}>در حال انجام</button>
            <button className={`filter-btn ${statusFilter === 'done' ? 'active' : ''}`} onClick={() => setStatusFilter('done')}>انجام شده</button>
            <button className={`filter-btn ${statusFilter === 'waiting' ? 'active' : ''}`} onClick={() => setStatusFilter('waiting')}>منتظر</button>
          </div>

          {/* Component Filters */}
          <div className="task-filters comp-filters">
            <button className={`filter-btn ${compFilter === 'all' ? 'active' : ''}`} onClick={() => setCompFilter('all')}>کامپوننت: همه</button>
            <button className={`filter-btn ${compFilter === 'learning' ? 'active' : ''}`} onClick={() => setCompFilter('learning')}>📘 یادگیری</button>
            <button className={`filter-btn ${compFilter === 'meeting' ? 'active' : ''}`} onClick={() => setCompFilter('meeting')}>👥 جلسات</button>
            <button className={`filter-btn ${compFilter === 'support' ? 'active' : ''}`} onClick={() => setCompFilter('support')}>🛠️ پشتیبانی</button>
            <button className={`filter-btn ${compFilter === 'dev' ? 'active' : ''}`} onClick={() => setCompFilter('dev')}>🚀 توسعه</button>
          </div>
        </div>
      </div>
      
      <div className="table-responsive">
        <table className="task-table">
          <thead>
            <tr>
              <th>کد</th>
              <th>کامپوننت</th>
              <th>وضعیت</th>
              <th>عنوان تسک</th>
              <th>مسئول</th>
              <th>اسپرینت</th>
              <th>پیشرفت زمان</th>
              <th>اولویت</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map(task => {
              const taskIdStr = task.task_id || task.id;
              const est = Math.round((Number(task.estimate_hours || task.estimate) || 0) * 100) / 100;
              const spent = Math.round((Number(task.spent_hours || task.spent) || 0) * 100) / 100;
              const timeProgress = est > 0 ? Math.min(100, (spent / est) * 100) : 0;
              const pri = priorityMap[task.priority] || { label: task.priority || 'متوسط', className: 'normal' };
              const compInfo = compBadgeMap[task.component || 'dev'] || compBadgeMap.dev;
              const jiraUrl = `${JIRA_BASE_URL}/browse/${taskIdStr}`;
              
              return (
                <tr key={task.id} className={task.is_blocked || task.status === 'Waiting' || task.status === 'OnHolding' ? 'row-waiting' : ''}>
                  <td>
                    <a 
                      href={jiraUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="task-jira-link"
                      title={`مشاهده تسک ${taskIdStr} در جیرا`}
                    >
                      <span className="task-id-badge">
                        {taskIdStr}
                        <ExternalLink size={11} className="jira-link-icon" />
                      </span>
                    </a>
                  </td>
                  <td>
                    <span className={`comp-badge ${compInfo.className}`}>
                      {compInfo.label}
                    </span>
                  </td>
                  <td><StatusBadge status={task.status} /></td>
                  <td className="task-title-cell">
                    <div className="task-title-header">
                      <a 
                        href={jiraUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="task-title-link"
                      >
                        {task.title}
                      </a>
                    </div>

                    {/* 🔗 Linked Tasks / External Dependencies (e.g. is served by, blocks) */}
                    {(() => {
                      let links = [];
                      try {
                        links = typeof task.linked_tasks === 'string' ? JSON.parse(task.linked_tasks) : (task.linked_tasks || []);
                      } catch (_) {}
                      if (!Array.isArray(links) || links.length === 0) return null;
                      return (
                        <div className="task-linked-issues-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem', marginBottom: '0.25rem' }}>
                          {links.map((lt, lIdx) => {
                            const lUrl = `${JIRA_BASE_URL}/browse/${lt.key}`;
                            const rel = lt.relationship || lt.linkType || 'وابسته به';
                            const rLow = String(rel).toLowerCase();
                            const isBlock = rLow.includes('block');
                            const isServeOperate = rLow.includes('serve') || rLow.includes('operat') || rLow.includes('depend') || rLow.includes('wait') || rLow.includes('hold');
                            
                            const bg = isBlock 
                              ? 'rgba(239, 68, 68, 0.22)' 
                              : isServeOperate 
                              ? 'rgba(245, 158, 11, 0.22)' 
                              : 'rgba(56, 189, 248, 0.18)';
                            const border = isBlock ? '1px solid #EF4444' : isServeOperate ? '1px solid #F59E0B' : '1px solid #38BDF8';
                            const textCol = isBlock ? '#FCA5A5' : isServeOperate ? '#FDE68A' : '#BAE6FD';

                            return (
                              <a
                                key={lIdx}
                                href={lUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  fontSize: '0.76rem',
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '8px',
                                  background: bg,
                                  border: border,
                                  color: textCol,
                                  textDecoration: 'none',
                                  fontWeight: 700,
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                                }}
                                title={`${rel}: ${lt.title || lt.key} (${lt.status || ''})`}
                              >
                                <Link2 size={12} />
                                <span>{rel}:</span>
                                <strong style={{ color: '#FFFFFF', textDecoration: 'underline' }}>{lt.key}</strong>
                                {lt.status && <span style={{ opacity: 0.9, fontSize: '0.72rem', background: 'rgba(0,0,0,0.3)', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>{lt.status}</span>}
                                <ExternalLink size={10} style={{ opacity: 0.8 }} />
                              </a>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Waiting / Blocked Info */}
                    {(task.waiting_for_team || task.blocked_by_team || task.waiting_reason) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.3rem', fontSize: '0.78rem' }}>
                        {(task.waiting_for_team || task.blocked_by_team) && (
                          <span className="blocked-team-tag" style={{ background: 'rgba(239, 68, 68, 0.18)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#FCA5A5', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>
                            ⏳ منتظر: {task.waiting_for_team || task.blocked_by_team}
                          </span>
                        )}
                        {task.waiting_reason && (
                          <span style={{ color: '#FCD34D', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                            ⚠️ {task.waiting_reason}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Description Text */}
                    {task.description && (
                      <p className="task-desc-text" title={task.description} style={{ marginTop: '0.35rem' }}>
                        📝 {task.description}
                      </p>
                    )}
                  </td>
                  <td>
                    <div className="task-assignee-badge">
                      <User size={13} className="text-accent-blue" />
                      <span>{task.assignee || 'تخصیص‌نیافته'}</span>
                    </div>
                  </td>
                  <td>
                    {task.sprint_name && <span className="sprint-tag">{task.sprint_name}</span>}
                  </td>
                  <td className="task-time-col">
                    <div className="mini-progress-container">
                      <div className="mini-progress-info">
                        <span>{spent}h</span>
                        <span>/ {est}h</span>
                      </div>
                      <div className="mini-progress-bar">
                        <div 
                          className="mini-progress-fill" 
                          style={{ width: `${timeProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`priority-tag ${pri.className}`}>
                      {pri.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredTasks.length === 0 && (
          <div className="no-tasks">تسکی با این وضعیت یا کامپوننت یافت نشد.</div>
        )}
      </div>
    </div>
  );
};

export default TaskList;
