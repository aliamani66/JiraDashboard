import React from 'react';
import './common.css';

const StatusBadge = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'In Progress':
      case 'active':
      case 'in_progress':
        return { text: 'در حال انجام', className: 'status-active' };
      case 'Done':
      case 'done':
      case 'completed':
        return { text: 'انجام شده', className: 'status-done' };
      case 'Blocked':
      case 'blocked':
        return { text: 'بلاک شده', className: 'status-blocked' };
      case 'Waiting':
      case 'waiting':
      case 'OnHolding':
      case 'onholding':
        return { text: 'در انتظار', className: 'status-waiting' };
      case 'To Do':
      case 'todo':
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
