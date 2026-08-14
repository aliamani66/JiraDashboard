import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
  const [projectFilters, setProjectFilters] = useState([]);
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
  const stoppedProjects = projects.filter(p => {
    const total = p.total_tasks || 0;
    const comp = p.completed_tasks || 0;
    const waiting = p.waiting_tasks || 0;
    const active = total - comp;
    return (total > 0 && active > 0 && waiting >= active) || p.status === 'OnHolding' || p.status === 'Waiting' || p.status === 'Blocked';
  });

  const displayStats = {
    totalProjects: projects.length,
    activeProjects: activeProjects.length,
    stoppedProjects: stoppedProjects.length,
    completedProjects: doneProjects.length,
    waitingTasks: projects.reduce((s, p) => s + (p.waiting_tasks || 0), 0)
  };

  // Collect all unique component keys dynamically across projects
  const availableComponents = Array.from(
    new Set(projects.flatMap(p => Object.keys(p.components_map || {})))
  );

  // Collect all unique Jira Projects (e.g. ORD, OPS, DEV) with epic count
  const jiraProjectMap = new Map();
  projects.forEach(p => {
    const jKey = p.project_key || (p.id ? p.id.split('-')[0] : 'اصلی');
    if (!jiraProjectMap.has(jKey)) {
      jiraProjectMap.set(jKey, { key: jKey, title: `پروژه ${jKey}`, count: 1 });
    } else {
      jiraProjectMap.get(jKey).count += 1;
    }
  });
  const availableProjects = Array.from(jiraProjectMap.values());

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
      const isDone = p.status === 'Done' || p.status === 'done';
      const isTodo = p.status === 'To Do' || p.status === 'to_do' || p.status === 'ToDo' || p.status === 'برای انجام';

      const matchStatus = statusFilters.some(st => {
        if (st === 'todo') return isTodo;
        if (st === 'active') return !isDone && !isCritical && !isTodo;
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

    // 4. Jira Project Key Filter (Multi-select)
    if (projectFilters.length > 0) {
      const jKey = p.project_key || (p.id ? p.id.split('-')[0] : '');
      if (!projectFilters.includes(jKey)) return false;
    }

    return true;
  });

  const handleResetAll = () => {
    setStatusFilters([]);
    setQuarterFilters([]);
    setComponentFilters([]);
    setProjectFilters([]);
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
      {/* Top 4 KPI Summary Stat Cards with Inline Print Button */}
      <StatsCards 
        stats={displayStats} 
        projects={projects} 
        onExport={handleExportOverallReport}
      />

      {/* Unified Full-Width Glass Filter Tile */}
      <DashboardFilterPanel 
        statusFilters={statusFilters}
        setStatusFilters={setStatusFilters}
        quarterFilters={quarterFilters}
        setQuarterFilters={setQuarterFilters}
        componentFilters={componentFilters}
        setComponentFilters={setComponentFilters}
        projectFilters={projectFilters}
        setProjectFilters={setProjectFilters}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        quarters={quarters}
        availableComponents={availableComponents}
        availableProjects={availableProjects}
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
