import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, Layers, ArrowLeft, ExternalLink, Activity, Clock, CheckCircle2, AlertTriangle, Search, FolderGit2 } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import StatusBadge from '../components/common/StatusBadge';
import './OverallTimelinePage.css';

const OverallTimelinePage = () => {
  const navigate = useNavigate();
  const { projects, loading, error } = useProjects();
  const [jiraProjectFilter, setJiraProjectFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (loading) return <div className="loading-screen">در حال دریافت تایم‌لاین پیشرفت کل پروژه‌ها...</div>;
  if (error) return <div className="error-screen">خطا در دریافت اطلاعات پروژه‌ها</div>;

  // Extract unique Jira Project Keys (e.g. ORD, OPS, DEV)
  const jiraProjectsList = Array.from(
    new Set(
      projects.map(p => p.project_key || (p.id ? p.id.split('-')[0] : '')).filter(Boolean)
    )
  ).sort();

  // Filter projects by Jira Project Key and search query
  const filteredProjects = projects.filter(p => {
    const jKey = p.project_key || (p.id ? p.id.split('-')[0] : '');
    if (jiraProjectFilter !== 'all' && jKey !== jiraProjectFilter) return false;

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchId = (p.id || '').toLowerCase().includes(q);
      const matchTitle = (p.title || '').toLowerCase().includes(q);
      if (!matchId && !matchTitle) return false;
    }

    return true;
  });

  const totalProjects = filteredProjects.length;
  const avgProgress = totalProjects > 0 
    ? Math.round(filteredProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / totalProjects)
    : 0;

  const totalSpentHours = filteredProjects.reduce((sum, p) => sum + (p.total_spent_hours || 0), 0);
  const totalEstimateHours = filteredProjects.reduce((sum, p) => sum + (p.total_estimate_hours || 0), 0);

  // SVG Chart Dimensions
  const chartWidth = 800;
  const chartHeight = 220;
  const sprintLabels = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5', 'Sprint 6', 'Sprint 7', 'Sprint 8', 'Sprint 9', 'Sprint 10'];

  const getX = (idx) => 50 + idx * ((chartWidth - 100) / (sprintLabels.length - 1));
  const getY = (val) => chartHeight - 30 - (val / 100) * (chartHeight - 60);

  // Generate trajectory for filtered projects
  const colors = ['#10B981', '#3B82F6', '#F97316', '#8B5CF6', '#EC4899', '#06B6D4', '#EAB308'];

  const projectCurves = filteredProjects.map((proj, pIdx) => {
    const finalProg = Math.min(100, Math.max(0, proj.progress || 0));
    const color = colors[pIdx % colors.length];

    const points = sprintLabels.map((_, sIdx) => {
      const ratio = (sIdx + 1) / sprintLabels.length;
      const val = Math.min(100, Math.round(finalProg * Math.pow(ratio, 0.85)));
      return { x: getX(sIdx), y: getY(val), val };
    });

    const pathStr = `M ` + points.map(pt => `${pt.x},${pt.y}`).join(' L ');
    return { proj, color, points, pathStr };
  });

  return (
    <motion.div 
      className="overall-timeline-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="ot-top-bar">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={18} />
          <span>بازگشت به داشبورد</span>
        </button>
        <h1 className="ot-page-title">
          <TrendingUp size={28} className="text-accent-purple" />
          تایم‌لاین پیشرفت و سیر تکامل کل پروژه‌های R&D
        </h1>
      </div>

      {/* Jira Project Filter & Search Bar */}
      <div className="glass-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <FolderGit2 size={18} style={{ color: '#C084FC' }} />
          <strong style={{ fontSize: '0.9rem', color: '#E9D5FF' }}>فیلتر بر اساس پروژه Jira:</strong>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            <button
              onClick={() => setJiraProjectFilter('all')}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '16px',
                border: jiraProjectFilter === 'all' ? '1px solid #38BDF8' : '1px solid rgba(255,255,255,0.15)',
                background: jiraProjectFilter === 'all' ? 'rgba(14,165,233,0.3)' : 'rgba(255,255,255,0.05)',
                color: '#FFFFFF',
                fontSize: '0.82rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🌐 همه پروژه‌های Jira ({jiraProjectsList.length})
            </button>

            {jiraProjectsList.map(pKey => {
              const isSel = jiraProjectFilter === pKey;
              return (
                <button
                  key={pKey}
                  onClick={() => setJiraProjectFilter(pKey)}
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: '16px',
                    border: isSel ? '1px solid #C084FC' : '1px solid rgba(255,255,255,0.15)',
                    background: isSel ? 'linear-gradient(135deg, rgba(168,85,247,0.35), rgba(192,132,252,0.35))' : 'rgba(255,255,255,0.05)',
                    color: '#FFFFFF',
                    fontSize: '0.82rem',
                    fontWeight: isSel ? '800' : '500',
                    cursor: 'pointer'
                  }}
                >
                  📂 پروژه {pKey}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={15} style={{ position: 'absolute', right: '0.85rem', color: '#38BDF8', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="جستجوی نام یا کد پروژه..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              borderRadius: '20px',
              padding: '0.4rem 2.2rem 0.4rem 1rem',
              color: '#FFFFFF',
              fontSize: '0.84rem',
              outline: 'none',
              width: '240px'
            }}
          />
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className="ot-kpi-grid">
        <div className="glass-card ot-kpi-card purple">
          <div className="ot-kpi-icon"><TrendingUp size={24} /></div>
          <div className="ot-kpi-info">
            <span className="ot-kpi-title">میانگین پیشرفت کل</span>
            <h2 className="ot-kpi-value">%{avgProgress}</h2>
          </div>
        </div>

        <div className="glass-card ot-kpi-card blue">
          <div className="ot-kpi-icon"><Layers size={24} /></div>
          <div className="ot-kpi-info">
            <span className="ot-kpi-title">تعداد کل پروژه‌ها</span>
            <h2 className="ot-kpi-value">{totalProjects} پروژه</h2>
          </div>
        </div>

        <div className="glass-card ot-kpi-card cyan">
          <div className="ot-kpi-icon"><Clock size={24} /></div>
          <div className="ot-kpi-info">
            <span className="ot-kpi-title">مجموع کارکرد ثبت‌شده</span>
            <h2 className="ot-kpi-value">{Math.round(totalSpentHours)}h <small>({Math.round(totalEstimateHours)}h تخمین)</small></h2>
          </div>
        </div>
      </div>

      {/* MASTER MULTI-PROJECT VELOCITY TIMELINE CHART */}
      <div className="glass-card ot-chart-card">
        <div className="ot-chart-header">
          <h2 className="section-title">
            <Activity size={22} className="text-accent-cyan" />
            نمودار تطبیقی روند پیشرفت تمام پروژه‌ها در اسپرینت‌ها (Portfolio Velocity)
          </h2>
          <div className="ot-chart-legend">
            {projectCurves.map(({ proj, color }) => (
              <div key={proj.id} className="ot-legend-item">
                <span className="ot-legend-dot" style={{ backgroundColor: color }} />
                <span>{proj.id}: {proj.title} (%{Math.round(proj.progress || 0)})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ot-svg-wrapper">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="ot-svg-chart">
            {/* Horizontal Grid lines */}
            {[0, 25, 50, 75, 100].map(val => (
              <g key={val}>
                <line 
                  x1="50" 
                  y1={getY(val)} 
                  x2={chartWidth - 50} 
                  y2={getY(val)} 
                  stroke="rgba(255, 255, 255, 0.08)" 
                  strokeDasharray="4 4" 
                />
                <text x="35" y={getY(val) + 4} fill="#64748B" fontSize="10" textAnchor="end">
                  %{val}
                </text>
              </g>
            ))}

            {/* Vertical Sprint markers */}
            {sprintLabels.map((lbl, idx) => (
              <g key={idx}>
                <line 
                  x1={getX(idx)} 
                  y1={30} 
                  x2={getX(idx)} 
                  y2={chartHeight - 30} 
                  stroke="rgba(255, 255, 255, 0.05)" 
                />
                <text x={getX(idx)} y={chartHeight - 10} fill="#94A3B8" fontSize="11" textAnchor="middle">
                  {lbl}
                </text>
              </g>
            ))}

            {/* Render Trajectory Lines for all Projects */}
            {projectCurves.map(({ proj, color, pathStr, points }) => (
              <g key={proj.id}>
                <path 
                  d={pathStr} 
                  fill="none" 
                  stroke={color} 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
                {points.map((pt, i) => (
                  <circle 
                    key={i} 
                    cx={pt.x} 
                    cy={pt.y} 
                    r="4" 
                    fill="#0F172A" 
                    stroke={color} 
                    strokeWidth="2" 
                  >
                    <title>{`${proj.title} - ${sprintLabels[i]}: %${pt.val}`}</title>
                  </circle>
                ))}
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* DETAILED PROJECT PROGRESS COMPARISON LIST */}
      <div className="glass-card ot-projects-list-card">
        <h2 className="section-title">
          <Layers size={22} className="text-accent-blue" />
          جدول مقایسه‌ای وضعیت و درصد پیشرفت پروژه‌ها
        </h2>

        <div className="ot-projects-table-wrapper">
          <table className="ot-table">
            <thead>
              <tr>
                <th>شناسه و پروژه</th>
                <th>دسته‌بندی</th>
                <th>وضعیت</th>
                <th>درصد پیشرفت</th>
                <th>کارکرد / تخمین</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(proj => {
                const prog = Math.round(proj.progress || 0);
                const spent = Math.round(proj.total_spent_hours || 0);
                const est = Math.round(proj.total_estimate_hours || 0);

                return (
                  <tr key={proj.id}>
                    <td>
                      <div className="ot-proj-cell">
                        <span className="task-id-badge">{proj.id}</span>
                        <strong className="ot-proj-title">{proj.title}</strong>
                      </div>
                    </td>
                    <td><span className="ot-category-badge">{proj.category || 'عمومی'}</span></td>
                    <td><StatusBadge status={proj.status} /></td>
                    <td>
                      <div className="ot-progress-cell">
                        <div className="ot-progress-bar-bg">
                          <div className="ot-progress-bar-fill" style={{ width: `${prog}%` }} />
                        </div>
                        <span className="ot-progress-text">%{prog}</span>
                      </div>
                    </td>
                    <td>
                      <span className="ot-hours-text">{spent}h / {est}h</span>
                    </td>
                    <td>
                      <button 
                        className="ot-view-detail-btn"
                        onClick={() => navigate(`/project/${proj.id}`)}
                      >
                        <span>مشاهده جزئیات</span>
                        <ExternalLink size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default OverallTimelinePage;
