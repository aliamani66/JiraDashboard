import React, { useState } from 'react';
import { Target, Calendar, CheckCircle2, Circle, ExternalLink, Filter, Zap, Repeat } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import './SprintSection.css';

const JIRA_BASE_URL = 'https://aliamani6.atlassian.net';

const SprintSection = ({ tasks = [] }) => {
  // Group tasks by sprint (supporting tasks assigned to MULTIPLE sprints)
  const sprintGroups = {};

  tasks.forEach(task => {
    let taskSprints = [];
    
    // Parse labels array safely
    let labelsArr = [];
    if (Array.isArray(task.labels)) {
      labelsArr = task.labels;
    } else if (typeof task.labels === 'string') {
      try { labelsArr = JSON.parse(task.labels); } catch (e) { labelsArr = []; }
    }

    labelsArr.forEach(l => {
      if (typeof l === 'string' && l.startsWith('sprint:')) {
        const num = l.replace('sprint:', '').trim();
        const sName = `Sprint ${num}`;
        if (!taskSprints.includes(sName)) taskSprints.push(sName);
      }
    });

    if (taskSprints.length === 0 && task.sprint_name) {
      taskSprints.push(task.sprint_name);
    }
    if (taskSprints.length === 0) {
      taskSprints.push('Sprint عمومی');
    }

    taskSprints.forEach(sName => {
      if (!sprintGroups[sName]) {
        sprintGroups[sName] = {
          name: sName,
          startDate: task.sprint_start_date,
          endDate: task.sprint_end_date,
          tasks: []
        };
      }
      if (!sprintGroups[sName].tasks.some(t => t.id === task.id)) {
        sprintGroups[sName].tasks.push({
          ...task,
          isMultiSprint: taskSprints.length > 1,
          allSprints: taskSprints
        });
      }
    });
  });

  const sprints = Object.values(sprintGroups).sort((a, b) => {
    const numA = parseInt(a.name.match(/\d+/)?.[0] || 0);
    const numB = parseInt(b.name.match(/\d+/)?.[0] || 0);
    return numB - numA; // Newest / highest sprint first (Current Sprint is on top)
  });

  if (sprints.length === 0) return null;

  const [selectedSprintName, setSelectedSprintName] = useState(sprints[0]?.name || '');
  const activeSprint = sprints.find(s => s.name === selectedSprintName) || sprints[0];
  const isCurrentActiveSprint = activeSprint.name === sprints[0].name;

  // Generate Jira Sprint Search / Board URL
  const projectKey = tasks[0]?.project_id?.split('-')[0] || 'ORD';
  const sprintJiraUrl = `${JIRA_BASE_URL}/issues/?jql=project%20%3D%20${projectKey}%20AND%20sprint%20%3D%20%22${encodeURIComponent(activeSprint.name)}%22`;

  return (
    <div className="sprint-section">
      <div className="sprint-header glass-card">
        <div className="sprint-title">
          <Target size={24} className="text-accent-cyan" />
          <h2>
            {isCurrentActiveSprint ? (
              <span className="current-sprint-badge-glow">
                <Zap size={14} className="text-accent-yellow" />
                اسپرینت جاری عملیاتی:
              </span>
            ) : (
              <span>تسک‌های اسپرینت:</span>
            )}{' '}
            <a 
              href={sprintJiraUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="sprint-jira-link"
              title={`مشاهده ${activeSprint.name} در سیستم جیرا`}
            >
              <span>{activeSprint.name}</span>
              <ExternalLink size={18} className="sprint-link-icon" />
            </a>
          </h2>
        </div>

        {/* Sprint Selector Dropdown & Date Range */}
        <div className="sprint-controls-row">
          {sprints.length > 1 && (
            <div className="sprint-select-wrapper">
              <Filter size={14} className="sprint-select-icon" />
              <select 
                value={activeSprint.name} 
                onChange={(e) => setSelectedSprintName(e.target.value)}
                className="sprint-dropdown"
              >
                {sprints.map((s, idx) => (
                  <option key={s.name} value={s.name}>
                    {idx === 0 ? `📍 ${s.name} (اسپرینت جاری - ${s.tasks.length} تسک)` : `${s.name} (${s.tasks.length} تسک)`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeSprint.startDate && activeSprint.endDate && (
            <div className="sprint-dates">
              <Calendar size={15} />
              <span>{activeSprint.startDate} تا {activeSprint.endDate}</span>
            </div>
          )}
        </div>
      </div>

      <div className="sprint-tasks-grid">
        {activeSprint.tasks.map(task => {
          const taskIdStr = task.task_id || task.id;
          const jiraUrl = `${JIRA_BASE_URL}/browse/${taskIdStr}`;

          return (
            <div key={task.id} className="sprint-task-card glass-card">
              <div className="stc-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                  {task.isMultiSprint && (
                    <span className="multi-sprint-pill" title={`تکرارشده در چند اسپرینت (${task.allSprints.join(', ')})`}>
                      <Repeat size={11} />
                      چند اسپرینتی
                    </span>
                  )}
                </div>
                <StatusBadge status={task.status} />
              </div>

              <h4 className="stc-title">
                <a href={jiraUrl} target="_blank" rel="noopener noreferrer" className="task-title-link">
                  {task.title}
                </a>
              </h4>
              
              <div className="stc-footer">
                <div className="stc-assignee">
                  {task.assignee ? (
                    <span className="assignee-tag">{task.assignee}</span>
                  ) : (
                    <span className="unassigned-tag">بدون مسئول</span>
                  )}
                </div>
                {task.status === 'Done' || task.status === 'done' ? (
                  <CheckCircle2 size={18} className="text-accent-green" />
                ) : (
                  <Circle size={18} className="text-text-secondary" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SprintSection;
