import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft, Clock, ClipboardList, AlertCircle, Calendar, Flag, ExternalLink, Printer } from 'lucide-react';
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

  if (loading) {
    return <div className="page-loading">در حال دریافت اطلاعات تسک‌های منتظر...</div>;
  }

  const { totalWaiting = 0, byProject = [] } = data || {};

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

      <div className="projects-container">
        {byProject.length === 0 ? (
          <div className="glass-card empty-state">
            تسکی در انتظار تیم‌های دیگر نیست.
          </div>
        ) : (
          byProject.map((project, idx) => {
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
