const express = require('express');
const verify = require('../core/verify');
const router = express.Router();

// Kirim kode
router.post('/verify/send', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.json({ error: 'Email salah' });
  const hasil = await verify.kirimKode(email);
  res.json(hasil);
});

// Cek kode
router.post('/verify/check', (req, res) => {
  const { email, kode } = req.body;
  if (!email || !kode) return res.json({ error: 'Email & kode wajib' });
  res.json(verify.cekKode(email, kode));
});

module.exports = router;
