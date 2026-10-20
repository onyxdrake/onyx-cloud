const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const tgClient = require('./telegram-client');
const tgOtp = require('./telegram-otp');

const CODE_FILE = path.join(__dirname, '..', 'data', 'verify-codes.json');

// Deteksi bahasa dari domain email
function deteksiBahasaEmail(email) {
  const domain = (email.split('@')[1] || '').toLowerCase();

  // Domain Indonesia
  const domainIndo = ['gmail.co.id', 'yahoo.co.id', 'rocketmail.com', 'telkom.net', 'indosat.net.id', 'biz.id', 'my.id', 'sch.id', 'ac.id', 'go.id', 'web.id', 'or.id', 'co.id', 'kop.id'];
  if (domainIndo.some(d => domain.endsWith(d))) return 'id';

  // Domain global populer — pakai Inggris
  const domainGlobal = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'protonmail.com', 'icloud.com', 'live.com', 'aol.com', 'zoho.com', 'mail.com', 'gmx.com', 'yandex.com'];
  if (domainGlobal.some(d => domain.endsWith(d))) return 'en';

  // Domain gak dikenal → cek TLD
  const tldIndo = ['.id', '.co.id', '.sch.id', '.ac.id', '.go.id', '.web.id', '.or.id', '.my.id', '.biz.id'];
  if (tldIndo.some(t => domain.endsWith(t))) return 'id';

  // Fallback → Inggris (internasional)
  return 'en';
}

// Template email per bahasa
function getEmailTemplate(bahasa, kode) {
  const tahun = new Date().getFullYear();

  const brand = (subtitle, greeting, intro, codeLabel, validity, ignoreMsg, footerNote, magicToken) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="500" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.15);">
          <!-- Header -->
          <tr>
            <td style="padding:36px 40px 24px;text-align:center;background:linear-gradient(135deg,#0a0a0a 0%,#0f1f0f 100%);">
              <div style="font-size:36px;margin-bottom:8px;">🤖</div>
              <div style="font-size:22px;font-weight:700;color:#00ff88;letter-spacing:-0.5px;">Onyx Cloud</div>
              <div style="font-size:11px;color:#666;margin-top:6px;letter-spacing:0.5px;text-transform:uppercase;">${subtitle}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <div style="font-size:15px;color:#e0e0e0;margin-bottom:16px;">${greeting}</div>
              <div style="font-size:14px;color:#aaa;line-height:1.6;margin-bottom:28px;">${intro}</div>

              <!-- Code Box -->
              <div style="background:#111;border:1px solid #1f1f1f;border-radius:12px;padding:28px 20px;text-align:center;margin-bottom:16px;">
                <div style="font-size:11px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;">${codeLabel}</div>
                <div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:40px;letter-spacing:14px;color:#00ff88;font-weight:700;text-indent:14px;">${kode}</div>
              </div>

              <!-- Magic Link Button -->
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${process.env.OAUTH_BASE_URL || 'https://compactly-propeller-livestock.ngrok-free.dev'}/api/auth/magic?token=${magicToken}&email=${encodeURIComponent(email)}"
                   style="display:inline-block;background:#00ff88;color:#000;padding:14px 32px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">
                  🔓 Login Sekarang
                </a>
                <div style="font-size:11px;color:#666;margin-top:8px;">Atau klik link ini kalau tombol gak muncul</div>
              </div>

              <!-- Validity -->
              <div style="font-size:12px;color:#888;line-height:1.6;margin-bottom:8px;">⏱️ ${validity}</div>
              <div style="font-size:12px;color:#888;line-height:1.6;">🔒 ${ignoreMsg}</div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #1f1f1f;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <div style="font-size:11px;color:#555;line-height:1.7;">${footerNote}</div>
              <div style="font-size:10px;color:#333;margin-top:16px;">© ${tahun} Onyx Cloud · <a href="https://onyxdrake.github.io/onyx-cloud" style="color:#00ff88;text-decoration:none;">onyxdrake.github.io/onyx-cloud</a></div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  if (bahasa === 'id') {
    return {
      subject: `Kode Verifikasi Onyx: ${kode}`,
      html: brand(
        'Verifikasi Email',
        'Halo! 👋',
        'Terima kasih udah gabung ke Onyx Cloud. Lo bisa pilih: masukin kode di bawah, atau klik tombol login:',
        'Kode Verifikasi',
        'Kode & link berlaku <strong style="color:#e0e0e0;">10 menit</strong> setelah email ini diterima.',
        'Kalau lo gak minta ini, abaikan aja. Akun lo tetap aman.',
        'Email ini dikirim otomatis. Kalau ada pertanyaan, hubungi <a href="mailto:onyxdrake.ai@gmail.com" style="color:#00ff88;text-decoration:none;">onyxdrake.ai@gmail.com</a>',
        magicToken
      )
    };
  }

  // Default: English
  return {
    subject: `Your Onyx verification code: ${kode}`,
    html: brand(
      'Email Verification',
      'Hello! 👋',
      'Thanks for joining Onyx Cloud. You can either enter the code below, or click the login button:',
      'Verification Code',
      'Code & link valid for <strong style="color:#e0e0e0;">10 minutes</strong> after receiving this email.',
      "If you didn't request this, just ignore it. Your account is safe.",
      'This is an automated email. For questions, contact <a href="mailto:onyxdrake.ai@gmail.com" style="color:#00ff88;text-decoration:none;">onyxdrake.ai@gmail.com</a>',
      magicToken
    )
  };
}

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

function buatMagicToken(email) {
  return crypto.randomBytes(32).toString('hex');
}

function buatMagicToken(email) {
  return crypto.randomBytes(32).toString('hex');
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

  const magicToken = buatMagicToken();

  codes[email] = {
    kode,
    magicToken,
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

    const bahasa = deteksiBahasaEmail(email);
    const tmpl = getEmailTemplate(bahasa, kode);

    await transporter.sendMail({
      from: `"Onyx Cloud" <${user}>`,
      to: email,
      subject: tmpl.subject,
      html: tmpl.html
    });

    return { ok: true };
  } catch (e) {
    console.log(`\n📧 Gmail gagal: ${e.message}`);

    // Fallback ke Telegram (nomor pribadi lo)
    try {
      const tgResult = await tgClient.kirimKeSelf(`🔐 OTP untuk ${email}: ${kode}`);
      if (tgResult.ok) {
        console.log(`✅ OTP dikirim via Telegram personal`);
        return { ok: true, viaTelegram: true };
      }
    } catch (tgErr) {
      console.log(`⚠️ Telegram juga gagal: ${tgErr.message}`);
    }

    // Fallback ke Telegram
    const tg = await tgOtp.kirimOTPTelegram(email, kode);
    if (tg.ok) {
      console.log(`✅ OTP dikirim via Telegram ke admin`);
      return { ok: true, viaTelegram: true };
    }

    // Fallback terakhir: DEV mode
    console.log(`\n📧 Fallback DEV — Kode: ${kode}\n`);
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
