const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOGIN_FILE = path.join(__dirname, '..', 'data', 'telegram-logins.json');
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

function loadJSON(file, def = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return def; }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Bikin token login Telegram
router.post('/telegram-login/link', (req, res) => {
  const { telegramId, email } = req.body;
  if (!telegramId || !email) return res.json({ error: 'Data kurang' });

  const logins = loadJSON(LOGIN_FILE);
  logins[telegramId] = {
    telegramId,
    email,
    linkedAt: Date.now()
  };
  saveJSON(LOGIN_FILE, logins);

  res.json({ ok: true, message: 'Telegram linked ke ' + email });
});

// Cek user udah login apa belum
router.get('/telegram-login/status', (req, res) => {
  const { telegramId } = req.query;
  if (!telegramId) return res.json({ error: 'telegramId wajib' });

  const logins = loadJSON(LOGIN_FILE);
  const login = logins[telegramId];

  res.json({
    ok: true,
    loggedIn: !!login,
    email: login?.email || null
  });
});

module.exports = router;
