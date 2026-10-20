const express = require('express');
const router = express.Router();
const imgQueue = require('../core/image-queue');

router.post('/image/generate', async (req, res) => {
  const { prompt, width = 512, height = 512 } = req.body;
  const email = req.apiUser;

  if (!prompt) return res.json({ error: 'Prompt wajib' });

  const limits = require('../core/limits');
  const sub = limits.cekSubscription(email);
  const tier = sub.tier || 'free';

  // Free tier: limit ketat + antri
  if (tier === 'free') {
    const queueSize = imgQueue.size();
    if (queueSize > 10) {
      const q = imgQueue.enqueue(email, prompt, tier);
      return res.json({
        queued: true,
        position: q.position,
        total: q.total,
        estimated: `${q.position * 15} detik`,
        message: `Server gambar lagi rame. Posisi lo: ${q.position}. Upgrade ke Premium biar skip antrian.`
      });
    }
  }

  // Premium+ → langsung generate
  if (tier === 'premium' || tier === 'pro') {
    const seed = Date.now();
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;

    return res.json({
      ok: true,
      priority: 'high',
      prompt,
      width,
      height,
      url,
      seed,
      message: '⚡ Premium priority — no queue'
    });
  }

  // Basic → generate tapi kasih catatan
  const seed = Date.now();
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;

  res.json({
    ok: true,
    priority: 'normal',
    prompt,
    width,
    height,
    url,
    seed,
    message: '⏳ Basic tier — antri kalau server rame'
  });
});

// Cek posisi antrian
router.get('/image/queue', (req, res) => {
  const email = req.apiUser;
  const pos = imgQueue.position(email);
  const total = imgQueue.size();
  res.json({
    ok: true,
    inQueue: pos !== null,
    position: pos,
    total
  });
});

module.exports = router;
