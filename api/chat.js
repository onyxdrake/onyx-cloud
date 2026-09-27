const express = require('express');
const { agentLoop } = require('../core/agent');
const memory = require('../core/memory');
const limits = require('../core/limits');
const { deteksiBahasa } = require('../core/i18n');
const router = express.Router();

router.post('/chat', async (req, res) => {
  const { pesan, chatId, mode = 'chat', userId, bahasa: userBahasa, personality = 'formal' } = req.body;
  if (!pesan) return res.json({ balasan: 'Empty message.' });
  if (!userId) return res.json({ balasan: 'Please login first.', needLogin: true });

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const bahasa = userBahasa || deteksiBahasa(ip);
  console.log(`[Chat] IP: ${ip} | Lang: ${bahasa} | Personality: ${personality}`);

  const tipe = (mode === 'expert') ? 'expert' : (mode === 'coder' ? 'coding' : 'chat');
  const cek = limits.cekLimit(req, tipe);
  if (!cek.ok) return res.json({ balasan: `⚠️ ${cek.pesan}`, limit: true });

  try {
    let chat = chatId ? memory.getChat(chatId) : null;
    if (!chat) chat = memory.newChat(pesan.slice(0, 30), userId);
    chat.messages.push({ role: 'user', content: pesan, ts: Date.now() });
    memory.simpanEmbedding(pesan).catch(() => {});

    const balasan = await agentLoop(pesan, mode, bahasa, personality);
    chat.messages.push({ role: 'ai', content: balasan, ts: Date.now() });
    memory.saveChat(chat.id, chat);
    limits.increment(cek.userId, tipe);

    res.json({ balasan, chatId: chat.id, mode, bahasa, personality, limit: { tier: cek.tier, sisa: cek.sisa - 1 } });
  } catch (e) {
    res.json({ balasan: 'Error: ' + e.message });
  }
});

module.exports = router;
