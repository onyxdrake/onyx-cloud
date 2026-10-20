// core/user-id.js
// SATU sumber kebenaran buat identifikasi user.
// Semua file lain WAJIB pake ini, bukan bikin sendiri.

const crypto = require('crypto');

// Generate user ID dari email (deterministik)
function userIdFromEmail(email) {
  if (!email) return null;
  return crypto.createHash('sha256')
    .update('onyx:' + email.toLowerCase().trim())
    .digest('hex')
    .slice(0, 16);
}

// Generate user ID dari IP+UA (fallback buat anonymous)
function userIdFromRequest(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  return crypto.createHash('sha256')
    .update('onyx:' + ip + ':' + ua)
    .digest('hex')
    .slice(0, 16);
}

// Ambil user ID dari request — prioritas: session > email > IP
function getUserId(req) {
  // 1. Cek dari session/JWT (kalau ada)
  if (req.user?.userId) return req.user.userId;
  if (req.headers['x-user-id']) return req.headers['x-user-id'];

  // 2. Cek dari query (buat testing)
  if (req.query?.userId) return req.query.userId;

  // 3. Fallback: dari IP+UA
  return userIdFromRequest(req);
}

module.exports = { userIdFromEmail, userIdFromRequest, getUserId };
