// core/login-notif.js
// Kirim email notif login baru

const nodemailer = require('nodemailer');

function formatWaktu(timestamp, timezone) {
  try {
    return new Date(timestamp).toLocaleString('id-ID', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timezone !== 'Unknown' ? timezone : 'Asia/Jakarta'
    });
  } catch {
    return new Date(timestamp).toLocaleString('id-ID');
  }
}

function buildEmailHtml(email, entry, baseUrl) {
  const waktu = formatWaktu(entry.time, entry.timezone);
  const revokeUrl = `${baseUrl}/api/auth/revoke?email=${encodeURIComponent(email)}&session=${entry.sessionId}`;
  const revokeAllUrl = `${baseUrl}/api/auth/revoke-all?email=${encodeURIComponent(email)}&session=${entry.sessionId}`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="500" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:32px 40px 20px;text-align:center;background:linear-gradient(135deg,#0a0a0a,#1a0a0a);">
            <div style="font-size:40px;margin-bottom:8px;">🔐</div>
            <div style="font-size:20px;font-weight:700;color:#ff4444;">Login Baru Terdeteksi</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px;">
            <p style="color:#e0e0e0;font-size:15px;margin:0 0 20px;">Ada login baru di akun Onyx lo:</p>

            <table width="100%" style="background:#111;border-radius:10px;padding:20px;margin-bottom:24px;">
              <tr><td style="padding:8px 0;color:#888;font-size:13px;">📍 Lokasi</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;">${entry.city}, ${entry.region}, ${entry.country}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:13px;">🕐 Waktu</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;">${waktu}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:13px;">💻 Device</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;">${entry.device}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:13px;">🌐 ISP</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;">${entry.isp}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:13px;">🔢 IP</td><td style="padding:8px 0;color:#fff;font-size:13px;text-align:right;">${entry.ip.slice(0, -3)}***</td></tr>
            </table>

            <div style="background:#3a1010;border-left:3px solid #ff4444;padding:12px;border-radius:6px;margin-bottom:24px;">
              <div style="color:#ff6666;font-size:13px;font-weight:600;margin-bottom:4px;">⚠️ Bukan lo?</div>
              <div style="color:#ccc;font-size:12px;line-height:1.6;">Klik tombol di bawah buat keluarin session ini. Password lo mungkin bocor — ganti segera.</div>
            </div>

            <div style="text-align:center;margin-bottom:12px;">
              <a href="${revokeUrl}" style="display:inline-block;background:#ff4444;color:#fff;padding:14px 32px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">
                🚪 Keluarkan Session Ini
              </a>
            </div>

            <div style="text-align:center;">
              <a href="${revokeAllUrl}" style="color:#888;font-size:12px;text-decoration:underline;">
                Atau keluarkan SEMUA session kecuali yang ini
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;text-align:center;border-top:1px solid #1f1f1f;">
            <div style="font-size:11px;color:#555;">Kalau ini memang lo, abaikan email ini. Gak perlu ngapa-ngapain.</div>
            <div style="font-size:10px;color:#333;margin-top:12px;">© 2026 Onyx Cloud</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function kirimNotifLogin(email, entry, baseUrl) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;
  if (!user || !pass) return { ok: false, error: 'Gmail gak dikonfig' };

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });

    await transporter.sendMail({
      from: `"Onyx Security" <${user}>`,
      to: email,
      subject: `🔐 Login baru di Onyx — ${entry.city}, ${entry.country}`,
      html: buildEmailHtml(email, entry, baseUrl)
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { kirimNotifLogin };
