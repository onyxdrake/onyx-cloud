const express = require('express');
const router = express.Router();
const otpService = require('../core/otp-service');

// Kirim OTP
router.post('/otp/send', async (req, res) => {
  const { to, app, type, provider, magicUrl } = req.body;
  const email = req.apiUser;

  if (!to || !to.includes('@')) return res.json({ error: 'Email tujuan invalid' });

  // Cek subscription developer
  const limits = require('../core/limits');
  const sub = limits.cekSubscription(email);
  if (!sub.ok || sub.tier === 'free') {
    return res.json({ error: 'Fitur ini cuma buat premium user.' });
  }

  // Cek kuota OTP
  const keyInfo = req.apiKeyInfo;
  const otpUsed = keyInfo.usage.otpSent || 0;
  const otpLimit = { basic: 100, premium: 1000, pro: 10000 }[sub.tier] || 0;

  if (otpUsed >= otpLimit) {
    return res.json({ error: `Kuota OTP habis (${otpLimit}/bulan).` });
  }

  // Kirim
  const result = await otpService.kirimOTP(to, app || 'App', {
    type: type || 'otp',
    provider: provider || 'auto',
    magicUrl: magicUrl || ''
  });

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
    otpId: result.id,
    via: result.via,
    message: result.message,
    expiresIn: result.expiresIn,
    sisaKuota: otpLimit - (otpUsed + 1)
  });
});

// Verifikasi OTP
router.post('/otp/verify', (req, res) => {
  const { otpId, kode } = req.body;
  if (!otpId || !kode) return res.json({ error: 'otpId & kode wajib' });
  res.json(otpService.verifikasiOTP(otpId, kode));
});

// Cek kuota
router.get('/otp/quota', (req, res) => {
  const email = req.apiUser;
  const limits = require('../core/limits');
  const sub = limits.cekSubscription(email);
  const otpLimit = { basic: 100, premium: 1000, pro: 10000 }[sub.tier] || 0;
  const otpUsed = req.apiKeyInfo.usage.otpSent || 0;

  res.json({
    ok: true,
    tier: sub.tier,
    used: otpUsed,
    limit: otpLimit,
    remaining: Math.max(0, otpLimit - otpUsed)
  });
});

module.exports = router;
