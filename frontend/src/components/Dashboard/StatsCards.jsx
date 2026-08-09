import React, { useEffect, useState } from 'react';
import { Layers, Activity, TrendingUp, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './StatsCards.css';

const componentMetaMap = {
  learning: { label: '📘 یادگیری و آموزش', class: 'comp-learning' },
  meeting: { label: '👥 جلسات و هماهنگی', class: 'comp-meeting' },
  support: { label: '🛠️ پشتیبانی عملیاتی', class: 'comp-support' },
  dev: { label: '🚀 توسعه و اجرا', class: 'comp-dev' },
  architecture: { label: '🏛️ معماری سیستم', class: 'comp-arch' },
  security: { label: '🛡️ امنیت و دسترسی', class: 'comp-sec' },
  infrastructure: { label: '🌐 زیرساخت و کلاستر', class: 'comp-infra' },
  research: { label: '🔬 تحقیق و پژوهش', class: 'comp-research' },
  testing: { label: '🧪 تست و کیفیت', class: 'comp-qa' },
  documentation: { label: '📝 مستندسازی فنی', class: 'comp-doc' },
  devops: { label: '⚙️ دواپس و پایپ‌لاین', class: 'comp-devops' },
  monitoring: { label: '📈 مانیتورینگ و لمی', class: 'comp-mon' },
  ai: { label: '🤖 هوش مصنوعی', class: 'comp-ai' },
  database: { label: '🗄️ پایگاه داده (DBA)', class: 'comp-db' },
  networking: { label: '🔌 شبکه و اتصالات', class: 'comp-net' },
};

const getCompMeta = (key) => {
  if (componentMetaMap[key]) return componentMetaMap[key];
  const labelName = key.charAt(0).toUpperCase() + key.slice(1);
  return { label: `📌 ${labelName}`, class: 'comp-generic' };
};

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

const StatsCards = ({ stats, projects = [], activeCompFilter = 'all', onSelectComponent }) => {
  const navigate = useNavigate();

  // Collect ALL unique component keys dynamically across all projects
  const uniqueCompKeys = Array.from(
    new Set(
      projects.flatMap(p => Object.keys(p.components_map || {}))
    )
  );

  return (
    <div className="stats-cards-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Main Stats Row (Only 4 Standard Cards) */}
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

      {/* ONE SINGLE CLEAN INTERACTIVE COMPONENT SUMMARY PANEL */}
      {uniqueCompKeys.length > 0 && (
        <div className="glass-card comp-summary-panel">
          <div className="csp-header">
            <Layers size={16} className="text-accent-cyan" />
            <span>فیلتر پروژه‌ها بر اساس کامپوننت ({uniqueCompKeys.length} کامپوننت فعال - روی هر کدام کلیک کنید):</span>
          </div>
          <div className="csp-list">
            {/* Reset All Button */}
            <div 
              className={`csp-item csp-all-item ${activeCompFilter === 'all' ? 'active' : ''}`}
              onClick={() => onSelectComponent && onSelectComponent('all')}
            >
              <span className="csp-label">🌐 همه پروژه‌ها</span>
              <span className="csp-count"><strong>{projects.length}</strong> پروژه</span>
            </div>

            {/* Interactive Component Badges */}
            {uniqueCompKeys.map(key => {
              const meta = getCompMeta(key);
              const pCount = projects.filter(p => p.components_map && p.components_map[key] > 0).length;
              const isActive = activeCompFilter === key;

              return (
                <div 
                  key={key} 
                  className={`csp-item ${meta.class} ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectComponent && onSelectComponent(key)}
                  title={`کلیک کنید برای فیلتر پروژه‌های ${meta.label}`}
                >
                  <span className="csp-label">{meta.label}</span>
                  <span className="csp-count"><strong>{pCount}</strong> پروژه</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsCards;
