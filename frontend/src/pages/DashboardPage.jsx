import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Printer } from 'lucide-react';
import { useProjects, useQuarters } from '../hooks/useProjects';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import StatsCards from '../components/Dashboard/StatsCards';
import DashboardFilterPanel from '../components/Dashboard/DashboardFilterPanel';
import ProjectGrid from '../components/Dashboard/ProjectGrid';
import './DashboardPage.css';

const DashboardPage = () => {
  const { projects, stats, loading } = useProjects();
  const { user } = useAuth();
  const quarters = useQuarters();

  // Multi-select Filter States
  const [statusFilters, setStatusFilters] = useState([]);
  const [quarterFilters, setQuarterFilters] = useState([]);
  const [componentFilters, setComponentFilters] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Collect all unique component keys dynamically across projects
  const availableComponents = Array.from(
    new Set(projects.flatMap(p => Object.keys(p.components_map || {})))
  );

  // Filter projects with multi-select logic
  const filteredProjects = projects.filter(p => {
    // 0. Search Query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchId = (p.id || '').toLowerCase().includes(q);
      const matchTitle = (p.title || '').toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      if (!matchId && !matchTitle && !matchDesc) return false;
    }

    // 1. Status Filter (Multi-select)
    if (statusFilters.length > 0) {
      const totalTasks = p.total_tasks || 0;
      const completedTasks = p.completed_tasks || 0;
      const waitingTasks = p.waiting_tasks || 0;
      const activeTasks = totalTasks - completedTasks;
      const isCritical = totalTasks > 0 && activeTasks > 0 && waitingTasks >= activeTasks;
      const isDone = p.status === 'Done';

      const matchStatus = statusFilters.some(st => {
        if (st === 'active') return !isDone && !isCritical;
        if (st === 'done') return isDone;
        if (st === 'critical') return isCritical;
        return true;
      });
      if (!matchStatus) return false;
    }

    // 2. Quarter Filter (Multi-select)
    if (quarterFilters.length > 0) {
      const pQuarters = p.quarters || [];
      const hasQuarter = quarterFilters.some(q => pQuarters.includes(q));
      if (!hasQuarter) return false;
    }

    // 3. Component Filter (Multi-select)
    if (componentFilters.length > 0) {
      const compMap = p.components_map || {};
      const hasComp = componentFilters.some(c => (compMap[c] || 0) > 0);
      if (!hasComp) return false;
    }

    return true;
  });

  const handleResetAll = () => {
    setStatusFilters([]);
    setQuarterFilters([]);
    setComponentFilters([]);
    setSearchQuery('');
  };

  const handleExportOverallReport = () => {
    const projectIds = filteredProjects.map(p => p.id).join(',');
    const token = localStorage.getItem('token') || '';
    const url = `/api/reports/overall-html?project_ids=${encodeURIComponent(projectIds)}&token=${token}`;
    window.open(url, '_blank');
  };

  return (
    <motion.div 
      className="dashboard-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="dashboard-header">
        <div>
          <h1>نمای کلی پروژه‌ها</h1>
          <p>وضعیت لحظه‌ای پروژه‌های تیم تحقیق و توسعه عملیات ({projects.length} پروژه)</p>
        </div>

        <button 
          className="db-export-btn"
          onClick={handleExportOverallReport}
          title="دانلود و چاپ گزارش جامع پروژه‌های انتخابی به همراه تایم‌لاین و گانت چارت"
        >
          <Printer size={16} />
          <span>چاپ / خروجی PDF پروژه‌ها ({filteredProjects.length} پروژه)</span>
        </button>
      </div>

      {/* Top 4 KPI Summary Stat Cards */}
      <StatsCards 
        stats={displayStats} 
        projects={projects} 
      />

      {/* Unified Full-Width Glass Filter Tile with 3 Sub-Cards */}
      <DashboardFilterPanel 
        statusFilters={statusFilters}
        setStatusFilters={setStatusFilters}
        quarterFilters={quarterFilters}
        setQuarterFilters={setQuarterFilters}
        componentFilters={componentFilters}
        setComponentFilters={setComponentFilters}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        quarters={quarters}
        availableComponents={availableComponents}
        totalProjectsCount={projects.length}
        filteredCount={filteredProjects.length}
        onResetAll={handleResetAll}
      />
      
      <div className="dashboard-section">
        {filteredProjects.length === 0 ? (
          <div className="no-projects-msg">
            پروژه‌ای با ترکیب فیلترهای انتخابی یافت نشد. برای مشاهده همه پروژه‌ها، فیلترها را پاک کنید.
          </div>
        ) : (
          <ProjectGrid projects={filteredProjects} />
        )}
      </div>
    </motion.div>
  );
};

export default DashboardPage;
