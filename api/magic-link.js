const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const auth = require('../core/auth');
const nodemailer = require('nodemailer');

const MAGIC_FILE = path.join(__dirname, '..', 'data', 'magic-links.json');

function loadJSON(file, def = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return def; }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Request magic link (setelah verifikasi password)
router.post('/auth/magic-link/request', async (req, res) => {
  const { email, password, telegramId } = req.body;
  if (!email || !password) return res.json({ error: 'Email & password wajib' });

  const user = auth.getUserByEmail(email);
  if (!user) return res.json({ error: 'Email atau password salah' });

  if (!auth.verifyPassword(password, user.passwordHash)) {
    return res.json({ error: 'Email atau password salah' });
  }

  // Generate token
  const token = crypto.randomBytes(32).toString('hex');
  const links = loadJSON(MAGIC_FILE);

  links[token] = {
    email,
    telegramId: telegramId || null,
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 menit
    used: false
  };
  saveJSON(MAGIC_FILE, links);

  // Kirim email
  const baseUrl = process.env.OAUTH_BASE_URL || 'https://compactly-propeller-livestock.ngrok-free.dev';
  const magicUrl = `${baseUrl}/api/auth/magic-link/verify?token=${token}${telegramId ? '&telegram=' + telegramId : ''}`;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"Onyx Cloud" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '🔐 Login Link — Onyx Cloud',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#0a0a0a;color:#eee;border-radius:16px;">
          <h2 style="color:#0f0;text-align:center;">🔐 Onyx Cloud</h2>
          <p style="color:#ccc;">Halo!</p>
          <p style="color:#ccc;">Klik tombol di bawah buat login:</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${magicUrl}" style="background:#0f0;color:#000;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;">Login Sekarang</a>
          </div>
          <p style="color:#666;font-size:12px;">Link berlaku 15 menit.</p>
          <p style="color:#666;font-size:11px;">Kalau bukan lo, abaikan aja.</p>
        </div>
      `
    });

    res.json({ ok: true, message: 'Magic link dikirim ke email lo' });
  } catch (e) {
    res.json({ error: 'Gagal kirim email: ' + e.message });
  }
});

// Verify magic link
router.get('/auth/magic-link/verify', (req, res) => {
  const { token, telegram } = req.query;
  if (!token) return res.status(400).send('Token wajib');

  const links = loadJSON(MAGIC_FILE);
  const data = links[token];

  if (!data) return res.status(404).send('Link invalid');
  if (data.used) return res.status(410).send('Link udah dipakai');
  if (Date.now() > data.expiresAt) return res.status(410).send('Link kadaluarsa');

  // Mark used
  data.used = true;
  data.usedAt = Date.now();
  saveJSON(MAGIC_FILE, links);

  // Bikin session token
  const user = auth.getUserByEmail(data.email);
  const sessionToken = crypto.createHash('sha256')
    .update(user.userId + Date.now())
    .digest('hex');

  // Link Telegram kalau ada
  if (telegram) {
    const LOGIN_FILE = path.join(__dirname, '..', 'data', 'telegram-logins.json');
    const logins = loadJSON(LOGIN_FILE);
    logins[telegram] = {
      telegramId: telegram,
      email: data.email,
      linkedAt: Date.now()
    };
    saveJSON(LOGIN_FILE, logins);
  }

  // Set cookie + redirect
  res.setHeader('Set-Cookie', `onyx_token=${sessionToken}; Path=/; HttpOnly; Max-Age=${30*24*60*60}`);
  res.redirect('/onyx.html?login=success');
});

module.exports = router;
