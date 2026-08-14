import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useProjectDetail } from '../hooks/useProjects';
import ProjectHeader from '../components/ProjectDetail/ProjectHeader';
import ComponentBreakdown from '../components/ProjectDetail/ComponentBreakdown';
import SprintSection from '../components/ProjectDetail/SprintSection';
import TaskList from '../components/ProjectDetail/TaskList';
import GanttChart from '../components/GanttChart/GanttChart';
import WaitingTasks from '../components/ProjectDetail/WaitingTasks';
import ProjectTimelineChart from '../components/ProjectDetail/ProjectTimelineChart';
import './ProjectPage.css';

const ProjectPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { project, blocked, gantt, loading, error, refetch } = useProjectDetail(id);

  if (loading) return <div className="loading-state">در حال دریافت اطلاعات پروژه...</div>;
  if (error || !project) return <div className="error-state">خطا در دریافت اطلاعات پروژه</div>;

  const capabilities = project.capabilities 
    ? project.capabilities.split('|').filter(c => c.trim()) 
    : [];

  // Get tasks from project detail response
  const tasks = project.tasks || [];

  // Prepare gantt data from all tasks of the project
  const ganttData = tasks.map((t) => ({
    id: t.id,
    name: t.title,
    title: t.title,
    start: t.start_date || '2026-07-15',
    end: t.due_date || '2026-08-30',
    progress: t.estimate_hours > 0 ? Math.min(100, Math.round((t.spent_hours / t.estimate_hours) * 100)) : (t.status === 'Done' ? 100 : 0),
    status: t.status,
    is_blocked: t.is_blocked || t.is_waiting,
    is_waiting: t.is_waiting,
    estimate_hours: t.estimate_hours,
    spent_hours: t.spent_hours,
    assignee: t.assignee,
    sprint_name: t.sprint_name,
    waiting_for_team: t.waiting_for_team
  }));

  // Get waiting tasks
  const waitingTasks = (blocked?.length ? blocked : (project?.waitingTasks?.length ? project.waitingTasks : tasks.filter(t => t.is_waiting === 1 || t.is_blocked === 1 || t.status === 'Waiting' || t.status === 'OnHolding' || t.status === 'waiting' || t.status === 'onholding')));

  return (
    <motion.div 
      className="project-page"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <button className="back-btn" onClick={() => navigate('/')} title="بازگشت به داشبورد">
        <ArrowLeft size={16} />
        <span>داشبورد</span>
      </button>

      {/* 1. Top Tiles Grid: Project Header (Right 2.2fr) & Component Breakdown (Left 1fr - Equal Height!) */}
      <div className="project-top-tiles-grid">
        <ProjectHeader project={project} capabilities={capabilities} onSync={refetch} />
        <ComponentBreakdown tasks={tasks} />
      </div>

      {/* 2. Middle Grid: Timeline Chart (Right 2fr) & Waiting Tasks (Left 1fr) */}
      <div className="project-grid-layout">
        <div className="project-main-col">
          <ProjectTimelineChart tasks={tasks} project={project} />
        </div>
        
        <div className="project-side-col">
          {waitingTasks.length > 0 && <WaitingTasks tasks={waitingTasks} />}
        </div>
      </div>

      {/* 3. SPRINT SECTION - 100% FULL WIDTH TILE */}
      <SprintSection tasks={tasks} />

      {/* 4. GANTT CHART - 100% FULL-WIDTH TILE */}
      <div className="gantt-fullwidth-wrapper">
        <GanttChart tasks={ganttData} />
      </div>

      {/* 5. TASK LIST TABLE - 100% FULL-WIDTH TILE BELOW GANTT CHART */}
      <TaskList tasks={tasks} />
    </motion.div>
  );
};

export default ProjectPage;
