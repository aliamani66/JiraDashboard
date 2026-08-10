const express = require('express');
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth');
const mapping = require('../jiraMapping');

const router = express.Router();
router.use(authenticate);

// Helper: extract quarter labels (e.g. 1405Q1, 1404Q3) from a JSON labels string
function extractQuarterLabels(labelsJson) {
  try {
    const arr = JSON.parse(labelsJson || '[]');
    return arr.filter(l => /^\d{4}Q[1-4]$/i.test(l)).map(l => l.toUpperCase());
  } catch {
    return [];
  }
}

// List all projects with summary stats
router.get('/projects', (req, res) => {
  try {
    const db = getDb();
    const projects = db.prepare(`
      SELECT p.*,
        IFNULL((SELECT SUM(estimate_hours) FROM tasks WHERE project_id = p.id), 0) as total_estimate_hours,
        IFNULL((SELECT SUM(spent_hours) FROM tasks WHERE project_id = p.id), 0) as total_spent_hours
      FROM projects p
    `).all();

    for (const p of projects) {
      // Component map
      const compRows = db.prepare(`
        SELECT component, COUNT(*) as count 
        FROM tasks 
        WHERE project_id = ? 
        GROUP BY component
      `).all(p.id);
      
      const compObj = {};
      for (const row of compRows) {
        if (row.component) compObj[row.component] = row.count;
      }
      p.components_map = compObj;

      // Task status breakdown map (done, active, waiting, todo)
      const statusRows = db.prepare(`
        SELECT status, is_waiting, COUNT(*) as count 
        FROM tasks 
        WHERE project_id = ? 
        GROUP BY status, is_waiting
      `).all(p.id);

      const statusMap = { done: 0, active: 0, waiting: 0, todo: 0 };
      for (const row of statusRows) {
        const s = (row.status || '').toLowerCase();
        if (row.is_waiting === 1 || s === 'waiting' || s === 'onholding' || s === 'on hold') {
          statusMap.waiting += row.count;
        } else if (s === 'done' || s === 'completed' || s === 'resolved') {
          statusMap.done += row.count;
        } else if (s === 'in progress' || s === 'in_progress' || s === 'active' || s === 'in review' || s === 'testing') {
          statusMap.active += row.count;
        } else {
          statusMap.todo += row.count;
        }
      }
      p.status_map = statusMap;

      // Quarter labels — collect unique quarters from all tasks of this project
      const labelRows = db.prepare(`SELECT labels FROM tasks WHERE project_id = ?`).all(p.id);
      const quarterSet = new Set();
      for (const row of labelRows) {
        extractQuarterLabels(row.labels).forEach(q => quarterSet.add(q));
      }
      p.quarters = Array.from(quarterSet).sort();
    }

    res.json({
      projects,
      featuredComponents: mapping.featuredComponents || ['learning', 'meeting', 'support']
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// All unique quarter labels across all projects
router.get('/quarters', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`SELECT DISTINCT labels FROM tasks WHERE labels IS NOT NULL AND labels != '[]'`).all();
    const quarterSet = new Set();
    for (const row of rows) {
      extractQuarterLabels(row.labels).forEach(q => quarterSet.add(q));
    }
    const quarters = Array.from(quarterSet).sort();
    res.json({ quarters });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch quarters' });
  }
});

// Overall stats
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const totalProjects = db.prepare("SELECT COUNT(*) as count FROM projects").get().count;
    const activeProjects = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status != 'Done'").get().count;
    const completedProjects = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'Done'").get().count;
    const totalTasks = db.prepare("SELECT SUM(total_tasks) as count FROM projects").get().count || 0;
    const waitingTasks = db.prepare("SELECT SUM(waiting_tasks) as count FROM projects").get().count || 0;
    
    let avgProgressRow = db.prepare("SELECT AVG(progress) as avg FROM projects").get();
    let avgProgress = avgProgressRow && avgProgressRow.avg ? avgProgressRow.avg : 0;

    res.json({
      totalProjects,
      activeProjects,
      completedProjects,
      totalTasks,
      waitingTasks,
      avgProgress: Math.round(avgProgress)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Project detail with tasks
router.get('/projects/:id', (req, res) => {
  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC, id ASC').all(req.params.id);
    project.tasks = tasks;
    project.waitingTasks = tasks.filter(t => t.is_waiting === 1 || t.status === 'OnHolding' || t.status === 'Waiting');
    
    const quarterSet = new Set();
    const statusMap = { done: 0, active: 0, waiting: 0, todo: 0 };

    for (const t of tasks) {
      extractQuarterLabels(t.labels).forEach(q => quarterSet.add(q));

      const s = (t.status || '').toLowerCase();
      if (t.is_waiting === 1 || s === 'waiting' || s === 'onholding' || s === 'on hold') {
        statusMap.waiting++;
      } else if (s === 'done' || s === 'completed' || s === 'resolved') {
        statusMap.done++;
      } else if (s === 'in progress' || s === 'in_progress' || s === 'active' || s === 'in review' || s === 'testing') {
        statusMap.active++;
      } else {
        statusMap.todo++;
      }
    }
    project.quarters = Array.from(quarterSet).sort();
    project.status_map = statusMap;
    
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.get('/projects/:id/gantt', (req, res) => {
  try {
    const db = getDb();
    const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC, id ASC').all(req.params.id);
    
    const formatted = tasks.map(t => {
      const est = t.estimate_hours || 0;
      const spent = t.spent_hours || 0;
      const prog = est > 0 ? Math.min(100, Math.round((spent / est) * 100)) : (t.status === 'Done' ? 100 : 0);
      
      return {
        id: t.id,
        name: t.title,
        title: t.title,
        start: t.start_date || '2026-07-15',
        end: t.due_date || '2026-08-30',
        start_date: t.start_date || '2026-07-15',
        due_date: t.due_date || '2026-08-30',
        progress: prog,
        status: t.status,
        is_waiting: t.is_waiting,
        is_blocked: t.is_waiting,
        estimate_hours: est,
        spent_hours: spent,
        assignee: t.assignee,
        sprint_name: t.sprint_name,
        waiting_for_team: t.waiting_for_team
      };
    });
    
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch gantt data' });
  }
});

// Waiting/Blocked tasks for a specific project
router.get('/projects/:id/blocked', (req, res) => {
  try {
    const db = getDb();
    const tasks = db.prepare("SELECT * FROM tasks WHERE project_id = ? AND (is_waiting = 1 OR status = 'OnHolding' OR status = 'Waiting') ORDER BY sort_order ASC, id ASC").all(req.params.id);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch waiting tasks for project' });
  }
});

// Waiting tasks across all projects (grouped by external team / OPM dependency)
router.get('/waiting-tasks', (req, res) => {
  try {
    const db = getDb();
    const tasks = db.prepare("SELECT t.*, p.title as projectTitle FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.is_waiting = 1 OR t.status = 'OnHolding' OR t.status = 'Waiting' ORDER BY t.project_id ASC").all();
    
    const byTeamMap = new Map();
    let totalWaiting = 0;
    
    for (const t of tasks) {
      totalWaiting++;
      const teamGroupKey = t.waiting_for_team || 'پروژه صنعتی OPM';
      
      if (!byTeamMap.has(teamGroupKey)) {
        byTeamMap.set(teamGroupKey, {
          projectId: 'OPM',
          projectTitle: `وابستگی به ${teamGroupKey}`,
          tasks: []
        });
      }
      
      const taskResponse = { ...t };
      delete taskResponse.projectTitle;
      
      byTeamMap.get(teamGroupKey).tasks.push(taskResponse);
    }
    
    res.json({
      totalWaiting,
      byProject: Array.from(byTeamMap.values())
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch waiting tasks' });
  }
});

module.exports = router;
