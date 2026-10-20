const express = require('express');
const router = express.Router();
const apiKey = require('../core/api-key');

// Generate key baru
router.post('/api-keys/generate', (req, res) => {
  const { email, domains } = req.body;
  if (!email) return res.json({ error: 'Email wajib' });

  // Cek user premium
  const limits = require('../core/limits');
  const sub = limits.cekSubscription(email);
  if (!sub.ok || sub.tier === 'free') {
    return res.json({ error: 'Fitur ini cuma buat premium user.' });
  }

  const result = apiKey.generateKey(email, domains || []);
  res.json(result);
});

// List key
router.get('/api-keys/list', (req, res) => {
  const { email } = req.query;
  if (!email) return res.json({ error: 'Email wajib' });

  const limits = require('../core/limits');
  const sub = limits.cekSubscription(email);
  if (!sub.ok || sub.tier === 'free') {
    return res.json({ error: 'Fitur premium.' });
  }

  res.json({ ok: true, keys: apiKey.listKeys(email) });
});

// Revoke key
router.post('/api-keys/revoke', (req, res) => {
  const { email, preview } = req.body;
  if (!email || !preview) return res.json({ error: 'Data kurang' });

  const result = apiKey.revokeKey(email, preview);
  res.json(result);
});

module.exports = router;
