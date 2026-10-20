const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LIMITS_FILE = path.join(__dirname, '..', 'data', 'limits.json');
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

// Limit REALISTIS — berdasarkan limit Groq/Cerebras
const TIERS = {
  // Free: cuma model lokal 0.5B (gak boros API)
  free:    { chat: 20,  coding: 3,  expert: 1,   python: 0,  image: 3,  search: 5,  eksekusi: false },
  
  // Basic: model lokal + sedikit Groq
  basic:   { chat: 50,  coding: 10, expert: 10,  python: 0,  image: 10, search: 20, eksekusi: false },
  
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
// Pake fungsi terpusat dari core/user-id.js
const { getUserId: getUserIdFromReq } = require('./user-id');
function getUserId(req) {
  return getUserIdFromReq(req);
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
      pesan: `Feature "${tipe}" not available in your tier (${tier}). Upgrade to Pro.` };
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


// ═══════════════════════════════════════════════════════════
// SUBSCRIPTION TIER + TOKEN QUOTA
// ═══════════════════════════════════════════════════════════

const SUBSCRIPTION_TIERS = {
  free:    { price: 0,   tokenQuota: 50_000,     dailyChat: 20,   dailyImage: 3,   queuePriority: 100, apiKeys: 0,  otpQuota: 0 },
  basic:   { price: 2.5, tokenQuota: 500_000,    dailyChat: 100,  dailyImage: 20,  queuePriority: 50,  apiKeys: 1,  otpQuota: 50 },
  premium: { price: 7,   tokenQuota: 2_000_000,  dailyChat: 500,  dailyImage: 100, queuePriority: 20,  apiKeys: 5,  otpQuota: 500 },
  pro:     { price: 25,  tokenQuota: 10_000_000, dailyChat: 2000, dailyImage: 500, queuePriority: 5,   apiKeys: 20, otpQuota: 5000 }
};

// Cek apakah user punya subscription aktif
function cekSubscription(email) {
  const users = loadJson(USERS_FILE, {});
  const user = users[email];
  if (!user) return { ok: false, tier: 'free' };

  const tier = user.tier || 'free';
  const expires = user.subscriptionExpires || 0;

  if (tier === 'free') return { ok: true, tier: 'free', quota: SUBSCRIPTION_TIERS.free.tokenQuota };
  if (Date.now() > expires) {
    return { ok: false, tier: 'free', expired: true, message: 'Subscription lo expired. Renew atau top-up.' };
  }

  return {
    ok: true,
    tier,
    expires,
    quota: SUBSCRIPTION_TIERS[tier]?.tokenQuota || 0,
    priority: SUBSCRIPTION_TIERS[tier]?.queuePriority || 100
  };
}

// Set subscription user (dari payment callback)
function setSubscription(email, tier, months = 1) {
  const users = loadJson(USERS_FILE, {});
  if (!users[email]) return { ok: false, error: 'User gak ada' };

  users[email].tier = tier;
  users[email].subscriptionStart = Date.now();
  users[email].subscriptionExpires = Date.now() + (months * 30 * 24 * 60 * 60 * 1000);
  saveJson(USERS_FILE, users);

  return { ok: true, tier, expires: users[email].subscriptionExpires };
}

module.exports = {
  SUBSCRIPTION_TIERS, cekSubscription, setSubscription, cekLimit, increment, getUserId, getUserTier, setUserTier, getStatus, TIERS };
