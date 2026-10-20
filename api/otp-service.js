const express = require('express');
const router = express.Router();

// MIDDLEWARE GUARD — semua route /otp/* butuh API key valid
router.use('/otp', (req, res, next) => {
  if (!req.apiUser || !req.apiKeyInfo) {
    return res.status(401).json({
      error: 'API key valid diperlukan.',
      hint: 'Kirim via header X-API-Key. Dapatkan di /api-keys.html'
    });
  }
  next();
});

const verify = require('../core/verify');
const billing = require('../core/billing');

// Kirim OTP via API (buat user premium)
router.post('/otp/send', async (req, res) => {
  const { to, app } = req.body;
  const email = req.apiUser;

  if (!to || !to.includes('@')) return res.json({ error: 'Email tujuan invalid' });

  // Cek subscription
  const limits = require('../core/limits');
  const sub = limits.cekSubscription(email);
  if (!sub.ok || sub.tier === 'free') {
    return res.json({ error: 'Fitur ini cuma buat premium user.' });
  }

  // Cek kuota OTP bulanan
  const keyInfo = req.apiKeyInfo;
  const otpUsed = keyInfo.usage.otpSent || 0;
  const otpLimit = { basic: 100, premium: 1000, pro: 10000 }[sub.tier] || 0;

  if (otpUsed >= otpLimit) {
    return res.json({ error: `Kuota OTP habis (${otpLimit}/bulan). Upgrade paket.` });
  }

  // Kirim OTP
  const result = await verify.kirimKode(to);
  if (!result.ok) return res.json({ error: result.error });

  // Update usage
  keyInfo.usage.otpSent = otpUsed + 1;
  const fs = require('fs');
  const path = require('path');
  const KEYS_FILE = path.join(__dirname, '..', 'data', 'api-keys.json');
  const keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  for (const k of keys[email]) {
    if (k.keyHash === keyInfo.keyHash) k.usage.otpSent = otpUsed + 1;
  }
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));

  res.json({
    ok: true,
    message: `OTP terkirim ke ${to}`,
    sisaKuota: otpLimit - (otpUsed + 1)
  });
});

// Cek kuota
router.get('/otp/quota', (req, res) => {
  const email = req.apiUser;
  if (!email || !req.apiKeyInfo) {
    return res.status(401).json({ error: 'API key valid diperlukan. Kirim via header X-API-Key.' });
  }
  const limits = require('../core/limits');
  const sub = limits.cekSubscription(email);

  const otpLimit = { basic: 100, premium: 1000, pro: 10000 }[sub.tier] || 0;
  const otpUsed = req.apiKeyInfo.usage.otpSent || 0;

  res.json({
    ok: true,
    tier: sub.tier,
    used: otpUsed,
    limit: otpLimit,
    remaining: Math.max(0, otpLimit - otpUsed),
    resetAt: sub.expires
  });
});

module.exports = router;
