const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const auth = require('../core/auth');
const verify = require('../core/verify');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const CHANGE_LOG = path.join(__dirname, '..', 'data', 'account-changes.json');

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function logChange(email, action, details) {
  let log = {};
  try { log = JSON.parse(fs.readFileSync(CHANGE_LOG, 'utf8')); }
  catch {}
  if (!log[email]) log[email] = [];
  log[email].push({
    time: Date.now(),
    action,
    details,
    ip: details.ip
  });
  // Keep max 100 per user
  if (log[email].length > 100) log[email] = log[email].slice(-100);
  fs.writeFileSync(CHANGE_LOG, JSON.stringify(log, null, 2));
}

// 1. GANTI NAMA (gak butuh OTP)
router.post('/account/change-name', (req, res) => {
  const { email, userId, newName, password } = req.body;
  if (!email || !newName || !password) {
    return res.json({ error: 'Email, nama baru, dan password wajib' });
  }

  const users = loadUsers();
  const user = users[email];
  if (!user) return res.json({ error: 'User gak ditemukan' });

  // Verifikasi password
  if (!auth.verifyPassword(password, user.passwordHash)) {
    return res.json({ error: 'Password salah' });
  }

  if (newName.length < 2 || newName.length > 50) {
    return res.json({ error: 'Nama harus 2-50 karakter' });
  }

  const oldName = user.displayName || '';
  user.displayName = newName;
  users[email] = user;
  saveUsers(users);

  logChange(email, 'change_name', { from: oldName, to: newName, ip: req.ip });

  res.json({ ok: true, message: 'Nama berhasil diganti', displayName: newName });
});

// 2. REQUEST GANTI EMAIL (kirim OTP ke email baru)
router.post('/account/request-change-email', async (req, res) => {
  const { email, newEmail, password } = req.body;
  if (!email || !newEmail || !password) {
    return res.json({ error: 'Email lama, email baru, dan password wajib' });
  }

  const users = loadUsers();
  const user = users[email];
  if (!user) return res.json({ error: 'User gak ditemukan' });

  if (!auth.verifyPassword(password, user.passwordHash)) {
    return res.json({ error: 'Password salah' });
  }

  if (users[newEmail]) return res.json({ error: 'Email baru udah dipakai' });

  // Kirim OTP ke email baru
  const result = await verify.kirimKode(newEmail);
  if (!result.ok) return res.json({ error: result.error });

  // Simpen pending change
  const pendingFile = path.join(__dirname, '..', 'data', 'pending-email-changes.json');
  let pending = {};
  try { pending = JSON.parse(fs.readFileSync(pendingFile, 'utf8')); } catch {}

  pending[newEmail] = {
    oldEmail: email,
    newEmail,
    requestedAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000
  };
  fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));

  res.json({
    ok: true,
    message: `Kode OTP dikirim ke ${newEmail}. Masukin kode buat konfirmasi.`
  });
});

// 3. KONFIRMASI GANTI EMAIL
router.post('/account/confirm-change-email', async (req, res) => {
  const { newEmail, kode } = req.body;
  if (!newEmail || !kode) return res.json({ error: 'Data kurang' });

  // Verifikasi OTP
  const cek = verify.cekKode(newEmail, kode);
  if (!cek.ok) return res.json({ error: cek.error });

  // Ambil pending
  const pendingFile = path.join(__dirname, '..', 'data', 'pending-email-changes.json');
  let pending = {};
  try { pending = JSON.parse(fs.readFileSync(pendingFile, 'utf8')); } catch {}

  const p = pending[newEmail];
  if (!p) return res.json({ error: 'Pending change gak ditemukan' });
  if (Date.now() > p.expiresAt) {
    delete pending[newEmail];
    fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));
    return res.json({ error: 'Waktu habis. Ulangi dari awal.' });
  }

  // Pindahin data user
  const users = loadUsers();
  if (!users[p.oldEmail]) return res.json({ error: 'User lama gak ada' });

  users[newEmail] = users[p.oldEmail];
  users[newEmail].email = newEmail;
  delete users[p.oldEmail];
  saveUsers(users);

  delete pending[newEmail];
  fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));

  logChange(newEmail, 'change_email', { from: p.oldEmail, to: newEmail, ip: req.ip });

  res.json({ ok: true, message: `Email berhasil diganti ke ${newEmail}` });
});

// 4. REQUEST RESET PASSWORD (lupa password)
router.post('/account/request-reset-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.json({ error: 'Email wajib' });

  const users = loadUsers();
  if (!users[email]) {
    // Jangan kasih tau email gak ada (security)
    return res.json({ ok: true, message: 'Kalau email terdaftar, link bakal dikirim.' });
  }

  // Generate token
  const token = crypto.randomBytes(32).toString('hex');
  const resetFile = path.join(__dirname, '..', 'data', 'password-resets.json');
  let resets = {};
  try { resets = JSON.parse(fs.readFileSync(resetFile, 'utf8')); } catch {}

  resets[token] = {
    email,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 menit
    used: false
  };
  fs.writeFileSync(resetFile, JSON.stringify(resets, null, 2));

  // Kirim email reset
  const baseUrl = process.env.OAUTH_BASE_URL || 'https://compactly-propeller-livestock.ngrok-free.dev';
  const resetUrl = `${baseUrl}/reset-password.html?token=${token}`;

  // Pakai kirimKode atau custom email
  // (kita pakai notif Telegram biar cepat)
  try {
    const tgClient = require('../core/telegram-client');
    await tgClient.kirimKeSelf(`🔐 Password Reset\n\nEmail: ${email}\nLink: ${resetUrl}\n\nBerlaku 30 menit.`);
  } catch (e) {}

  res.json({ ok: true, message: 'Kalau email terdaftar, link bakal dikirim.' });
});

// 5. KONFIRMASI RESET PASSWORD
router.post('/account/confirm-reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.json({ error: 'Data kurang' });

  const resetFile = path.join(__dirname, '..', 'data', 'password-resets.json');
  let resets = {};
  try { resets = JSON.parse(fs.readFileSync(resetFile, 'utf8')); } catch {}

  const r = resets[token];
  if (!r) return res.json({ error: 'Token invalid' });
  if (r.used) return res.json({ error: 'Token udah dipakai' });
  if (Date.now() > r.expiresAt) return res.json({ error: 'Token kadaluarsa' });

  // Update password
  const users = loadUsers();
  const user = users[r.email];
  if (!user) return res.json({ error: 'User gak ada' });

  const valid = auth.validasiPassword(newPassword);
  if (!valid.ok) return res.json({ error: valid.error });

  user.passwordHash = auth.hashPassword(newPassword);
  user.passwordChangedAt = Date.now();
  users[r.email] = user;
  saveUsers(users);

  r.used = true;
  r.usedAt = Date.now();
  fs.writeFileSync(resetFile, JSON.stringify(resets, null, 2));

  logChange(r.email, 'reset_password', { ip: req.ip });

  res.json({ ok: true, message: 'Password berhasil direset' });
});

// 6. GANTI PASSWORD (dari dalam akun, harus tau password lama)
router.post('/account/change-password', (req, res) => {
  const { email, oldPassword, newPassword } = req.body;
  if (!email || !oldPassword || !newPassword) {
    return res.json({ error: 'Data kurang' });
  }

  const users = loadUsers();
  const user = users[email];
  if (!user) return res.json({ error: 'User gak ditemukan' });

  if (!auth.verifyPassword(oldPassword, user.passwordHash)) {
    return res.json({ error: 'Password lama salah' });
  }

  const valid = auth.validasiPassword(newPassword);
  if (!valid.ok) return res.json({ error: valid.error });

  user.passwordHash = auth.hashPassword(newPassword);
  user.passwordChangedAt = Date.now();
  users[email] = user;
  saveUsers(users);

  logChange(email, 'change_password', { ip: req.ip });

  res.json({ ok: true, message: 'Password berhasil diganti' });
});

// 7. CEK HISTORY PERUBAHAN AKUN
router.get('/account/history', (req, res) => {
  const { email } = req.query;
  if (!email) return res.json({ error: 'Email wajib' });

  try {
    const log = JSON.parse(fs.readFileSync(CHANGE_LOG, 'utf8'));
    res.json({ ok: true, history: log[email] || [] });
  } catch {
    res.json({ ok: true, history: [] });
  }
});

module.exports = router;
