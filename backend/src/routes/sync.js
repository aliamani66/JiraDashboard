const express = require('express');
const { authenticate } = require('../middleware/auth');
const cacheService = require('../services/cacheService');

const router = express.Router();

router.use(authenticate);

// GET /api/sync/status - Available to all authenticated users
router.get('/status', (req, res) => {
  try {
    const status = cacheService.getLastSync();
    res.json(status || {});
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

// POST /api/sync - Trigger manual sync
router.post('/', async (req, res) => {
  try {
    const result = await cacheService.syncFromJira();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
