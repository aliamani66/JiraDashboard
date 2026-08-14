const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../../src/app');
const { initDb } = require('../../src/db/database');

let authToken = '';

beforeAll(async () => {
  await initDb();
  authToken = jwt.sign(
    { id: 1, username: 'admin', role: 'admin', permissions: ['dashboard', 'overall_timeline', 'waiting_tasks', 'user_management', 'jira_settings'] },
    process.env.JWT_SECRET || 'dev-secret-key',
    { expiresIn: '24h' }
  );
});

describe('API Integration Tests', () => {
  describe('Health Check Endpoint', () => {
    test('GET /health returns 200 and status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Authentication & Projects', () => {
    test('GET /api/projects without token returns 401 Unauthorized', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(401);
    });

    test('GET /api/projects with valid token returns array of projects in response', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('projects');
      expect(Array.isArray(res.body.projects)).toBe(true);
    });

    test('GET /api/waiting-tasks returns waiting task structure', async () => {
      const res = await request(app)
        .get('/api/waiting-tasks')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalWaiting');
      expect(res.body).toHaveProperty('byProject');
      expect(Array.isArray(res.body.byProject)).toBe(true);
    });

    test('GET /api/all-sprints returns sprint tasks', async () => {
      const res = await request(app)
        .get('/api/all-sprints')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tasks');
      expect(Array.isArray(res.body.tasks)).toBe(true);
    });
  });

  describe('Jira Settings & DB Stats', () => {
    test('GET /api/jira/config returns connection and mapping configuration', async () => {
      const res = await request(app)
        .get('/api/jira/config')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('connection');
      expect(res.body).toHaveProperty('statusMapping');
    });

    test('GET /api/jira/db-stats returns valid database counts', async () => {
      const res = await request(app)
        .get('/api/jira/db-stats')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.totalTasks).toBe('number');
      expect(typeof res.body.totalProjects).toBe('number');
    });

    test('GET /api/jira/mismatch-details returns discrepancy analysis', async () => {
      const res = await request(app)
        .get('/api/jira/mismatch-details?category=totalTasks&months=3')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('mismatches');
      expect(Array.isArray(res.body.mismatches)).toBe(true);
    });
  });

  describe('Database Manager Direct API', () => {
    test('GET /api/db/tables returns list of SQLite tables', async () => {
      const res = await request(app)
        .get('/api/db/tables')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.tables)).toBe(true);
      const tableNames = res.body.tables.map(t => t.name);
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('users');
    });
  });
});
