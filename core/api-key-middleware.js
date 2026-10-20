// core/api-key-middleware.js
// Middleware buat verify API key di header

const apiKey = require('./api-key');

function middleware(req, res, next) {
  // Skip kalau bukan request API
  if (!req.path.startsWith('/v1/') && !req.path.startsWith('/api/premium/')) {
    return next();
  }

  const rawKey = req.headers['x-api-key'] || req.query.api_key;
  if (!rawKey) {
    return res.status(401).json({
      error: 'API key wajib. Kirim via header X-API-Key.',
      docs: '/docs/api-key.html'
    });
  }

  // Ambil domain dari Origin atau Referer
  const origin = req.headers['origin'] || req.headers['referer'] || '';
  let domain = '';
  try {
    domain = new URL(origin).hostname;
  } catch {}

  const result = apiKey.verifyKey(rawKey, domain);
  if (!result.ok) {
    return res.status(403).json({ error: result.error });
  }

  req.apiUser = result.email;
  req.apiKeyInfo = result.keyInfo;
  next();
}

module.exports = middleware;
