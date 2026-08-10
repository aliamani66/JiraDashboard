import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import './ProjectCard.css';

const componentMetaMap = {
  learning: { label: '📘 یادگیری', title: 'یادگیری و آموزش', class: 'comp-learning' },
  meeting: { label: '👥 جلسه', title: 'جلسات و هماهنگی', class: 'comp-meeting' },
  support: { label: '🛠️ پشتیبانی', title: 'پشتیبانی عملیاتی', class: 'comp-support' },
  dev: { label: '🚀 توسعه', title: 'توسعه و پیاده‌سازی', class: 'comp-dev' },
  architecture: { label: '🏛️ معماری', title: 'معماری سیستم', class: 'comp-arch' },
  security: { label: '🛡️ امنیت', title: 'امنیت و دسترسی', class: 'comp-sec' },
  infrastructure: { label: '🌐 زیرساخت', title: 'زیرساخت و کلاستر', class: 'comp-infra' },
  research: { label: '🔬 تحقیق', title: 'تحقیق و پژوهش', class: 'comp-research' },
  testing: { label: '🧪 تست', title: 'تست و کیفیت', class: 'comp-qa' },
  documentation: { label: '📝 مستندات', title: 'مستندسازی فنی', class: 'comp-doc' },
};

const getCompMeta = (key) => {
  if (componentMetaMap[key]) return componentMetaMap[key];
  const labelName = key.charAt(0).toUpperCase() + key.slice(1);
  return { label: `📌 ${labelName}`, title: labelName, class: 'comp-generic' };
};

const ProjectCard = ({ project }) => {
  const totalTasks = project.total_tasks || project.tasks?.total || 0;
  const completedTasks = project.completed_tasks || project.tasks?.completed || 0;
  const waitingTasks = project.waiting_tasks || project.tasks?.waiting || 0;
  const progress = Math.round(project.progress || 0);

  const activeTasks = totalTasks - completedTasks;
  // Check if 100% of remaining active tasks are waiting/onholding
  const isFullyStopped = totalTasks > 0 && activeTasks > 0 && waitingTasks >= activeTasks;

  const estimateHours = Math.round(project.total_estimate_hours || (project.tasks ? project.tasks.reduce((sum, t) => sum + (t.estimate_hours || 0), 0) : 0));
  const spentHours = Math.round(project.total_spent_hours || (project.tasks ? project.tasks.reduce((sum, t) => sum + (t.spent_hours || 0), 0) : 0));

  // Circular SVG ring math
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Dynamic component map for this project
  const compMap = project.components_map || {};

  return (
    <Link to={`/project/${project.id}`} className="project-card-link">
      <div className={`glass-card project-card-v2 ${isFullyStopped ? 'pc-stopped' : ''}`}>
        
        {/* Full Stoppage Banner Alert */}
        {isFullyStopped && (
          <div className="pc-stoppage-banner">
            <AlertTriangle size={15} className="pulse-icon" />
            <span>🛑 پروژه کاملاً متوقف گردیده (منتظر تیم‌های دیگر)</span>
          </div>
        )}

        {/* Top Row: Status Badge on right, Project ID on left */}
        <div className="pc-top-row">
          <StatusBadge status={isFullyStopped ? 'Critical' : project.status} />
          <span className="pc-project-id">{project.id}</span>
        </div>

        {/* Project Title */}
        <h3 className="pc-title" title={project.title}>
          {project.title}
        </h3>

        {/* Project Description */}
        {project.description && (
          <p className="pc-description" title={project.description}>
            {project.description}
          </p>
        )}

        {/* Quarter Badges Row */}
        {project.quarters && project.quarters.length > 0 && (
          <div className="pc-quarters-row">
            <span className="pc-quarter-heading">فصل‌ها:</span>
            {project.quarters.map(q => (
              <span key={q} className="pc-quarter-pill">
                🏷️ {q}
              </span>
            ))}
          </div>
        )}

        {/* Middle Progress Section */}
        <div className="pc-middle-section">
          <div className="pc-text-stats">
            <div className="pc-task-count">
              <strong>{completedTasks}/{totalTasks}</strong> تسک
            </div>
            <div className="pc-progress-pct">
              پیشرفت <strong>%{progress}</strong>
            </div>
            {waitingTasks > 0 && (
              <div className="pc-waiting-count text-orange">
                ⏳ <strong>{waitingTasks}</strong> تسک منتظر
              </div>
            )}
          </div>

          <div className="pc-circle-ring">
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle
                cx="35"
                cy="35"
                r={radius}
                className="circle-bg"
                strokeWidth="5.5"
              />
              <circle
                cx="35"
                cy="35"
                r={radius}
                className={`circle-progress ${isFullyStopped ? 'stopped-ring' : ''}`}
                strokeWidth="5.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 35 35)"
              />
            </svg>
          </div>
        </div>

        {/* Dynamic Component Distribution Badges Row */}
        {Object.keys(compMap).length > 0 && (
          <div className="pc-components-row">
            {Object.entries(compMap).map(([key, count]) => {
              if (count === 0) return null;
              const meta = getCompMeta(key);
              return (
                <span 
                  key={key} 
                  className={`pc-comp-pill ${meta.class}`} 
                  title={`${count} تسک ${meta.title}`}
                >
                  {meta.label} ({count})
                </span>
              );
            })}
          </div>
        )}

        {/* Dotted Divider Line */}
        <div className="pc-dotted-divider" />

        {/* Bottom Hours Row: Estimate on right, Spent on left */}
        <div className="pc-bottom-row">
          <div className="pc-spent-time">
            صرف‌شده: <strong>{spentHours}h</strong>
          </div>
          <div className="pc-estimate-time">
            Estimate: <strong>{estimateHours}h</strong>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProjectCard;
