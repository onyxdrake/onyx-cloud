const express = require('express');
const { agentLoop } = require('../core/agent');
const memory = require('../core/memory');
const limits = require('../core/limits');
const { deteksiBahasa } = require('../core/i18n');
const router = express.Router();

router.post('/work', async (req, res) => {
  const { tujuan, userId } = req.body;
  if (!tujuan) return res.json({ balasan: 'Tujuan kosong.' });
  if (!userId) return res.json({ balasan: 'Login dulu.' });

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const bahasa = deteksiBahasa(ip);

  const cek = limits.cekLimit(req, 'expert');
  if (!cek.ok) return res.json({ balasan: `⚠️ ${cek.pesan}`, limit: true });

  try {
    let chat = memory.newChat(`🎯 ${tujuan.slice(0, 30)}`, userId);
    chat.messages.push({ role: 'user', content: `Tujuan: ${tujuan}`, ts: Date.now() });

    // Prompt khusus "Kerjakan"
    const promptKerja = `Tujuan user: "${tujuan}"

Kamu Onyx, AI yang MENGERJAKAN, bukan cuma menjawab.

Langkah:
1. Rencanakan (Planning)
2. Analisis kebutuhan
3. Panggil tools yang diperlukan
4. Eksekusi
5. Verifikasi hasil
6. Kasih output final

Format output:
📋 RENCANA:
- [langkah 1]
- [langkah 2]
...

⚙️ EKSEKUSI:
✅ [hasil 1]
✅ [hasil 2]
...

📊 HASIL:
[output final]

Tulis dalam Bahasa Indonesia.`;

    const balasan = await agentLoop(promptKerja, 'expert', bahasa);
    chat.messages.push({ role: 'ai', content: balasan, ts: Date.now() });
    memory.saveChat(chat.id, chat);
    limits.increment(cek.userId, 'expert');

    res.json({ balasan, chatId: chat.id, limit: { tier: cek.tier, sisa: cek.sisa - 1 } });
  } catch (e) {
    res.json({ balasan: 'Error: ' + e.message });
  }
});

module.exports = router;
