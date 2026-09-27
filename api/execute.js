const express = require('express');
const { kirimTugas, listNodes } = require('../bot/onyx-server');
const limits = require('../core/limits');
const router = express.Router();

// User minta jalanin kode
router.post('/execute', async (req, res) => {
  const { kode, bahasa = 'python' } = req.body;
  if (!kode) return res.json({ error: 'Kode kosong' });

  const cek = limits.cekLimit(req, 'python');
  if (!cek.ok) return res.json({ error: cek.pesan, limit: true });

  try {
    const hasil = await kirimTugas(cek.userId, kode, bahasa, 30000);
    limits.increment(cek.userId, 'python');
    res.json({ ok: true, hasil });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// List node online
router.get('/nodes', (req, res) => {
  res.json(listNodes());
});

module.exports = router;
