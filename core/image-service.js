// core/image-service.js
// Image generation — free tier (Pollinations) atau premium (custom)

const fs = require('fs');
const path = require('path');

const IMG_HISTORY = path.join(__dirname, '..', 'data', 'image-history.json');

// Rate limit per tier (gambar/hari)
const IMAGE_LIMITS = {
  'free': 3,
  'basic': 20,
  'premium': 100,
  'pro': 500
};

function loadHistory() {
  try { return JSON.parse(fs.readFileSync(IMG_HISTORY, 'utf8')); }
  catch { return {}; }
}

function saveHistory(data) {
  const dir = path.dirname(IMG_HISTORY);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(IMG_HISTORY, JSON.stringify(data, null, 2));
}

// Cek kuota gambar user per hari
function cekKuotaHarian(userId, tier = 'free') {
  const limit = IMAGE_LIMITS[tier] || 3;
  const history = loadHistory();
  const today = new Date().toISOString().split('T')[0];

  const userHistory = history[userId] || {};
  const todayCount = userHistory[today] || 0;

  return {
    ok: todayCount < limit,
    used: todayCount,
    limit,
    remaining: Math.max(0, limit - todayCount),
    resetAt: today + 'T23:59:59'
  };
}

// Catat penggunaan gambar
function catatPenggunaan(userId) {
  const history = loadHistory();
  const today = new Date().toISOString().split('T')[0];
  if (!history[userId]) history[userId] = {};
  history[userId][today] = (history[userId][today] || 0) + 1;

  // Cleanup history > 30 hari
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  for (const uid in history) {
    for (const date in history[uid]) {
      if (date < cutoff) delete history[uid][date];
    }
  }

  saveHistory(history);
}

// Generate URL gambar — pakai Pollinations (free) atau custom endpoint
function buildImageUrl(prompt, options = {}) {
  const {
    width = 512,
    height = 512,
    seed = Date.now(),
    model = 'flux',
    nologo = true,
    enhance = false,
    tier = 'free'
  } = options;

  // Premium tier: pakai endpoint premium (kalau API key ada)
  if ((tier === 'premium' || tier === 'pro') && process.env.POLLINATIONS_API_KEY) {
    const premiumBase = process.env.POLLINATIONS_PREMIUM_URL || 'https://premium.pollinations.ai/prompt/';
    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      seed: String(seed),
      model,
      nologo: String(nologo),
      key: process.env.POLLINATIONS_API_KEY
    });
    if (enhance) params.append('enhance', 'true');
    return `${premiumBase}${encodeURIComponent(prompt)}?${params.toString()}`;
  }

  // Default: Pollinations free
  const base = 'https://image.pollinations.ai/prompt/';
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    seed: String(seed),
    model,
    nologo: String(nologo)
  });
  if (enhance) params.append('enhance', 'true');

  return `${base}${encodeURIComponent(prompt)}?${params.toString()}`;
}

module.exports = {
  IMAGE_LIMITS,
  cekKuotaHarian,
  catatPenggunaan,
  buildImageUrl
};
