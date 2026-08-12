import React from 'react';
import { PieChart, CheckCircle2, PlayCircle, Clock, CircleDashed, Flame } from 'lucide-react';
import './ProjectProgressChart.css';

const ProjectProgressChart = ({ tasks = [], project = {} }) => {
  const totalTasks = tasks.length;
  if (totalTasks === 0) return null;

  // Calculate status counts
  let doneCount = 0;
  let inProgressCount = 0;
  let waitingCount = 0;
  let toDoCount = 0;

  let totalSpent = 0;
  let totalEst = 0;

  for (const t of tasks) {
    const s = (t.status || '').toLowerCase();
    const isWait = t.is_waiting === 1 || s === 'waiting' || s === 'onholding' || t.is_blocked;

    totalSpent += (t.spent_hours || 0);
    totalEst += (t.estimate_hours || 0);

    if (s === 'done' || s === 'completed') {
      doneCount++;
    } else if (isWait) {
      waitingCount++;
    } else if (s === 'in progress' || s === 'in_progress') {
      inProgressCount++;
    } else {
      toDoCount++;
    }
  }

  const donePct = Math.round((doneCount / totalTasks) * 100);
  const inProgressPct = Math.round((inProgressCount / totalTasks) * 100);
  const waitingPct = Math.round((waitingCount / totalTasks) * 100);
  const toDoPct = Math.round((toDoCount / totalTasks) * 100);

  const overallProgress = Math.round(project.progress || (totalEst > 0 ? (totalSpent / totalEst) * 100 : donePct));
  const hoursProgress = totalEst > 0 ? Math.min(100, Math.round((totalSpent / totalEst) * 100)) : 0;

  // SVG Donut calculation
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="glass-card project-progress-chart-card">
      <div className="ppc-header">
        <h3 className="section-title">
          <PieChart size={20} className="text-accent-blue" />
          تحلیل و وضعیت پیشرفت پروژه
        </h3>
        <div className="ppc-badge-overall">
          <Flame size={15} className="text-accent-yellow" />
          <span>پیشرفت کل: <strong>%{overallProgress}</strong></span>
        </div>
      </div>

      <div className="ppc-body-grid">
        {/* Left Side: Donut Progress Chart with Animated SVG Rings */}
        <div className="ppc-donut-wrapper">
          <svg width="130" height="130" viewBox="0 0 130 130" className="ppc-donut-svg">
            <circle cx="65" cy="65" r={radius} className="ppc-ring-bg" strokeWidth="10" />
            
            {/* Done Segment */}
            <circle 
              cx="65" cy="65" r={radius} 
              className="ppc-ring-done" 
              strokeWidth="10"
              strokeDasharray={`${(donePct / 100) * circumference} ${circumference}`}
              strokeDashoffset="0"
              transform="rotate(-90 65 65)"
            />
            {/* In Progress Segment */}
            <circle 
              cx="65" cy="65" r={radius} 
              className="ppc-ring-progress" 
              strokeWidth="10"
              strokeDasharray={`${(inProgressPct / 100) * circumference} ${circumference}`}
              strokeDashoffset={`-${(donePct / 100) * circumference}`}
              transform="rotate(-90 65 65)"
            />
            {/* Waiting Segment */}
            <circle 
              cx="65" cy="65" r={radius} 
              className="ppc-ring-waiting" 
              strokeWidth="10"
              strokeDasharray={`${(waitingPct / 100) * circumference} ${circumference}`}
              strokeDashoffset={`-${((donePct + inProgressPct) / 100) * circumference}`}
              transform="rotate(-90 65 65)"
            />
          </svg>

          <div className="ppc-donut-center">
            <span className="ppc-donut-pct">%{overallProgress}</span>
            <span className="ppc-donut-sub">{doneCount}/{totalTasks} تسک</span>
          </div>
        </div>

        {/* Right Side: Status Distribution Details & Worklog Hours Bar */}
        <div className="ppc-details-col">
          {/* Status Breakdown Legend Grid */}
          <div className="ppc-status-grid">
            <div className="ppc-status-item done">
              <div className="ppc-status-top">
                <CheckCircle2 size={15} className="text-emerald" />
                <span>انجام شده</span>
              </div>
              <div className="ppc-status-val">
                <strong>{doneCount}</strong> تسک <small>({donePct}%)</small>
              </div>
            </div>

            <div className="ppc-status-item progress">
              <div className="ppc-status-top">
                <PlayCircle size={15} className="text-blue" />
                <span>در حال انجام</span>
              </div>
              <div className="ppc-status-val">
                <strong>{inProgressCount}</strong> تسک <small>({inProgressPct}%)</small>
              </div>
            </div>

            <div className="ppc-status-item waiting">
              <div className="ppc-status-top">
                <Clock size={15} className="text-orange" />
                <span>در انتظار / آن‌هولد</span>
              </div>
              <div className="ppc-status-val">
                <strong>{waitingCount}</strong> تسک <small>({waitingPct}%)</small>
              </div>
            </div>

            <div className="ppc-status-item todo">
              <div className="ppc-status-top">
                <CircleDashed size={15} className="text-purple" />
                <span>برای انجام</span>
              </div>
              <div className="ppc-status-val">
                <strong>{toDoCount}</strong> تسک <small>({toDoPct}%)</small>
              </div>
            </div>
          </div>

          {/* Time Worklog Progress Bar */}
          <div className="ppc-worklog-box">
            <div className="ppc-worklog-info">
              <span>⏱️ پیشرفت کارکرد تیمی (Worklog):</span>
              <span><strong>{Math.round(totalSpent * 100) / 100}h</strong> / {Math.round(totalEst * 100) / 100}h</span>
            </div>
            <div className="ppc-worklog-bar">
              <div className="ppc-worklog-fill" style={{ width: `${hoursProgress}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectProgressChart;
