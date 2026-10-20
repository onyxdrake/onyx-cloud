const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const tgClient = require('../core/telegram-client');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

// Simpen nomor HP user + link ke Telegram
router.post('/account/set-phone', async (req, res) => {
  const { email, phone } = req.body;
  if (!email || !phone) return res.json({ error: 'Email & phone wajib' });

  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  if (!users[email]) return res.json({ error: 'User gak ada' });

  // Validasi nomor
  const clean = phone.replace(/[^0-9+]/g, '');
  if (clean.length < 8) return res.json({ error: 'Nomor invalid' });

  users[email].phone = clean;
  users[email].phoneSetAt = Date.now();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

  res.json({ ok: true, message: 'Nomor HP tersimpan', phone: clean });
});

// Kirim OTP ke nomor Telegram
router.post('/account/send-phone-otp', async (req, res) => {
  const { email, phone } = req.body;
  if (!email || !phone) return res.json({ error: 'Data kurang' });

  // Generate OTP
  const kode = String(Math.floor(100000 + Math.random() * 900000));

  // Simpen ke verify-codes
  const codesFile = path.join(__dirname, '..', 'data', 'verify-codes.json');
  const codes = JSON.parse(fs.readFileSync(codesFile, 'utf8'));
  codes[email] = {
    kode,
    exp: Date.now() + 10 * 60 * 1000,
    channel: 'telegram-phone',
    phone
  };
  fs.writeFileSync(codesFile, JSON.stringify(codes, null, 2));

  // Kirim via Telegram
  const clean = phone.replace(/[^0-9+]/g, '');
  const result = await tgClient.kirimKeNomor(clean, `🔐 Kode OTP Onyx: ${kode}\n\nBerlaku 10 menit.`);

  if (result.ok) {
    return res.json({ ok: true, message: 'OTP dikirim ke Telegram', via: 'telegram' });
  }

  // Fallback: kirim ke admin (lo) biar lo forward manual
  console.log(`[Phone OTP] Gagal kirim ke ${clean}, fallback ke admin...`);
  const adminResult = await tgClient.kirimKeSelf(
    `🔐 *OTP Request — Onyx*\n\n` +
    `📱 Nomor: \`${clean}\`\n` +
    `📧 Email: \`${email}\`\n` +
    `🔢 Kode: \`${kode}\`\n\n` +
    `⚠️ Gagal kirim langsung ke user (nomor gak ada di Telegram). Forward manual ya.`
  );

  if (adminResult.ok) {
    res.json({
      ok: true,
      via: 'admin-forward',
      message: 'OTP dikirim via admin. Kode bakal di-forward manual ke lo.'
    });
  } else {
    res.json({
      error: 'Gagal kirim OTP. Coba lagi atau pakai email.'
    });
  }
});

module.exports = router;
