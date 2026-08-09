import React, { useState } from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight, AlertTriangle, ShieldAlert, Zap, Calendar, Flag } from 'lucide-react';
import './ProjectTimelineChart.css';

const extractDynamicSprints = (tasks = [], currentProjectProgress = 0) => {
  if (!tasks || tasks.length === 0) return [];

  const sprintMap = {};

  tasks.forEach(t => {
    let sprintName = t.sprint_name;
    
    let labelsArr = [];
    if (Array.isArray(t.labels)) {
      labelsArr = t.labels;
    } else if (typeof t.labels === 'string') {
      try { labelsArr = JSON.parse(t.labels); } catch (e) { labelsArr = []; }
    }

    if (!sprintName || sprintName.includes('اسپرینت دو هفته‌ای')) {
      const sprintLabel = labelsArr.find(l => typeof l === 'string' && l.startsWith('sprint:'));
      if (sprintLabel) {
        const num = sprintLabel.replace('sprint:', '').trim();
        sprintName = `Sprint ${num}`;
      }
    }
    if (!sprintName) sprintName = 'Sprint عمومی';

    if (!sprintMap[sprintName]) {
      sprintMap[sprintName] = {
        sprintName: sprintName,
        tasks: [],
        doneCount: 0,
        waitingCount: 0,
        totalCount: 0
      };
    }

    sprintMap[sprintName].tasks.push(t);
    sprintMap[sprintName].totalCount++;
    const s = (t.status || '').toLowerCase();
    if (s === 'done' || s === 'completed') {
      sprintMap[sprintName].doneCount++;
    }
    if (t.is_waiting === 1 || s === 'waiting' || s === 'onholding' || t.is_blocked) {
      sprintMap[sprintName].waitingCount++;
    }
  });

  const sortedSprintKeys = Object.keys(sprintMap).sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || 0);
    const numB = parseInt(b.match(/\d+/)?.[0] || 0);
    return numA - numB;
  });

  let cumulativeProg = 0;
  const totalProjectTasks = tasks.length || 1;

  return sortedSprintKeys.map((sKey, idx) => {
    const sObj = sprintMap[sKey];
    const incPct = Math.round((sObj.doneCount / totalProjectTasks) * 100);
    
    cumulativeProg = Math.min(100, cumulativeProg + incPct);
    
    if (idx === sortedSprintKeys.length - 1) {
      cumulativeProg = Math.max(cumulativeProg, currentProjectProgress);
    }

    const isDip = sObj.waitingCount > 0;
    const isPeak = sObj.doneCount > 0 && !isDip;
    const blockerTask = sObj.tasks.find(t => t.blocked_by_team || t.is_waiting || t.is_blocked);

    return {
      sprintNum: idx + 1,
      sprintName: sObj.sprintName,
      progress: cumulativeProg,
      increment: isDip ? '0%' : `+${incPct}%`,
      type: isDip ? 'dip' : (isPeak ? 'peak' : 'normal'),
      note: isDip 
        ? `🛑 توقف پیشرفت در %${cumulativeProg} (${sObj.waitingCount} تسک منتظر)` 
        : (isPeak ? `🚀 فراز: تکمیل ${sObj.doneCount} تسک اسپرینت` : 'روند اجرایی اسپرینت'),
      blockedBy: blockerTask ? (blockerTask.blocked_by_team || 'تیم وابستگی بیرونی') : null
    };
  });
};

const ProjectTimelineChart = ({ tasks = [], project = {} }) => {
  const [showAllSprints, setShowAllSprints] = useState(false);
  const currentProgress = Math.min(100, Math.max(0, Math.round(project.progress || 0)));

  // Extract ALL sprints dynamically from real Jira tasks
  const fullSprintHistory = extractDynamicSprints(tasks, currentProgress);

  if (fullSprintHistory.length === 0) return null;

  // Render 4 recent Sprints by default, or ALL Sprints if toggled
  const visibleSprints = showAllSprints ? fullSprintHistory : fullSprintHistory.slice(-4);
  const peakCount = fullSprintHistory.filter(s => s.type === 'peak').length;
  const dipCount = fullSprintHistory.filter(s => s.type === 'dip').length;

  const chartWidth = 700;
  const chartHeight = 150;

  const getX = (idx) => 40 + idx * ((chartWidth - 80) / Math.max(1, visibleSprints.length - 1));
  const getY = (val) => chartHeight - 25 - (val / 100) * (chartHeight - 50);

  const pointsString = visibleSprints.map((pt, i) => `${getX(i)},${getY(pt.progress)}`).join(' ');
  const areaPath = `M ${getX(0)},${chartHeight - 10} L ` + visibleSprints.map((pt, i) => `${getX(i)},${getY(pt.progress)}`).join(' L ') + ` L ${getX(visibleSprints.length - 1)},${chartHeight - 10} Z`;

  return (
    <div className="glass-card project-timeline-chart-card">
      <div className="ptc-header">
        <div className="ptc-header-title">
          <TrendingUp size={20} className="text-accent-cyan" />
          <div>
            <h3>تایم‌لاین پیشرفت اسپرینت‌های جیرا (Sprint Velocity Timeline)</h3>
            <p className="ptc-subtitle">استخراج پویا از جیرا: {fullSprintHistory.length} اسپرینت فعال در پروژه ({project.title || ''})</p>
          </div>
        </div>

        <div className="ptc-controls">
          <div className="ptc-summary-badges">
            <span className="ptc-badge peak"><ArrowUpRight size={13} /> {peakCount} فراز</span>
            <span className="ptc-badge dip"><ArrowDownRight size={13} /> {dipCount} توقف</span>
          </div>

          <button 
            className={`ptc-toggle-btn ${!showAllSprints ? 'active' : ''}`}
            onClick={() => setShowAllSprints(false)}
          >
            ۴ اسپرینت اخیر
          </button>
          <button 
            className={`ptc-toggle-btn ${showAllSprints ? 'active' : ''}`}
            onClick={() => setShowAllSprints(true)}
          >
            همه ({fullSprintHistory.length} اسپرینت)
          </button>
        </div>
      </div>

      {/* SVG Smooth Curve Area Chart - Fixed 100% responsive width container */}
      <div className="ptc-chart-container">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="ptc-svg-chart" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#3B82F6" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="33%" stopColor="#06B6D4" />
              <stop offset="66%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#38BDF8" />
            </linearGradient>
          </defs>

          {/* Grid Horizontal Lines */}
          <line x1="20" y1={getY(100)} x2={chartWidth - 20} y2={getY(100)} stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />
          <line x1="20" y1={getY(50)} x2={chartWidth - 20} y2={getY(50)} stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />
          <line x1="20" y1={getY(0)} x2={chartWidth - 20} y2={getY(0)} stroke="rgba(255,255,255,0.06)" />

          {/* Area Fill */}
          <path d={areaPath} fill="url(#areaGradient)" />

          {/* Trend Polyline */}
          <polyline
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsString}
          />

          {/* Sprint Nodes */}
          {visibleSprints.map((pt, idx) => {
            const cx = getX(idx);
            const cy = getY(pt.progress);
            const isPeak = pt.type === 'peak';
            const isDip = pt.type === 'dip';

            return (
              <g key={idx} className="ptc-node-group">
                <circle 
                  cx={cx} cy={cy} r={isDip ? "8" : isPeak ? "7" : "5"} 
                  className={`ptc-node-bg ${isDip ? 'dip-bg' : isPeak ? 'peak-bg' : ''}`}
                />
                <circle 
                  cx={cx} cy={cy} r="3.5" 
                  className={`ptc-node-dot ${isDip ? 'dip-dot' : isPeak ? 'peak-dot' : ''}`}
                />
                <text x={cx} y={cy - 10} textAnchor="middle" className="ptc-node-pct">
                  %{pt.progress}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Horizontal Scrollable Sprint Carousel (Constrained layout, zero screen overflow) */}
      <div className="ptc-sprint-carousel">
        {visibleSprints.map((pt, idx) => {
          const isPeak = pt.type === 'peak';
          const isDip = pt.type === 'dip';

          return (
            <div 
              key={idx} 
              className={`ptc-event-card ${isPeak ? 'event-peak' : isDip ? 'event-dip' : ''}`}
            >
              <div className="ptc-event-header">
                <span className="ptc-event-date">
                  <Flag size={13} className="text-accent-cyan" />
                  <strong>{pt.sprintName}</strong>
                </span>
                {isPeak && <span className="ptc-event-tag peak"><Zap size={11} /> فراز</span>}
                {isDip && <span className="ptc-event-tag dip"><ShieldAlert size={11} /> توقف</span>}
              </div>

              <div className="ptc-sprint-metrics">
                <span>پیشرفت تجمعی: <strong>%{pt.progress}</strong></span>
                <span className={`ptc-inc-badge ${isDip ? 'zero' : 'pos'}`}>{pt.increment}</span>
              </div>

              <div className="ptc-event-note">{pt.note}</div>
              
              {isDip && pt.blockedBy && (
                <div className="ptc-event-blocked-by">
                  <AlertTriangle size={12} />
                  <span>دلیل توقف: {pt.blockedBy}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectTimelineChart;
