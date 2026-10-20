const express = require('express');
const router = express.Router();
const osint = require('../core/osint');

router.post('/osint/lookup', async (req, res) => {
  const { type, value } = req.body;
  const email = req.apiUser;

  // Cek subscription
  const limits = require('../core/limits');
  const sub = limits.cekSubscription(email);
  if (!sub.ok || sub.tier === 'free') {
    return res.json({ error: 'Fitur ini cuma buat premium user.' });
  }

  let result;
  if (type === 'phone') result = await osint.lookupPhone(value);
  else if (type === 'ip') result = await osint.lookupIP(value);
  else if (type === 'email') result = await osint.lookupEmail(value);
  else return res.json({ error: 'Type harus: phone, ip, atau email' });

  res.json({ ok: true, type, value, result });
});

module.exports = router;
