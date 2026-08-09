import React from 'react';
import { AlertOctagon, Clock, Users } from 'lucide-react';
import './BlockedTasks.css';

const priorityMap = {
  'High': 'بالا',
  'Medium': 'متوسط',
  'Low': 'پایین',
  'Critical': 'بحرانی',
};

const BlockedTasks = ({ tasks }) => {
  return (
    <div className="glass-card blocked-tasks-card">
      <h3 className="section-title blocked-title">
        <AlertOctagon size={20} />
        تسک‌های منتظر تیم‌های دیگر
      </h3>
      
      <div className="blocked-list">
        {tasks.map(task => {
          const teamName = task.blocked_by_team || task.waitingOn || 'نامشخص';
          const reason = task.blocked_reason || '';
          const priority = priorityMap[task.priority] || task.priority || 'متوسط';
          
          // Calculate days blocked
          const startDate = task.start_date ? new Date(task.start_date) : null;
          const daysDiff = startDate ? Math.floor((Date.now() - startDate.getTime()) / (1000*60*60*24)) : 0;

          return (
            <div key={task.id} className="blocked-item">
              <h4 className="blocked-task-name">{task.title}</h4>
              
              <div className="blocked-details">
                <div className="blocked-detail-row">
                  <Users size={14} />
                  <span>منتظر: <strong>{teamName}</strong></span>
                </div>
                {reason && (
                  <div className="blocked-detail-row blocked-reason">
                    <span>دلیل: {reason}</span>
                  </div>
                )}
                <div className="blocked-detail-row">
                  <Clock size={14} />
                  <span>{daysDiff > 0 ? `${daysDiff} روز متوقف` : 'اخیراً بلاک شده'}</span>
                </div>
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

export default BlockedTasks;
