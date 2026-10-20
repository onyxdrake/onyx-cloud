const express = require('express');
const auth = require('../core/auth');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const CHATS_DIR = path.join(__dirname, '..', 'data', 'chats');

// Hapus akun (user harus login)
router.delete('/account', async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const decoded = auth.verifikasiToken(token);
  if (!decoded) return res.status(401).json({ error: 'Login dulu' });

  const user = auth.getUserByEmail(decoded.email);
  if (!user) return res.json({ error: 'User gak ada' });

  // Hapus chat user
  try {
    const files = fs.readdirSync(CHATS_DIR);
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(CHATS_DIR, f), 'utf8'));
      if (data.userId === user.userId) fs.unlinkSync(path.join(CHATS_DIR, f));
    }
  } catch {}

  auth.deleteUser(decoded.email);
  res.json({ ok: true });
});

// Ban user (admin only)
router.post('/account/ban', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Akses ditolak' });

  const { email, alasan } = req.body;
  res.json(auth.banUser(email, alasan || 'Pelanggaran TOS'));
});

module.exports = router;
