const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const ENV_PATH = path.join(__dirname, '..', '.env');

// Daftar key yang boleh dilihat/diedit dari web (JANGAN expose SEED_PHRASE, PRIVATE_KEY)
const ALLOWED_KEYS = [
  'GROQ_API_KEY', 'CEREBRAS_API_KEY',
  'TELEGRAM_NOMOR',
  'GMAIL_USER', 'GMAIL_PASS',
  'USDC_MINT', 'SOLANA_RPC', 'SOLANA_RPC_PRIMARY', 'SOLANA_RPC_FALLBACK', 'SOLANA_RPC_TERTIARY',
  'WALLET_ADDRESS',
  'ADMIN_KEY', 'JWT_SECRET',
  'GITHUB_TOKEN', 'GITHUB_REPO',
  'CLOUDFLARE_URL',
  'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET',
  'NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET',
  'SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'
];

// Key yang DILARANG diedit dari web (private, sensitif)
const BLOCKED_KEYS = ['SEED_PHRASE', 'PRIVATE_KEY', 'NETLIFY_TOKEN'];

function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx === -1) continue;
    const k = t.slice(0, idx).trim();
    const v = t.slice(idx + 1).trim();
    out[k] = v;
  }
  return out;
}

function serializeEnv(obj) {
  // Baca file asli, ganti value-nya aja biar comment & urutan tetap
  const original = fs.readFileSync(ENV_PATH, 'utf8');
  const lines = original.split('\n');
  const handled = new Set();

  const out = lines.map(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    const idx = t.indexOf('=');
    if (idx === -1) return line;
    const k = t.slice(0, idx).trim();
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      handled.add(k);
      return `${k}=${obj[k]}`;
    }
    return line;
  });

  // Kalau ada key baru yang belum ada di file, tambahin di bawah
  for (const [k, v] of Object.entries(obj)) {
    if (!handled.has(k) && !BLOCKED_KEYS.includes(k)) {
      out.push(`${k}=${v}`);
    }
  }

  return out.join('\n');
}

// GET — baca .env (tanpa value key sensitif)
router.get('/env', (req, res) => {
  try {
    const text = fs.readFileSync(ENV_PATH, 'utf8');
    const parsed = parseEnv(text);

    const safe = {};
    for (const k of ALLOWED_KEYS) {
      if (BLOCKED_KEYS.includes(k)) continue;
      safe[k] = parsed[k] || '';
    }

    const blockedPresent = BLOCKED_KEYS.filter(k => parsed[k]);

    res.json({
      ok: true,
      values: safe,
      blockedKeys: blockedPresent,
      note: 'Key sensitif (SEED_PHRASE, PRIVATE_KEY) tidak ditampilkan. Edit manual via terminal.'
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST — tulis .env (cuma key yang di ALLOWED_KEYS & bukan BLOCKED_KEYS)
router.post('/env', (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ ok: false, error: 'Admin key salah' });
    }

    const updates = req.body.values || {};
    const current = parseEnv(fs.readFileSync(ENV_PATH, 'utf8'));
    const merged = { ...current };

    for (const [k, v] of Object.entries(updates)) {
      if (!ALLOWED_KEYS.includes(k)) continue;
      if (BLOCKED_KEYS.includes(k)) continue;
      merged[k] = String(v);
    }

    const newText = serializeEnv(merged);

    // Backup dulu
    fs.copyFileSync(ENV_PATH, ENV_PATH + '.bak-' + Date.now());

    fs.writeFileSync(ENV_PATH, newText);
    res.json({ ok: true, message: 'Saved. Restart server biar kepake.' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
