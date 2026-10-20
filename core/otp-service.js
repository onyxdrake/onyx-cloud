// core/otp-service.js
// OTP-as-a-Service — kirim OTP buat user developer

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const OTP_FILE = path.join(__dirname, '..', 'data', 'otp-service.json');

function loadOtp() {
  try { return JSON.parse(fs.readFileSync(OTP_FILE, 'utf8')); }
  catch { return {}; }
}

function saveOtp(data) {
  const dir = path.dirname(OTP_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OTP_FILE, JSON.stringify(data, null, 2));
}

function generateKode() {
  return String(crypto.randomInt(100000, 999999));
}

function generateMagicToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Kirim via Gmail (default)
async function kirimViaGmail(to, kode, app, type = 'otp') {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;
  if (!user || !pass) return { ok: false, error: 'Gmail gak dikonfig' };

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });

    const subject = type === 'magic'
      ? `Login link for ${app}`
      : `Your ${app} verification code: ${kode}`;

    const html = type === 'magic' ? `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#0a0a0a;color:#eee;border-radius:16px;">
        <h2 style="color:#0f0;text-align:center;">🔐 ${app}</h2>
        <p style="color:#ccc;text-align:center;">Klik tombol di bawah buat login:</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="#" style="background:#0f0;color:#000;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;">Login Sekarang</a>
        </div>
        <p style="color:#666;font-size:11px;text-align:center;">Link berlaku 10 menit.</p>
      </div>
    ` : `
      <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#0a0a0a;color:#eee;border-radius:16px;">
        <h2 style="color:#0f0;text-align:center;">🔐 ${app}</h2>
        <p style="color:#ccc;text-align:center;">Kode verifikasi lo:</p>
        <div style="background:#111;padding:24px;text-align:center;border-radius:12px;margin:20px 0;">
          <span style="font-size:42px;letter-spacing:12px;color:#0f0;font-weight:bold;">${kode}</span>
        </div>
        <p style="color:#666;font-size:12px;text-align:center;">Kode berlaku 10 menit.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"${app}" <${user}>`,
      to,
      subject,
      html
    });

    return { ok: true, via: 'gmail' };
  } catch (e) {
    return { ok: false, error: e.message, via: 'gmail' };
  }
}

// Kirim via Telegram Client API (nomor pribadi lo)
async function kirimViaTelegram(to, kode, app, type = 'otp') {
  const tgClient = require('./telegram-client');

  const text = type === 'magic'
    ? `🔐 ${app} — Magic Link\n\nUntuk: ${to}\nToken: ${kode}\n\nForward ke user.`
    : `🔐 ${app} — OTP\n\nUntuk: ${to}\nKode: ${kode}\n\nForward ke user.`;

  try {
    // Kirim ke diri sendiri (lo) — biar lo forward manual
    const result = await tgClient.kirimKeSelf(text);
    if (result.ok) return { ok: true, via: 'telegram-personal' };
    return { ok: false, error: result.error, via: 'telegram-personal' };
  } catch (e) {
    return { ok: false, error: e.message, via: 'telegram-personal' };
  }
}

// Fungsi utama — kirim OTP dengan fallback
async function kirimOTP(to, app, options = {}) {
  const {
    type = 'otp',           // 'otp' atau 'magic'
    provider = 'auto',       // 'auto', 'gmail', 'telegram'
    magicUrl = '',           // URL buat magic link
    fromEmail = ''           // Email pengirim (kalau mau custom)
  } = options;

  const kode = type === 'magic' ? generateMagicToken() : generateKode();

  // Simpen history
  const all = loadOtp();
  const id = 'otp_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  all[id] = {
    id,
    to,
    app,
    type,
    kode,
    magicUrl,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
    status: 'pending'
  };
  saveOtp(all);

  let result;
  if (provider === 'gmail') {
    result = await kirimViaGmail(to, kode, app, type);
  } else if (provider === 'telegram') {
    result = await kirimViaTelegram(to, kode, app, type);
  } else {
    // Auto: coba Gmail dulu, fallback Telegram
    result = await kirimViaGmail(to, kode, app, type);
    if (!result.ok) {
      console.log(`[OTP] Gmail gagal, fallback Telegram...`);
      const tg = await kirimViaTelegram(to, kode, app, type);
      if (tg.ok) result = tg;
      else result = { ok: false, error: `Gmail: ${result.error}, Telegram: ${tg.error}` };
    }
  }

  // Update status
  all[id].status = result.ok ? 'sent' : 'failed';
  all[id].via = result.via || 'unknown';
  saveOtp(all);

  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    id,
    via: result.via,
    message: `OTP terkirim ke ${to}`,
    expiresIn: 600
  };
}

// Verifikasi OTP
function verifikasiOTP(id, kode) {
  const all = loadOtp();
  const entry = all[id];
  if (!entry) return { ok: false, error: 'OTP gak ditemukan' };
  if (Date.now() > entry.expiresAt) return { ok: false, error: 'OTP kadaluarsa' };
  if (entry.kode !== kode) return { ok: false, error: 'Kode salah' };

  entry.status = 'verified';
  entry.verifiedAt = Date.now();
  saveOtp(all);

  return { ok: true, to: entry.to, app: entry.app };
}

module.exports = { kirimOTP, verifikasiOTP };
