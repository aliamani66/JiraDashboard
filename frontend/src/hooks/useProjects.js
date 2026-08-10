import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export const useProjects = () => {
  const [projects, setProjects] = useState([]);
  const [featuredComponents, setFeaturedComponents] = useState(['learning', 'meeting', 'support']);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, statsData] = await Promise.all([
        api.getProjects().catch(() => ([])),
        api.getStats().catch(() => ({ total: 0, active: 0, avgProgress: 0, blockedTasks: 0 }))
      ]);

      const projData = Array.isArray(projRes) ? projRes : (projRes?.projects || []);
      const featured = Array.isArray(projRes) ? ['learning', 'meeting', 'support'] : (projRes?.featuredComponents || ['learning', 'meeting', 'support']);

      setProjects(projData);
      setFeaturedComponents(featured);
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return { projects, featuredComponents, stats, loading, error, refetch: fetchDashboardData };
};

export const useProjectDetail = (id) => {
  const [project, setProject] = useState(null);
  const [gantt, setGantt] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjectData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [projData, ganttData, blockedData] = await Promise.all([
        api.getProject(id).catch(() => null),
        api.getProjectGantt(id).catch(() => []),
        api.getProjectBlocked(id).catch(() => [])
      ]);
      setProject(projData);
      setGantt(ganttData);
      setBlocked(blockedData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  return { project, gantt, blocked, loading, error, refetch: fetchProjectData };
};

export const useWaitingTasks = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.getWaitingTasks()
      .then(setData)
      .catch(() => setData({ totalWaiting: 0, byProject: [] }))
      .finally(() => setLoading(false));
  }, []);
  
  return { data, loading };
};

export const useQuarters = () => {
  const [quarters, setQuarters] = useState([]);

  useEffect(() => {
    api.getQuarters()
      .then(res => setQuarters(res?.quarters || []))
      .catch(() => setQuarters([]));
  }, []);

  return quarters;
};
