import React, { useEffect, useState } from 'react';
import { Layers, Activity, TrendingUp, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './StatsCards.css';

const StatCard = ({ title, value, icon: Icon, colorClass, delay, onClick }) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let start = 0;
    const end = parseInt(value) || 0;
    if (end === 0) return;
    
    const duration = 1200;
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

  const displayValue = typeof value === 'string' && value.includes('%') ? `${count}%` : count;

  return (
    <div 
      className={`glass-card stat-card ${colorClass} ${onClick ? 'clickable' : ''}`} 
      style={{ animationDelay: `${delay}ms` }}
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

const StatsCards = ({ stats, projects = [] }) => {
  const navigate = useNavigate();

  return (
    <div className="stats-cards-wrapper">
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
          title="میانگین پیشرفت کل پروژه‌ها" 
          value={`${stats.avgProgress || 0}%`} 
          icon={TrendingUp} 
          colorClass="purple" 
          delay={200} 
          onClick={() => navigate('/overall-timeline')}
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
    </div>
  );
};

export default StatsCards;
