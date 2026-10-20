const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, '..', 'version.json');

function getVersion() {
  try { return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')); }
  catch { return { version: '1.0.0', build: Date.now() }; }
}

// Ping: cek server hidup
router.get('/ping', (req, res) => {
  res.json({ ok: true, ts: Date.now(), version: getVersion().version });
});

// Version: buat auto-update
router.get('/version', (req, res) => {
  res.json(getVersion());
});

// Health: cek llama-server hidup
router.get('/health', async (req, res) => {
  try {
    const r = await fetch('http://127.0.0.1:8080/v1/models', { signal: AbortSignal.timeout(3000) });
    res.json({ ok: r.ok, llama: r.ok });
  } catch {
    res.json({ ok: false, llama: false });
  }
});

module.exports = router;
