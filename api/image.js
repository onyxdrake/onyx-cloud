const express = require('express');
const router = express.Router();
const imgService = require('../core/image-service');
const imgQueue = require('../core/image-queue');

router.post('/image/generate', async (req, res) => {
  const { prompt, width = 512, height = 512 } = req.body;
  const email = req.apiUser;

  if (!prompt) return res.json({ error: 'Prompt wajib' });

  const limits = require('../core/limits');
  const sub = limits.cekSubscription(email);
  const tier = sub.tier || 'free';

  // Cek kuota harian
  const kuota = imgService.cekKuotaHarian(email, tier);
  if (!kuota.ok) {
    return res.json({
      error: `Kuota gambar habis (${kuota.limit}/hari). Reset jam ${kuota.resetAt}. Upgrade tier buat limit lebih besar.`,
      used: kuota.used,
      limit: kuota.limit,
      resetAt: kuota.resetAt
    });
  }

  // Free & Basic → masuk queue
  if (tier === 'free' || tier === 'basic') {
    const queueSize = imgQueue.size();
    if (queueSize > 5) {
      const q = imgQueue.enqueue(email, prompt, tier);
      return res.json({
        queued: true,
        position: q.position,
        total: q.total,
        estimated: `${q.position * 10} detik`,
        message: `Server gambar lagi rame. Posisi lo: ${q.position}/${q.total}. Upgrade Premium biar skip antrian.`,
        kuota: { used: kuota.used, limit: kuota.limit }
      });
    }
  }

  // Generate
  const url = imgService.buildImageUrl(prompt, { width, height, tier });

  // Catat penggunaan
  imgService.catatPenggunaan(email);

  res.json({
    ok: true,
    priority: (tier === 'premium' || tier === 'pro') ? 'high' : 'normal',
    prompt,
    width,
    height,
    url,
    tier,
    kuota: {
      used: kuota.used + 1,
      limit: kuota.limit,
      remaining: kuota.remaining - 1
    },
    message: (tier === 'premium' || tier === 'pro')
      ? '⚡ Premium priority — no queue'
      : '⏳ Antri kalau server rame'
  });
});

// Cek kuota gambar
router.get('/image/quota', (req, res) => {
  const email = req.apiUser;
  const limits = require('../core/limits');
  const sub = limits.cekSubscription(email);
  const tier = sub.tier || 'free';

  const kuota = imgService.cekKuotaHarian(email, tier);
  res.json({ ok: true, tier, ...kuota });
});

module.exports = router;
