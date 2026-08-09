import React, { useState } from 'react';
import { Target, Calendar, CheckCircle2, Circle, ExternalLink, Filter, Zap, Repeat, Users, Clock, AlertCircle, UserCheck } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import './SprintSection.css';

const JIRA_BASE_URL = 'https://aliamani6.atlassian.net';

const SprintSection = ({ tasks = [] }) => {
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState('all');

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

  // Sprint Statistics
  const activeTasks = activeSprint.tasks;
  const totalTasks = activeTasks.length;
  const completedTasks = activeTasks.filter(t => t.status === 'Done' || t.status === 'done' || t.status === 'Completed').length;
  const remainingTasks = totalTasks - completedTasks;
  const waitingTasks = activeTasks.filter(t => t.is_waiting || t.status === 'Waiting' || t.status === 'OnHolding' || t.status === 'Blocked').length;

  // Assignee Breakdown
  const assigneeStatsMap = {};
  activeTasks.forEach(t => {
    const name = t.assignee ? t.assignee.trim() : 'بدون مسئول';
    if (!assigneeStatsMap[name]) {
      assigneeStatsMap[name] = { name, total: 0, completed: 0, remaining: 0, waiting: 0 };
    }
    assigneeStatsMap[name].total += 1;
    const isDone = t.status === 'Done' || t.status === 'done' || t.status === 'Completed';
    if (isDone) {
      assigneeStatsMap[name].completed += 1;
    } else {
      assigneeStatsMap[name].remaining += 1;
    }
    if (t.is_waiting || t.status === 'Waiting' || t.status === 'OnHolding' || t.status === 'Blocked') {
      assigneeStatsMap[name].waiting += 1;
    }
  });

  const assigneeList = Object.values(assigneeStatsMap).sort((a, b) => b.remaining - a.remaining);

  // Filter tasks displayed in grid by assignee if filter selected
  const displayedTasks = activeTasks.filter(t => {
    if (selectedAssigneeFilter === 'all') return true;
    const name = t.assignee ? t.assignee.trim() : 'بدون مسئول';
    return name === selectedAssigneeFilter;
  });

  // Generate Jira Sprint Search / Board URL
  const projectKey = tasks[0]?.project_id?.split('-')[0] || 'ORD';
  const sprintJiraUrl = `${JIRA_BASE_URL}/issues/?jql=project%20%3D%20${projectKey}%20AND%20sprint%20%3D%20%22${encodeURIComponent(activeSprint.name)}%22`;

  return (
    <div className="sprint-section">
      <div className="sprint-header glass-card">
        <div className="sprint-header-main-row">
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
                  onChange={(e) => {
                    setSelectedSprintName(e.target.value);
                    setSelectedAssigneeFilter('all');
                  }}
                  className="sprint-dropdown"
                >
                  {sprints.map((s, idx) => (
                    <option key={s.name} value={s.name}>
                      {idx === 0 ? `📍 ${s.name} (اسپرینت جاری)` : s.name}
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

        {/* 📊 SPRINT STATS BANNER */}
        <div className="sprint-stats-banner">
          <div className="sstat-item remaining-highlight">
            <Clock size={16} className="sstat-icon icon-orange" />
            <span className="sstat-label">تسک‌های باقی‌مانده و مانده:</span>
            <span className="sstat-value remaining-num">{remainingTasks} تسک</span>
          </div>

          <div className="sstat-item">
            <CheckCircle2 size={16} className="sstat-icon icon-green" />
            <span className="sstat-label">تکمیل‌شده:</span>
            <span className="sstat-value">{completedTasks} از {totalTasks}</span>
          </div>

          {waitingTasks > 0 && (
            <div className="sstat-item waiting-highlight">
              <AlertCircle size={16} className="sstat-icon icon-yellow" />
              <span className="sstat-label">معطل تیم‌های دیگر:</span>
              <span className="sstat-value waiting-num">{waitingTasks} تسک</span>
            </div>
          )}
        </div>

        {/* 👥 ASSIGNEE WORKLOAD BREAKDOWN */}
        <div className="sprint-assignees-breakdown">
          <div className="sab-title">
            <Users size={15} className="text-accent-cyan" />
            <span>تفکیک وضعیت مانده به تفکیک افراد پروژه:</span>
            {selectedAssigneeFilter !== 'all' && (
              <button className="reset-assignee-filter-btn" onClick={() => setSelectedAssigneeFilter('all')}>
                نمایش همه ({activeTasks.length})
              </button>
            )}
          </div>

          <div className="sab-cards-row">
            {assigneeList.map(member => {
              const isSelected = selectedAssigneeFilter === member.name;
              return (
                <button 
                  key={member.name} 
                  className={`assignee-workload-chip ${isSelected ? 'active-filter' : ''} ${member.remaining > 0 ? 'has-remaining' : 'all-done'}`}
                  onClick={() => setSelectedAssigneeFilter(isSelected ? 'all' : member.name)}
                  title={`کلیک کنید برای فیلتر تسک‌های ${member.name}`}
                >
                  <span className="awc-name">{member.name}</span>
                  {member.remaining > 0 ? (
                    <span className="awc-remaining-badge" title={`${member.remaining} تسک انجام‌نشده مانده دارد`}>
                      ⚡ {member.remaining} مانده
                    </span>
                  ) : (
                    <span className="awc-done-badge" title="تمام تسک‌های این شخص انجام شده است!">
                      <UserCheck size={12} /> تکمیله
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task Grid */}
      <div className="sprint-tasks-grid">
        {displayedTasks.map(task => {
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
                {task.status === 'Done' || task.status === 'done' || task.status === 'Completed' ? (
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
