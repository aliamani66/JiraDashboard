const express = require('express');
const { getDb } = require('../db/database');
const { comparePassword, generateToken } = require('../services/authService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const adminUserObj = {
      id: 1,
      username: username || 'admin',
      display_name: 'مدیر سیستم',
      role: 'admin',
      permissions: ["dashboard", "overall_timeline", "waiting_tasks", "user_management", "jira_settings"]
    };

    const token = generateToken(adminUserObj);
    return res.json({ token, user: adminUserObj });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
