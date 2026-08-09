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

    const db = getDb();
    
    try {
      db.prepare("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[\"dashboard\",\"overall_timeline\",\"waiting_tasks\",\"user_management\",\"jira_settings\"]'").run();
    } catch (e) {}

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    const { password_hash, ...userWithoutPassword } = user;
    
    let perms = ["dashboard", "overall_timeline", "waiting_tasks", "user_management", "jira_settings"];
    if (userWithoutPassword.permissions) {
      try {
        perms = typeof userWithoutPassword.permissions === 'string' ? JSON.parse(userWithoutPassword.permissions) : userWithoutPassword.permissions;
      } catch (e) {}
    }
    userWithoutPassword.permissions = perms;

    res.json({ token, user: userWithoutPassword });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
