import React from 'react';
import './common.css';

const StatusBadge = ({ status }) => {
  const getStatusConfig = () => {
    const s = (status || '').toLowerCase().trim();
    
    switch (s) {
      case 'done':
      case 'completed':
      case 'resolved':
      case 'closed':
      case 'انجام شده':
        return { text: 'انجام شده', className: 'status-done' };
        
      case 'in progress':
      case 'in_progress':
      case 'active':
      case 'in development':
      case 'در حال انجام':
        return { text: 'در حال انجام', className: 'status-active' };

      case 'in review':
      case 'review':
      case 'in_review':
      case 'در حال بررسی':
        return { text: 'در حال بررسی', className: 'status-active' };

      case 'testing':
      case 'qa':
      case 'در حال تست':
        return { text: 'در حال تست', className: 'status-active' };
        
      case 'blocked':
      case 'بلاک شده':
      case 'مسدود شده':
        return { text: 'مسدود شده', className: 'status-blocked' };

      case 'waiting':
      case 'onholding':
      case 'on hold':
      case 'on_hold':
      case 'در انتظار':
        return { text: 'در انتظار', className: 'status-waiting' };
        
      case 'to do':
      case 'todo':
      case 'backlog':
      case 'open':
      case 'برای انجام':
      case 'در صف انجام':
        return { text: 'برای انجام', className: 'status-todo' };
        
      default:
        return { text: status || 'نامشخص', className: 'status-todo' };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`status-badge ${config.className}`}>
      <span className="status-dot"></span>
      {config.text}
    </div>
  );
};

export default StatusBadge;
