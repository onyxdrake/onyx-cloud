const express = require('express');
const router = express.Router();
const tracker = require('../core/login-tracker');

// List session aktif user
router.get('/auth/sessions', (req, res) => {
  const { email } = req.query;
  if (!email) return res.json({ error: 'Email wajib' });
  const sessions = tracker.getUserSessions(email);
  res.json({ ok: true, sessions });
});

// Revoke 1 session
router.get('/auth/revoke', (req, res) => {
  const { email, session } = req.query;
  if (!email || !session) return res.status(400).send('Email & session wajib');

  const ok = tracker.revokeSession(email, session);
  if (ok) {
    res.send(`
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Session Dicabut</title>
      <style>body{background:#0a0a0a;color:#ff6666;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}
      .box{max-width:400px;padding:24px;} h1{margin-bottom:16px;}</style></head>
      <body><div class="box">
        <h1>🚪 Session Dicabut</h1>
        <p>Session dari device itu udah dikeluarkan dari akun lo.</p>
        <p style="color:#888;font-size:13px;">Kalau lo curiga akun lo kena hack, ganti password sekarang.</p>
      </div></body></html>
    `);
  } else {
    res.status(404).send('Session gak ditemukan');
  }
});

// Revoke semua kecuali yang ini
router.get('/auth/revoke-all', (req, res) => {
  const { email, session } = req.query;
  if (!email || !session) return res.status(400).send('Email & session wajib');

  const count = tracker.revokeAllExcept(email, session);
  res.send(`
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Semua Session Dicabut</title>
    <style>body{background:#0a0a0a;color:#ff6666;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}
    .box{max-width:400px;padding:24px;} h1{margin-bottom:16px;}</style></head>
    <body><div class="box">
      <h1>🚪 ${count} Session Dicabut</h1>
      <p>Semua device lain udah dikeluarkan dari akun lo.</p>
      <p style="color:#888;font-size:13px;">Cuma device ini yang masih aktif.</p>
    </div></body></html>
  `);
});

module.exports = router;
