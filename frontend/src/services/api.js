const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  if (!response.ok) {
    let errMsg = `خطای API (کد ${response.status})`;
    try { 
      const d = await response.json(); 
      errMsg = d.message || d.error || d.details || errMsg; 
    } catch {}
    throw new Error(errMsg);
  }
  return response.json();
}

export const api = {
  login: (username, password) => fetch(API_BASE + '/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username, password}) }).then(async r => {
    const data = await r.json();
    if (!r.ok || !data.token) {
      throw new Error(data.error || 'نام کاربری یا رمز عبور اشتباه است');
    }
    return data;
  }),
  getMe: () => fetchWithAuth('/auth/me'),
  getProjects: () => fetchWithAuth('/projects'),
  getProject: (id) => fetchWithAuth(`/projects/${id}`),
  syncEpicTasks: (id) => fetchWithAuth(`/projects/${id}/sync`, { method: 'POST' }),
  getProjectGantt: (id) => fetchWithAuth(`/projects/${id}/gantt`),
  getProjectBlocked: (id) => fetchWithAuth(`/projects/${id}/blocked`),
  getWaitingTasks: () => fetchWithAuth('/waiting-tasks'),
  getStats: () => fetchWithAuth('/stats'),
  getQuarters: () => fetchWithAuth('/quarters'),
  getSyncStatus: () => fetchWithAuth('/sync/status'),
  triggerSync: () => fetchWithAuth('/sync', { method: 'POST' }),
  getUsers: () => fetchWithAuth('/users'),
  createUser: (userData) => fetchWithAuth('/users', { method: 'POST', body: JSON.stringify(userData) }),
  updateUserPermissions: (id, data) => fetchWithAuth(`/users/${id}/permissions`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => fetchWithAuth(`/users/${id}`, { method: 'DELETE' }),
  getJiraConfig: () => fetchWithAuth('/jira/config'),
  saveJiraConfig: (cfg) => fetchWithAuth('/jira/config', { method: 'PUT', body: JSON.stringify(cfg) }),
  fetchJiraProjects: () => fetchWithAuth('/jira/fetch-jira-projects'),
  runJiraDiagnostic: (params) => fetchWithAuth('/jira/diagnose', { method: 'POST', body: JSON.stringify(params || {}) }),
  syncMonthlyJiraConfig: () => fetchWithAuth('/jira/sync-monthly', { method: 'POST' }),
  syncRangeJiraConfig: (dates) => fetchWithAuth('/jira/sync-range', { method: 'POST', body: JSON.stringify(dates) }),
  syncSingleMonthJiraConfig: (data) => fetchWithAuth('/jira/sync-single-month', { method: 'POST', body: JSON.stringify(data) }),
  syncEpics: () => fetchWithAuth('/jira/sync-epics', { method: 'POST' }),
  previewJqlQueries: (data) => fetchWithAuth('/jira/preview-jql', { method: 'POST', body: JSON.stringify(data) }),
  testAllJqlQueries: (data) => fetchWithAuth('/jira/test-all-jql', { method: 'POST', body: JSON.stringify(data) }),
  resetDatabase: () => fetchWithAuth('/jira/reset-db', { method: 'POST' }),
  clearDatabase: () => fetchWithAuth('/jira/clear-db', { method: 'POST' }),
  getManagerAuditReport: () => fetchWithAuth('/reports/manager-audit'),
  getAllSprints: () => fetchWithAuth('/all-sprints'),
  getSprintTasks: () => fetchWithAuth('/all-sprints'),
  getJiraTotalCount: (months) => fetchWithAuth('/jira/jira-count' + (months ? `?months=${months}` : '')),
  getMismatchDetails: (category, months) => fetchWithAuth(`/jira/mismatch-details?category=${category || 'epics'}&months=${months || 3}`),
  getDbStats: (months) => fetchWithAuth('/jira/db-stats' + (months ? `?months=${months}` : '')),
  getLastSyncReport: () => fetchWithAuth('/jira/last-sync-report'),
  getLiveMappingInspector: (months) => fetchWithAuth('/jira/live-mapping-inspector' + (months ? `?months=${months}` : '')),
  syncMissingTasks: (payload) => fetchWithAuth('/jira/sync-missing-tasks', { method: 'POST', body: JSON.stringify(typeof payload === 'object' ? payload : { months: payload }) }),
  deleteDbOnlyTasks: (payload) => fetchWithAuth('/jira/delete-db-only-tasks', { method: 'POST', body: JSON.stringify(payload) }),
  getDbTables: () => fetchWithAuth('/db/tables'),
  getDbTableData: (tableName, page = 1, search = '', category = 'all', limit = 50) => fetchWithAuth(`/db/data/${tableName}?page=${page}&search=${encodeURIComponent(search)}&category=${category}&limit=${limit}`),
  runDbQuery: (sql) => fetchWithAuth('/db/query', { method: 'POST', body: JSON.stringify({ sql }) }),
  runSystemTests: () => fetchWithAuth('/jira/run-tests', { method: 'POST' }),
  getBackendLogs: (params = {}) => {
    const fullParams = { limit: 1000, ...params };
    const qs = new URLSearchParams(fullParams).toString();
    return fetchWithAuth(`/jira/logs${qs ? '?' + qs : ''}`);
  },
  getLogsStreamUrl: () => {
    const token = localStorage.getItem('token') || '';
    const base = import.meta.env.VITE_API_BASE || '/api';
    return `${base}/jira/logs/stream?token=${encodeURIComponent(token)}`;
  },
  clearBackendLogs: () => fetchWithAuth('/jira/logs/clear', { method: 'POST' }),
};
