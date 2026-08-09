const express = require('express');
const { getDb } = require('../db/database');
const { hashPassword } = require('../services/authService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// List all users
router.get('/', (req, res) => {
  try {
    const db = getDb();
    
    // Ensure permissions column exists
    try {
      db.prepare("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[\"dashboard\",\"overall_timeline\",\"waiting_tasks\",\"user_management\",\"project_detail\"]'").run();
    } catch (e) {}

    const users = db.prepare("SELECT id, username, display_name, role, permissions FROM users").all();
    const formatted = users.map(u => {
      let perms = ["dashboard", "overall_timeline", "waiting_tasks", "user_management", "project_detail"];
      try {
        if (u.permissions) perms = JSON.parse(u.permissions);
      } catch(e) {}
      return { ...u, permissions: perms };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a new user
router.post('/', async (req, res) => {
  try {
    const { username, password, display_name, role, permissions } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'نام کاربری و کلمه عبور الزامی است.' });
    }

    const db = getDb();
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (existing) {
      return res.status(400).json({ error: 'این نام کاربری قبلاً ثبت گردیده است.' });
    }

    const password_hash = await hashPassword(password);
    const permsJson = JSON.stringify(permissions || ["dashboard", "overall_timeline", "waiting_tasks", "project_detail"]);

    db.prepare(`
      INSERT INTO users (username, password_hash, display_name, role, permissions)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, password_hash, display_name || username, role || 'viewer', permsJson);

    res.json({ message: 'کاربر با موفقیت ایجاد گردید.' });
  } catch (err) {
    console.error('Error creating user:', err.message);
    res.status(500).json({ error: 'خطا در ایجاد کاربر' });
  }
});

// Update permissions for a user
router.put('/:id/permissions', (req, res) => {
  try {
    const { id } = req.params;
    const { permissions, role, display_name } = req.body;

    const db = getDb();
    const permsJson = JSON.stringify(permissions || []);

    db.prepare(`
      UPDATE users 
      SET permissions = ?, role = COALESCE(?, role), display_name = COALESCE(?, display_name)
      WHERE id = ?
    `).run(permsJson, role, display_name, id);

    res.json({ message: 'دسترسی‌های کاربر با موفقیت به‌روزرسانی شد.' });
  } catch (err) {
    console.error('Error updating user permissions:', err.message);
    res.status(500).json({ error: 'خطا در ویرایش دسترسی‌های کاربر' });
  }
});

// Delete a user
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const user = db.prepare("SELECT username FROM users WHERE id = ?").get(id);
    if (user && user.username === 'admin') {
      return res.status(400).json({ error: 'حذف کاربر مدیر اصلی سیستم (admin) امکان‌پذیر نیست.' });
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.json({ message: 'کاربر با موفقیت حذف گردید.' });
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ error: 'خطا در حذف کاربر' });
  }
});

module.exports = router;
