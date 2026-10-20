const express = require('express');
const router = express.Router();
const billing = require('../core/billing');

// Cek saldo user
router.get('/billing/balance', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json({ error: 'userId wajib' });
  res.json({ ok: true, billing: billing.getBilling(userId) });
});

// Top-up saldo (admin only, atau dari payment callback)
router.post('/billing/topup', (req, res) => {
  const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Admin key salah' });
  }

  const { userId, amount, source } = req.body;
  if (!userId || !amount) return res.json({ error: 'userId & amount wajib' });

  const result = billing.topupBalance(userId, parseFloat(amount), source || 'admin');
  res.json({ ok: true, billing: result });
});

// Cek harga model
router.get('/billing/prices', (req, res) => {
  res.json({
    ok: true,
    markup: billing.MARKUP,
    groq: billing.GROQ_PRICES,
    cerebras: billing.CEREBRAS_PRICES
  });
});

module.exports = router;
