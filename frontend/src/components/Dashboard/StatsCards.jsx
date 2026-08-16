import React from 'react';
import { Layers, Activity, AlertOctagon, Clock, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './StatsCards.css';

const StatCard = ({ title, value, icon: Icon, colorClass, onClick }) => {
  const displayValue = parseInt(value) || 0;

  return (
    <div 
      className={`glass-card stat-card ${colorClass} ${onClick ? 'clickable' : ''}`} 
      onClick={onClick}
    >
      <div className="stat-content">
        <span className="stat-title">{title}</span>
        <h3 className="stat-value">{displayValue}</h3>
      </div>
      <div className="stat-icon-wrapper">
        <Icon size={24} className="stat-icon" />
      </div>
    </div>
  );
};

const StatsCards = ({ stats = {}, projects = [], onExport }) => {
  const navigate = useNavigate();

  return (
    <div className="stats-cards-wrapper">
      <div className="stats-top-container">
        <div className="stats-grid">
          <StatCard 
            title="کل پروژه‌ها" 
            value={stats.totalProjects || stats.total || projects.length || 0} 
            icon={Layers} 
            colorClass="blue" 
            onClick={() => navigate('/dashboard')}
          />
          <StatCard 
            title="در حال انجام" 
            value={stats.inProgress || stats.activeProjects || stats.in_progress || 0} 
            icon={Activity} 
            colorClass="green" 
            onClick={() => navigate('/dashboard?status=in_progress')}
          />
          <StatCard 
            title="پروژه‌های منتظر / بلوکه" 
            value={stats.waiting || stats.stoppedProjects || stats.blocked || 0} 
            icon={AlertOctagon} 
            colorClass="red" 
            onClick={() => navigate('/waiting-tasks')}
          />
          <StatCard 
            title="اسپرینت‌های فعال" 
            value={stats.activeSprints || stats.waitingTasks || stats.active_sprints || 0} 
            icon={Clock} 
            colorClass="purple" 
            onClick={() => navigate('/sprints')}
          />
        </div>

        {onExport && (
          <button 
            className="db-export-btn icon-only-btn"
            onClick={onExport}
            title="چاپ و خروجی PDF داشبورد"
          >
            <Printer size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default StatsCards;
