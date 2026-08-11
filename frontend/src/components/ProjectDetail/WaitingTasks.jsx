import React from 'react';
import { Clock, Users, AlertCircle, ExternalLink } from 'lucide-react';
import './WaitingTasks.css';

const JIRA_BASE_URL = 'https://10.100.71.140:8443';

const priorityMap = {
  'High': 'بالا',
  'Medium': 'متوسط',
  'Low': 'پایین',
  'Critical': 'بحرانی',
};

const WaitingTasks = ({ tasks }) => {
  return (
    <div className="glass-card waiting-tasks-card">
      <h3 className="section-title waiting-title">
        <Clock size={20} />
        تسک‌های منتظر تیم‌های دیگر
      </h3>
      
      <div className="waiting-list">
        {tasks.map(task => {
          const taskIdStr = task.task_id || task.id;
          const teamName = task.waiting_for_team || task.blocked_by_team || task.waitingOn || 'نامشخص';
          const reason = task.waiting_reason || task.blocked_reason || '';
          const priority = priorityMap[task.priority] || task.priority || 'متوسط';
          const jiraUrl = `${JIRA_BASE_URL}/browse/${taskIdStr}`;
          
          return (
            <div key={task.id} className="waiting-item">
              <div className="waiting-item-header">
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
              </div>
              
              <h4 className="waiting-task-name">
                <a href={jiraUrl} target="_blank" rel="noopener noreferrer" className="task-title-link">
                  {task.title}
                </a>
              </h4>
              
              <div className="waiting-details">
                <div className="waiting-detail-row">
                  <Users size={14} />
                  <span>منتظر: <strong>{teamName}</strong></span>
                </div>
                {reason && (
                  <div className="waiting-detail-row waiting-reason">
                    <AlertCircle size={14} />
                    <span>دلیل: {reason}</span>
                  </div>
                )}
              </div>
              
              <span className={`priority-badge ${priority === 'بالا' || priority === 'بحرانی' ? 'critical' : ''}`}>
                {priority}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WaitingTasks;
