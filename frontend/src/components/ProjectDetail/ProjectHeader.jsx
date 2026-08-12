import React, { useEffect, useState } from 'react';
import { Calendar, ExternalLink, Zap, Clock, CheckCircle2, Printer } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import './ProjectHeader.css';

const JIRA_BASE_URL = 'https://10.100.71.140:8443';

const categoryMap = {
  'devops': 'دواپس',
  'monitoring': 'مانیتورینگ',
  'infrastructure': 'زیرساخت',
  'security': 'امنیت',
  'ai': 'هوش مصنوعی',
  'training': 'آموزش',
  'general': 'عمومی',
};

const formatDate = (dateStr) => {
  if (!dateStr) return '---';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fa-IR');
  } catch {
    return dateStr;
  }
};

const ProjectHeader = ({ project, capabilities = [] }) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const progress = Math.round(project.progress || 0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 300);
    return () => clearTimeout(timer);
  }, [progress]);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedProgress / 100) * circumference;

  const categoryLabel = categoryMap[project.category] || project.category;
  const epicJiraUrl = `${JIRA_BASE_URL}/browse/${project.id}`;

  const tasks = project.tasks || [];
  const totalSpentHours = Math.round(
    (project.total_spent_hours || tasks.reduce((sum, t) => sum + (t.spent_hours || 0), 0)) * 100
  ) / 100;
  const totalEstimateHours = Math.round(
    (project.total_estimate_hours || tasks.reduce((sum, t) => sum + (t.estimate_hours || 0), 0)) * 100
  ) / 100;

  const [isDescExpanded, setIsDescExpanded] = useState(false);

  return (
    <div className="glass-card project-header-card">
      <div className="ph-info">
        <div className="ph-badges">
          <a 
            href={epicJiraUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="ph-epic-link"
            title={`مشاهده اپیک ${project.id} در سیستم جیرا`}
          >
            <span className="ph-epic-badge">
              <Zap size={14} className="text-accent-yellow" />
              اپیک جیرا: {project.id}
              <ExternalLink size={13} className="ph-link-icon" />
            </span>
          </a>

          <span className="ph-category">{categoryLabel}</span>
          {project.quarters && project.quarters.map(q => (
            <span key={q} className="ph-quarter-badge">
              📅 {q}
            </span>
          ))}
          <StatusBadge status={project.status} />

          <button 
            className="ph-export-btn"
            onClick={() => window.open(`/api/reports/project-html/${project.id}?token=${localStorage.getItem('token')}`, '_blank')}
            title="دانلود / چاپ گزارش رسمی و نمودار گانت پروژه"
          >
            <Printer size={14} />
            <span>چاپ / خروجی PDF پروژه</span>
          </button>
        </div>

        <h1 className="ph-title">{project.title}</h1>
        
        {project.description && (
          <div className="ph-description-box">
            <p className={`ph-description ${isDescExpanded ? 'expanded' : 'collapsed'}`}>
              {project.description}
            </p>
            {project.description.length > 100 && (
              <button 
                className="ph-toggle-desc-btn" 
                onClick={() => setIsDescExpanded(!isDescExpanded)}
              >
                {isDescExpanded ? 'بستن توضیحات ▴' : 'مشاهده کامل توضیحات اپیک ▾'}
              </button>
            )}
          </div>
        )}

        {/* Capabilities Badges directly merged inside Project Header */}
        {capabilities && capabilities.length > 0 && (
          <div className="ph-capabilities-row">
            <span className="ph-cap-label">قابلیت‌های عملیاتی:</span>
            <div className="ph-cap-pills">
              {capabilities.map((cap, idx) => (
                <span key={idx} className="ph-cap-pill">
                  <CheckCircle2 size={13} className="text-accent-green" />
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <div className="ph-dates">
          <div className="ph-date-item">
            <Calendar size={16} />
            <span>شروع: {formatDate(project.start_date || project.startDate)}</span>
          </div>
          <div className="ph-date-divider"></div>
          <div className="ph-date-item">
            <Calendar size={16} />
            <span>پایان: {formatDate(project.due_date || project.endDate)}</span>
          </div>
          <div className="ph-date-divider"></div>
          <div className="ph-date-item ph-hours-item">
            <Clock size={16} className="text-accent-cyan" />
            <span>مجموع کارکرد: <strong>{totalSpentHours}h</strong> {totalEstimateHours > 0 && <small>({totalEstimateHours}h تخمین)</small>}</span>
          </div>
        </div>

        {project.confluence_link && (
          <a 
            href={project.confluence_link} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="ph-confluence-btn"
            title="مشاهده مستندات تکمیلی در Confluence"
          >
            <span>📘 مستندات تکمیلی در Confluence</span>
            <ExternalLink size={14} className="ph-link-icon" />
          </a>
        )}
      </div>
      
      <div className="ph-progress">
        <svg width="120" height="120" viewBox="0 0 120 120" className="circular-chart">
          <circle 
            className="circular-bg"
            strokeWidth="8"
            cx="60" cy="60" r="40" 
          />
          <circle 
            className="circular-progress"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            cx="60" cy="60" r="40" 
          />
          <text x="60" y="60" className="percentage" dominantBaseline="middle" textAnchor="middle">
            {animatedProgress}%
          </text>
        </svg>
      </div>
    </div>
  );
};

export default ProjectHeader;
