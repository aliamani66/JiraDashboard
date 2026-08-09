import React, { useState, useMemo } from 'react';
import { GanttChartSquare, Clock, Calendar, CheckCircle2, AlertTriangle, PlayCircle, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import './GanttChart.css';

const GanttChart = ({ tasks }) => {
  const [hoveredTask, setHoveredTask] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { minDate, maxDate, totalDays, monthLabels } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      const now = new Date();
      return {
        minDate: now,
        maxDate: new Date(now.getTime() + 90 * 24*60*60*1000),
        totalDays: 90,
        monthLabels: []
      };
    }

    const dates = tasks.flatMap(t => {
      const s = t.start ? new Date(t.start) : (t.start_date ? new Date(t.start_date) : null);
      const e = t.end ? new Date(t.end) : (t.due_date ? new Date(t.due_date) : null);
      return [s, e].filter(Boolean);
    });

    if (dates.length === 0) {
      const now = new Date();
      return {
        minDate: now,
        maxDate: new Date(now.getTime() + 90 * 24*60*60*1000),
        totalDays: 90,
        monthLabels: []
      };
    }

    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    
    min.setDate(min.getDate() - 3);
    max.setDate(max.getDate() + 7);
    
    const total = Math.ceil((max - min) / (24*60*60*1000));

    const labels = [];
    const current = new Date(min);
    current.setDate(1);
    while (current <= max) {
      const dayOffset = Math.ceil((current - min) / (24*60*60*1000));
      const pct = (dayOffset / total) * 100;
      labels.push({
        label: current.toLocaleDateString('fa-IR', { month: 'long', year: 'numeric' }),
        position: Math.max(0, Math.min(100, pct))
      });
      current.setMonth(current.getMonth() + 1);
    }

    return { minDate: min, maxDate: max, totalDays: total, monthLabels: labels };
  }, [tasks]);

  const getStatusTheme = (task) => {
    const status = (task.status || '').toLowerCase();
    if (task.is_waiting || task.is_blocked || status.includes('wait') || status.includes('hold') || status.includes('block')) {
      return {
        gradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
        shadow: '0 4px 15px rgba(249, 115, 22, 0.4)',
        className: 'bar-waiting',
        text: 'در انتظار / آن‌هولد',
        icon: AlertTriangle,
        badgeBg: 'rgba(249, 115, 22, 0.2)',
        color: '#F97316'
      };
    }
    if (status.includes('done') || status.includes('complete') || status.includes('resolve')) {
      return {
        gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        shadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
        className: 'bar-done',
        text: 'انجام شده',
        icon: CheckCircle2,
        badgeBg: 'rgba(16, 185, 129, 0.2)',
        color: '#10B981'
      };
    }
    if (status.includes('progress') || status.includes('dev') || status.includes('active')) {
      return {
        gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
        shadow: '0 4px 15px rgba(59, 130, 246, 0.4)',
        className: 'bar-progress',
        text: 'در حال انجام',
        icon: PlayCircle,
        badgeBg: 'rgba(59, 130, 246, 0.2)',
        color: '#3B82F6'
      };
    }
    return {
      gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
      shadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
      className: 'bar-todo',
      text: 'برای انجام',
      icon: Clock,
      badgeBg: 'rgba(139, 92, 246, 0.2)',
      color: '#8B5CF6'
    };
  };

  const getBarPosition = (task) => {
    const start = task.start ? new Date(task.start) : (task.start_date ? new Date(task.start_date) : minDate);
    const end = task.end ? new Date(task.end) : (task.due_date ? new Date(task.due_date) : maxDate);
    
    const startOffset = Math.max(0, (start - minDate) / (24*60*60*1000));
    const duration = Math.max(1, (end - start) / (24*60*60*1000));
    
    const leftPct = (startOffset / totalDays) * 100;
    const widthPct = (duration / totalDays) * 100;
    
    return { left: leftPct, width: Math.max(3, widthPct) };
  };

  const todayOffset = ((new Date() - minDate) / (24*60*60*1000) / totalDays) * 100;

  if (!tasks || tasks.length === 0) {
    return (
      <div className="glass-card gantt-card">
        <h3 className="section-title">
          <GanttChartSquare size={20} className="text-accent-purple" />
          نمودار گانت زمان‌بندی کل پروژه
        </h3>
        <div className="no-tasks">تسکی برای نمایش وجود ندارد</div>
      </div>
    );
  }

  return (
    <div className={`glass-card gantt-card ${isFullscreen ? 'is-fullscreen-mode' : ''}`}>
      <div className="gantt-top-bar">
        <div className="gantt-title-group">
          <h3 className="section-title">
            <GanttChartSquare size={22} className="text-accent-purple" />
            نمودار گانت زمان‌بندی کل پروژه ({tasks.length} تسک در تمام اسپرینت‌ها)
          </h3>
        </div>

        <div className="gantt-top-actions">
          {/* Legend */}
          <div className="gantt-legend">
            <div className="legend-item"><span className="legend-dot green"></span>انجام شده</div>
            <div className="legend-item"><span className="legend-dot blue"></span>در حال انجام</div>
            <div className="legend-item"><span className="legend-dot orange"></span>در انتظار / آن‌هولد</div>
            <div className="legend-item"><span className="legend-dot purple"></span>برای انجام</div>
          </div>

          {/* Full Screen Toggle Button */}
          <button 
            className={`gantt-fullscreen-btn ${isFullscreen ? 'active' : ''}`}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'خروج از حالت تمام‌صفحه' : 'نمایش تایل گانت در حالت ۱۰۰٪ تمام‌صفحه مانیتور'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={16} />
                <span>خروج از تمام‌صفحه</span>
              </>
            ) : (
              <>
                <Maximize2 size={16} />
                <span>تمام‌صفحه (Full Screen)</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="gantt-container">
        <div className="gantt-header">
          <div className="gantt-task-col">شناسه، اسپرینت و عنوان تسک</div>
          <div className="gantt-timeline-col">
            {monthLabels.map((m, idx) => (
              <div key={idx} className="gantt-month-marker" style={{ left: `${m.position}%` }}>
                <span>{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="gantt-body">
          {/* Today marker */}
          {todayOffset > 0 && todayOffset < 100 && (
            <div className="gantt-today-line" style={{ left: `${todayOffset}%` }}>
              <span className="today-label">📍 امروز</span>
            </div>
          )}

          {tasks.map(task => {
            const pos = getBarPosition(task);
            const taskName = task.name || task.title;
            const theme = getStatusTheme(task);
            const est = task.estimate_hours || 0;
            const spent = task.spent_hours || 0;
            const progress = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : (theme.text === 'انجام شده' ? 100 : 0);

            const startDateStr = task.start_date || task.start ? new Date(task.start_date || task.start).toLocaleDateString('fa-IR') : '---';
            const dueDateStr = task.due_date || task.end ? new Date(task.due_date || task.end).toLocaleDateString('fa-IR') : '---';
            const sprintBadge = task.sprint_name ? task.sprint_name.split(' - ')[0] : null;

            return (
              <div 
                key={task.id} 
                className="gantt-row"
                onMouseEnter={() => setHoveredTask(task.id)}
                onMouseLeave={() => setHoveredTask(null)}
              >
                <div className="gantt-task-name" title={`${task.id} - ${sprintBadge || ''} - ${taskName}`}>
                  <a 
                    href={`https://aliamani6.atlassian.net/browse/${task.id}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="task-jira-link"
                    title={`مشاهده تسک ${task.id} در سیستم جیرا`}
                  >
                    <span className="task-id-badge">
                      {task.id}
                      <ExternalLink size={11} className="jira-link-icon" />
                    </span>
                  </a>
                  {sprintBadge && <span className="gantt-sprint-badge">{sprintBadge}</span>}
                  <span className="task-name-text">{taskName}</span>
                </div>
                
                <div className="gantt-timeline-track">
                  {/* Grid background markers */}
                  {monthLabels.map((m, idx) => (
                    <div key={idx} className="gantt-grid-line" style={{ left: `${m.position}%` }} />
                  ))}

                  <div 
                    className={`gantt-bar ${theme.className}`}
                    style={{
                      left: `${pos.left}%`,
                      width: `${pos.width}%`,
                      background: theme.gradient,
                      boxShadow: theme.shadow
                    }}
                  >
                    <div className="gantt-bar-gloss" />
                    {progress > 0 && (
                      <div 
                        className="gantt-bar-progress"
                        style={{ width: `${progress}%` }}
                      />
                    )}
                    <span className="gantt-bar-text">{progress}%</span>

                    {hoveredTask === task.id && (
                      <div className="gantt-tooltip">
                        <div className="tooltip-header">
                          <a 
                            href={`https://aliamani6.atlassian.net/browse/${task.id}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="task-jira-link"
                            title={`مشاهده تسک ${task.id} در سیستم جیرا`}
                          >
                            <span className="tooltip-id">{task.id} 🔗</span>
                          </a>
                          <span className="tooltip-badge" style={{ backgroundColor: theme.badgeBg, color: theme.color }}>
                            {theme.text}
                          </span>
                        </div>
                        <div className="tooltip-title">{taskName}</div>
                        <div className="tooltip-details">
                          {task.sprint_name && (
                            <div className="tooltip-row">
                              <span>🚩 اسپرینت:</span>
                              <strong>{task.sprint_name}</strong>
                            </div>
                          )}
                          {task.assignee && (
                            <div className="tooltip-row">
                              <span>👤 مسئول:</span>
                              <strong>{task.assignee}</strong>
                            </div>
                          )}
                          <div className="tooltip-row">
                            <span><Clock size={12} /> زمان:</span>
                            <strong>{spent}h / {est}h ({progress}%)</strong>
                          </div>
                          <div className="tooltip-row">
                            <span><Calendar size={12} /> بازه:</span>
                            <strong>{startDateStr} تا {dueDateStr}</strong>
                          </div>
                          {task.waiting_for_team && (
                            <div className="tooltip-row text-orange">
                              <span>⏳ منتظر:</span>
                              <strong>{task.waiting_for_team}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GanttChart;
