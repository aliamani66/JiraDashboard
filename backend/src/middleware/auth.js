const { verifyToken } = require('../services/authService');
const { getDb } = require('../db/database');

function authenticate(req, res, next) {
  // Allow public/open access for report endpoints so opening print/export views in browser tabs never fails with 401
  if (req.path.includes('/reports/') || (req.originalUrl && req.originalUrl.includes('/reports/'))) {
    return next();
  }

  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  try {
    const decoded = verifyToken(token);
    const db = getDb();
    let user = db.prepare('SELECT id, username, display_name, role, permissions FROM users WHERE id = ?').get(decoded.id);
    
    const allPermsList = [
      "dashboard", "sprints", "overall_timeline", "manager_reports", "waiting_tasks", "database_manager", "jira_settings", "user_management",
      "jira_config", "jira_diagnostics", "jira_mapping", "jira_sync_range", "db_rebuild", "system_tests", "system_logs",
      "db_explorer", "db_query"
    ];

    if (!user && decoded.username === 'admin') {
      user = db.prepare('SELECT id, username, display_name, role, permissions FROM users WHERE username = ?').get('admin');
      if (!user) {
        user = {
          id: 1,
          username: 'admin',
          display_name: 'مدیر سیستم',
          role: 'admin',
          permissions: allPermsList
        };
      }
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    let perms = user.role === 'admin' ? allPermsList : ["dashboard", "overall_timeline", "waiting_tasks"];
    if (user.role === 'admin') {
      perms = allPermsList;
    } else if (user.permissions) {
      try {
        perms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
      } catch (e) {
        console.error('Error parsing user permissions JSON:', e);
      }
    }
    user.permissions = perms;
    
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
}

module.exports = {
  authenticate,
  requireAdmin
};
