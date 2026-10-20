const express = require('express');
const router = express.Router();
const pricing = require('../core/pricing');

router.get('/pricing/features', (req, res) => {
  res.json({ ok: true, features: pricing.FEATURE_PRICES });
});

router.post('/pricing/calculate', (req, res) => {
  const { features = [] } = req.body;
  res.json({ ok: true, ...pricing.hitungHarga(features) });
});

module.exports = router;
