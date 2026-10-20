// core/api-key.js
// API key system + domain restriction

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_FILE = path.join(__dirname, '..', 'data', 'api-keys.json');
const USER_ROOMS = path.join(__dirname, '..', 'data', 'user-rooms');

function loadKeys() {
  try { return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveKeys(data) {
  const dir = path.dirname(KEYS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
}

// Generate API key baru buat user
function generateKey(email, domains = []) {
  const keys = loadKeys();
  const key = 'onyx_' + crypto.randomBytes(24).toString('hex');
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  if (!keys[email]) keys[email] = [];

  keys[email].push({
    keyHash,                    // simpen hash, bukan raw key
    keyPreview: key.slice(0, 12) + '...' + key.slice(-4),
    domains,                    // whitelist domain
    createdAt: Date.now(),
    lastUsed: null,
    active: true,
    usage: { requests: 0, tokens: 0 }
  });

  saveKeys(keys);

  // Bikin "kamar" user
  const room = path.join(USER_ROOMS, email.replace(/[^a-z0-9]/gi, '_'));
  if (!fs.existsSync(room)) fs.mkdirSync(room, { recursive: true });

  return { ok: true, key, preview: key.slice(0, 12) + '...' };
}

// Verifikasi API key + domain
function verifyKey(rawKey, requestDomain) {
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keys = loadKeys();

  for (const [email, userKeys] of Object.entries(keys)) {
    for (const k of userKeys) {
      if (k.keyHash === keyHash && k.active) {
        // Cek domain
        if (k.domains.length > 0) {
          const allowed = k.domains.some(d => {
            // Support wildcard: *.myapp.com
            if (d.startsWith('*.')) {
              const base = d.slice(2);
              return requestDomain.endsWith(base);
            }
            return requestDomain === d;
          });
          if (!allowed) {
            return { ok: false, error: 'Domain gak diizinkan: ' + requestDomain };
          }
        }

        // Update last used
        k.lastUsed = Date.now();
        k.usage.requests++;
        saveKeys(keys);

        return { ok: true, email, keyInfo: k };
      }
    }
  }
  return { ok: false, error: 'API key invalid' };
}

// Revoke key
function revokeKey(email, keyPreview) {
  const keys = loadKeys();
  if (!keys[email]) return { ok: false };
  for (const k of keys[email]) {
    if (k.keyPreview === keyPreview) {
      k.active = false;
      k.revokedAt = Date.now();
    }
  }
  saveKeys(keys);
  return { ok: true };
}

// List key user
function listKeys(email) {
  const keys = loadKeys();
  return keys[email] || [];
}

module.exports = { generateKey, verifyKey, revokeKey, listKeys };
