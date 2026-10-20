// core/login-tracker.js
// Track login user + kirim notif email

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOGIN_FILE = path.join(__dirname, '..', 'data', 'login-history.json');

function loadHistory() {
  try { return JSON.parse(fs.readFileSync(LOGIN_FILE, 'utf8')); }
  catch { return {}; }
}

function saveHistory(data) {
  const dir = path.dirname(LOGIN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOGIN_FILE, JSON.stringify(data, null, 2));
}

async function geoLookup(ip) {
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,regionName,isp,timezone,query`, {
      signal: AbortSignal.timeout(5000)
    });
    const d = await r.json();
    if (d.status === 'success') return d;
  } catch {}
  return null;
}

function parseDevice(ua) {
  if (!ua) return 'Unknown';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/windows/i.test(ua)) return 'Windows';
  if (/macintosh|mac os/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

async function trackLogin(email, ip, userAgent) {
  const history = loadHistory();
  if (!history[email]) history[email] = [];

  const sessionId = crypto.randomBytes(16).toString('hex');
  const geo = await geoLookup(ip);
  const device = parseDevice(userAgent);

  const entry = {
    sessionId,
    ip,
    city: geo?.city || 'Unknown',
    region: geo?.regionName || 'Unknown',
    country: geo?.country || 'Unknown',
    isp: geo?.isp || 'Unknown',
    timezone: geo?.timezone || 'Unknown',
    device,
    userAgent: (userAgent || '').slice(0, 200),
    time: Date.now(),
    active: true
  };

  history[email].push(entry);
  // Simpen max 20 login terakhir per user
  if (history[email].length > 20) history[email] = history[email].slice(-20);
  saveHistory(history);

  return entry;
}

function getUserSessions(email) {
  const history = loadHistory();
  return (history[email] || []).filter(s => s.active);
}

function revokeSession(email, sessionId) {
  const history = loadHistory();
  if (!history[email]) return false;
  const s = history[email].find(x => x.sessionId === sessionId);
  if (!s) return false;
  s.active = false;
  s.revokedAt = Date.now();
  saveHistory(history);
  return true;
}

function revokeAllExcept(email, keepSessionId) {
  const history = loadHistory();
  if (!history[email]) return 0;
  let count = 0;
  for (const s of history[email]) {
    if (s.active && s.sessionId !== keepSessionId) {
      s.active = false;
      s.revokedAt = Date.now();
      count++;
    }
  }
  saveHistory(history);
  return count;
}

module.exports = {
  trackLogin,
  getUserSessions,
  revokeSession,
  revokeAllExcept,
  geoLookup,
  parseDevice
};
