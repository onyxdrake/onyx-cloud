const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LIMITS_FILE = path.join(__dirname, '..', 'data', 'limits.json');
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

// Limit REALISTIS — berdasarkan limit Groq/Cerebras
const TIERS = {
  // Free: cuma model lokal 0.5B (gak boros API)
  free:    { chat: 20,  coding: 3,  expert: 0,   python: 0,  image: 3,  search: 5,  eksekusi: false },
  
  // Basic: model lokal + sedikit Groq
  basic:   { chat: 50,  coding: 10, expert: 5,   python: 0,  image: 10, search: 20, eksekusi: false },
  
  // Premium: Groq lebih banyak
  premium: { chat: 100, coding: 30, expert: 20,  python: 5,  image: 30, search: 50, eksekusi: false },
  
  // Pro: semua fitur + eksekusi
  pro:     { chat: 200, coding: 50, expert: 50,  python: 20, image: 50, search: 100, eksekusi: true, ram: 1, storage: 5 },
  
  admin:   { chat: 9999, coding: 9999, expert: 9999, python: 9999, image: 9999, search: 9999, eksekusi: true, ram: 4, storage: 20 }
};

function loadJson(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return def; }
}
function saveJson(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
function getUserId(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  return crypto.createHash('md5').update(ip + ua).digest('hex').slice(0, 16);
}
function getUserTier(userId) {
  const users = loadJson(USERS_FILE, {});
  return users[userId]?.tier || 'free';
}
function setUserTier(userId, tier) {
  const users = loadJson(USERS_FILE, {});
  users[userId] = { tier, updated: Date.now() };
  saveJson(USERS_FILE, users);
}
function getLimit(tier, tipe) {
  const t = TIERS[tier] || TIERS.free;
  return t[tipe];
}
function getUsage(userId) {
  const limits = loadJson(LIMITS_FILE, {});
  const today = new Date().toISOString().slice(0, 10);
  if (!limits[userId] || limits[userId].date !== today) {
    limits[userId] = { date: today, chat: 0, coding: 0, expert: 0, python: 0, image: 0, search: 0 };
    saveJson(LIMITS_FILE, limits);
  }
  return limits[userId];
}
function increment(userId, tipe) {
  const limits = loadJson(LIMITS_FILE, {});
  const today = new Date().toISOString().slice(0, 10);
  if (!limits[userId] || limits[userId].date !== today) {
    limits[userId] = { date: today, chat: 0, coding: 0, expert: 0, python: 0, image: 0, search: 0 };
  }
  limits[userId][tipe] = (limits[userId][tipe] || 0) + 1;
  saveJson(LIMITS_FILE, limits);
  return limits[userId][tipe];
}
function cekLimit(req, tipe) {
  const userId = getUserId(req);
  const tier = getUserTier(userId);
  const limit = getLimit(tier, tipe);
  const usage = getUsage(userId);
  const used = usage[tipe] || 0;
  if (limit === 0) {
    return { ok: false, userId, tier, tipe, limit: 0, used: 0, sisa: 0,
      pesan: `Fitur ${tipe} gak tersedia di tier ${tier}. Upgrade ke Pro.` };
  }
  if (used >= limit) {
    return { ok: false, userId, tier, tipe, limit, used, sisa: 0,
      pesan: `Limit ${tipe} harian habis (${used}/${limit}). Upgrade buat limit lebih gede.` };
  }
  return { ok: true, userId, tier, tipe, limit, used, sisa: limit - used };
}
function getStatus(req) {
  const userId = getUserId(req);
  const tier = getUserTier(userId);
  const usage = getUsage(userId);
  const limits = TIERS[tier] || TIERS.free;
  return { userId, tier, usage, limits };
}

module.exports = { cekLimit, increment, getUserId, getUserTier, setUserTier, getStatus, TIERS };
