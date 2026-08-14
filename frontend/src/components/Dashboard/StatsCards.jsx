import React, { useEffect, useState } from 'react';
import { Layers, Activity, AlertOctagon, Clock, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './StatsCards.css';

const StatCard = ({ title, value, icon: Icon, colorClass, delay, onClick }) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let start = 0;
    const end = parseInt(value) || 0;
    if (end === 0) {
      setCount(0);
      return;
    }
    
    const duration = 1000;
    const increment = end / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    
    return () => clearInterval(timer);
  }, [value]);

  return (
    <div 
      className={`glass-card stat-card ${colorClass} ${onClick ? 'clickable' : ''}`} 
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
    >
      <div className="stat-content">
        <span className="stat-title">{title}</span>
        <h3 className="stat-value">{count}</h3>
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
            delay={0} 
          />
          <StatCard 
            title="پروژه‌های فعال" 
            value={stats.activeProjects || stats.active || 0} 
            icon={Activity} 
            colorClass="green" 
            delay={100} 
          />
          <StatCard 
            title="پروژه‌های متوقف‌شده" 
            value={stats.stoppedProjects || 0} 
            icon={AlertOctagon} 
            colorClass="red" 
            delay={200} 
          />
          <StatCard 
            title="تسک‌های منتظر" 
            value={stats.waitingTasks || 0} 
            icon={Clock} 
            colorClass="orange" 
            delay={300} 
            onClick={() => navigate('/waiting-tasks')}
          />
        </div>

        {onExport && (
          <button 
            className="db-export-btn icon-only-btn"
            onClick={onExport}
            title="چاپ و خروجی PDF پروژه‌ها"
          >
            <Printer size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default StatsCards;
