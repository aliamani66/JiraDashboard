import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useProjects, useQuarters } from '../hooks/useProjects';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import StatsCards from '../components/Dashboard/StatsCards';
import ProjectGrid from '../components/Dashboard/ProjectGrid';
import './DashboardPage.css';

const DashboardPage = () => {
  const { projects, stats, loading } = useProjects();
  const { user } = useAuth();
  const quarters = useQuarters();
  const [compFilter, setCompFilter] = useState('all');
  const [statusTab, setStatusTab] = useState('all');
  const [quarterFilter, setQuarterFilter] = useState('all');

  const perms = user?.permissions || [];
  const hasDashboardAccess = user?.role === 'admin' || perms.includes('dashboard');

  if (!loading && !hasDashboardAccess && perms.includes('waiting_tasks')) {
    return <Navigate to="/waiting-tasks" replace />;
  }

  if (loading) {
    return <div className="dashboard-loading">در حال دریافت اطلاعات...</div>;
  }

  const activeProjects = projects.filter(p => p.status !== 'Done');
  const doneProjects = projects.filter(p => p.status === 'Done');

  const displayStats = stats && (stats.totalProjects || stats.total) ? stats : {
    totalProjects: projects.length,
    activeProjects: activeProjects.length,
    completedProjects: doneProjects.length,
    avgProgress: projects.length > 0 ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length) : 0,
    waitingTasks: projects.reduce((s, p) => s + (p.waiting_tasks || 0), 0)
  };

  // Filter projects based on status tab, selected component, and quarter
  const filteredProjects = projects.filter(p => {
    // 1. Status Filter
    if (statusTab === 'active' && p.status === 'Done') return false;
    if (statusTab === 'done' && p.status !== 'Done') return false;

    // 2. Component Filter
    if (compFilter !== 'all') {
      const count = p.components_map ? p.components_map[compFilter] : 0;
      if (count === 0) return false;
    }

    // 3. Quarter Filter
    if (quarterFilter !== 'all') {
      const pQuarters = p.quarters || [];
      if (!pQuarters.includes(quarterFilter)) return false;
    }

    return true;
  });

  return (
    <motion.div 
      className="dashboard-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="dashboard-header">
        <h1>نمای کلی پروژه‌ها</h1>
        <p>وضعیت لحظه‌ای پروژه‌های تیم تحقیق و توسعه عملیات ({projects.length} پروژه)</p>
      </div>

      {/* Interactive Component Summary Panel inside StatsCards */}
      <StatsCards 
        stats={displayStats} 
        projects={projects} 
        activeCompFilter={compFilter}
        onSelectComponent={setCompFilter}
      />
      
      <div className="dashboard-section">
        {/* Status Filter Tabs (All / Active / Done) */}
        <div className="section-header-row">
          <div className="dash-status-tabs">
            <button 
              className={`dash-status-tab ${statusTab === 'all' ? 'active' : ''}`}
              onClick={() => setStatusTab('all')}
            >
              🌐 همه پروژه‌ها ({projects.length})
            </button>

            <button 
              className={`dash-status-tab ${statusTab === 'active' ? 'active' : ''}`}
              onClick={() => setStatusTab('active')}
            >
              ⚡ در حال اجرا ({activeProjects.length})
            </button>

            <button 
              className={`dash-status-tab done-tab ${statusTab === 'done' ? 'active' : ''}`}
              onClick={() => setStatusTab('done')}
            >
              ✅ انجام‌شده / تکمیل‌شده ({doneProjects.length})
            </button>
          </div>

          {compFilter !== 'all' && (
            <span className="active-filter-label">فیلتر کامپوننت: {compFilter}</span>
          )}
        </div>

        {/* Quarter Filter */}
        {quarters.length > 0 && (
          <div className="quarter-filter-bar">
            <span className="quarter-filter-label">📅 فصل:</span>
            <button
              className={`quarter-btn ${quarterFilter === 'all' ? 'active' : ''}`}
              onClick={() => setQuarterFilter('all')}
            >
              همه
            </button>
            {quarters.map(q => (
              <button
                key={q}
                className={`quarter-btn ${quarterFilter === q ? 'active' : ''}`}
                onClick={() => setQuarterFilter(quarterFilter === q ? 'all' : q)}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {filteredProjects.length === 0 ? (
          <div className="no-projects-msg">پروژه‌ای در این دسته با شرایط انتخابی یافت نشد.</div>
        ) : (
          <ProjectGrid projects={filteredProjects} />
        )}
      </div>
    </motion.div>
  );
};

export default DashboardPage;
