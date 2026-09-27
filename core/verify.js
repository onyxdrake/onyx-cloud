const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const CODE_FILE = path.join(__dirname, '..', 'data', 'verify-codes.json');

function loadCodes() {
  try { return JSON.parse(fs.readFileSync(CODE_FILE, 'utf8')); }
  catch { return {}; }
}
function saveCodes(data) {
  const dir = path.dirname(CODE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CODE_FILE, JSON.stringify(data, null, 2));
}

function buatKode() {
  return String(crypto.randomInt(1000, 9999));
}

async function kirimKode(email) {
  const kode = buatKode();
  const codes = loadCodes();

  // Rate limit: max 3 kirim per 10 menit
  const now = Date.now();
  const entry = codes[email] || {};
  if (entry.lastSent && now - entry.lastSent < 60000) {
    return { ok: false, error: 'Tunggu 1 menit sebelum kirim ulang' };
  }
  if (entry.count && now - entry.firstSent < 600000 && entry.count >= 3) {
    return { ok: false, error: 'Terlalu banyak permintaan. Coba lagi nanti.' };
  }

  codes[email] = {
    kode,
    exp: now + 10 * 60 * 1000,
    verified: false,
    lastSent: now,
    count: (entry.count || 0) + 1,
    firstSent: entry.firstSent || now
  };
  saveCodes(codes);

  const user = process.env.GMAIL_USER || '';
  const pass = process.env.GMAIL_PASS || '';

  // Kalo email user @gmail.com DAN GMAIL_USER @gmail.com DAN ada App Password
  const bisaKirim = email.endsWith('@gmail.com') && user.endsWith('@gmail.com') && pass.length >= 16 && !pass.includes(' ');

  if (!bisaKirim) {
    console.log(`\n📧 DEV MODE — Kode: ${kode} (${email})\n`);
    return { ok: true, dev: true, kode };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });

    await transporter.sendMail({
      from: `"Onyx Cloud" <${user}>`,
      to: email,
      subject: 'Kode Verifikasi Onyx',
      html: `<div style="font-family:-apple-system,sans-serif;max-width:400px;margin:0 auto;padding:24px;background:#0a0a0a;color:#eee;border-radius:16px;">
        <h1 style="color:#0f0;text-align:center;margin-bottom:20px;">🤖 Onyx Cloud</h1>
        <p>Halo!</p>
        <p>Kode verifikasi lo:</p>
        <div style="background:#1a1a1a;padding:24px;text-align:center;border-radius:12px;margin:20px 0;">
          <span style="font-size:42px;letter-spacing:12px;color:#0f0;font-weight:bold;">${kode}</span>
        </div>
        <p style="color:#666;font-size:12px;">Kode ini berlaku 10 menit. Jangan kasih ke siapa pun.</p>
        <p style="color:#666;font-size:11px;margin-top:20px;">Kalau lo gak minta kode ini, abaikan aja.</p>
      </div>`
    });

    return { ok: true };
  } catch (e) {
    console.log(`\n📧 Gmail gagal, fallback DEV — Kode: ${kode}\n`);
    return { ok: true, dev: true, kode, error: e.message };
  }
}

function cekKode(email, kode) {
  const codes = loadCodes();
  const data = codes[email];
  if (!data) return { ok: false, error: 'Kode gak ditemukan' };
  if (Date.now() > data.exp) return { ok: false, error: 'Kode kadaluarsa' };
  if (data.kode !== kode) return { ok: false, error: 'Kode salah' };
  data.verified = true;
  saveCodes(codes);
  return { ok: true };
}

function sudahVerifikasi(email) {
  const codes = loadCodes();
  return codes[email]?.verified === true;
}

function hapusKode(email) {
  const codes = loadCodes();
  delete codes[email];
  saveCodes(codes);
}

module.exports = { kirimKode, cekKode, sudahVerifikasi, hapusKode };
