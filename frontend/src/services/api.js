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
    let errMsg = 'API Error';
    try { const d = await response.json(); errMsg = d.error || d.message || errMsg; } catch {}
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
  runJiraDiagnostic: (params) => fetchWithAuth('/jira/diagnose', { method: 'POST', body: JSON.stringify(params || {}) }),
  resetDatabase: () => fetchWithAuth('/jira/reset-db', { method: 'POST' }),
  getAllSprints: () => fetchWithAuth('/all-sprints'),
};
