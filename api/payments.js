const express = require('express');
const auth = require('../core/auth');
const verify = require('../core/verify');
const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, kode } = req.body;
  if (!email || !password) return res.json({ ok: false, error: 'Email & password wajib' });
  if (!kode) return res.json({ ok: false, error: 'Kode verifikasi wajib', needVerify: true });
  if (!verify.sudahVerifikasi(email)) return res.json({ ok: false, error: 'Email belum diverifikasi', needVerify: true });

  const hasil = await auth.registerUser(email, password);
  if (hasil.ok) verify.hapusKode(email);
  res.json(hasil);
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ ok: false, error: 'Email & password wajib' });
  const hasil = await auth.loginUser(email, password);
  res.json(hasil);
});

router.get('/wallet', (req, res) => {
  res.json({
    address: process.env.WALLET_ADDRESS,
    mint: process.env.USDC_MINT,
    network: 'Solana Mainnet',
    memo_format: 'ONYX-<USER_ID>'
  });
});

router.get('/user/:userId', (req, res) => {
  const user = auth.getUserById(req.params.userId);
  if (!user) return res.json({ error: 'User gak ada' });
  res.json({ userId: user.userId, email: user.email, tier: user.tier });
});

module.exports = router;
