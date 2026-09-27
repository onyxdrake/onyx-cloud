const express = require('express');
const limits = require('../core/limits');
const router = express.Router();

router.get('/limit', (req, res) => {
  res.json(limits.getStatus(req));
});

router.post('/limit/set', (req, res) => {
  const { userId, tier } = req.body;
  if (!userId || !tier) return res.json({ error: 'userId & tier wajib' });
  limits.setUserTier(userId, tier);
  res.json({ ok: true, userId, tier });
});

module.exports = router;
