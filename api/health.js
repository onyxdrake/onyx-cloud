const express = require('express');
const router = express.Router();

// Health check — bisa diakses publik
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: Date.now(),
    node: process.version
  });
});

// Version info
router.get('/version', (req, res) => {
  res.json({
    name: 'Onyx Cloud',
    version: '1.0.0',
    tagline: "The AI that doesn't just answer — it executes.",
    repo: 'https://github.com/onyxdrake/onyx-cloud',
    contact: 'onyxdrake.ai@gmail.com',
    license: 'MIT'
  });
});

// Security posture
router.get('/security', (req, res) => {
  res.json({
    ok: true,
    tls: true,
    hsts: true,
    csp: true,
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    passwordHash: 'PBKDF2-SHA512-100k',
    rateLimit: '30 req/min',
    docs: '/trust.html'
  });
});

module.exports = router;
