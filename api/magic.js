const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const CODES_FILE = path.join(__dirname, '..', 'data', 'verify-codes.json');

router.get('/auth/magic', (req, res) => {
  const { token, email } = req.query;
  if (!token || !email) return res.status(400).send('Token & email wajib');

  try {
    const codes = JSON.parse(fs.readFileSync(CODES_FILE, 'utf8'));
    const entry = codes[email];

    if (!entry) return res.status(404).send('Email gak terdaftar');
    if (Date.now() > entry.exp) return res.status(410).send('Link kadaluarsa. Minta OTP baru.');
    if (entry.magicToken !== token) return res.status(403).send('Token salah');

    // Set session cookie
    const sessionToken = Buffer.from(JSON.stringify({
      email,
      provider: 'magic',
      loginAt: Date.now()
    })).toString('base64');

    res.setHeader('Set-Cookie',
      `onyx_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
    );

    // Mark verified
    entry.verified = true;
    entry.magicUsed = Date.now();
    fs.writeFileSync(CODES_FILE, JSON.stringify(codes, null, 2));

    res.send(`
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Login Sukses</title>
      <style>body{background:#0a0a0a;color:#0f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}
      .box{max-width:400px;padding:24px;} h1{margin-bottom:16px;} a{color:#0f0;}</style></head>
      <body><div class="box">
        <h1>✅ Login Sukses</h1>
        <p>Selamat datang di Onyx Cloud.</p>
        <p>Lo bakal di-redirect ke chat dalam 2 detik...</p>
        <script>setTimeout(() => window.location.href = '/onyx.html', 2000);</script>
      </div></body></html>
    `);
  } catch (e) {
    res.status(500).send('Error: ' + e.message);
  }
});

module.exports = router;
