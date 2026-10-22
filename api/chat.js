const express = require('express');
const { agentLoop } = require('../core/agent');
const memory = require('../core/memory');
const limits = require('../core/limits');
const { deteksiBahasa } = require('../core/i18n');
const { hooks } = require('../core/hooks');
const router = express.Router();

router.post('/chat', async (req, res) => {
  const { pesan, chatId, mode = 'chat', userId, bahasa: userBahasa, personality = 'formal', reasoning = 'medium', systemPrompt } = req.body;
  if (!pesan) return res.json({ balasan: 'Empty message.' });
  if (!userId) return res.json({ balasan: 'Please login first.', needLogin: true });

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const bahasa = userBahasa || deteksiBahasa(ip);
  console.log(`[Chat] IP: ${ip} | Lang: ${bahasa} | Personality: ${personality} | Reasoning: ${reasoning}`);

  // Hook: onUserMessage
  const hookResult = await hooks.onUserMessage(pesan, userId);
  if (hookResult.block) {
    return res.json({ balasan: `⚠️ ${hookResult.error}`, blocked: true });
  }

  const tipe = (mode === 'expert') ? 'expert' : (mode === 'coder' ? 'coding' : 'chat');
  const cek = limits.cekLimit(req, tipe);
  if (!cek.ok) return res.json({ balasan: `⚠️ ${cek.pesan}`, limit: true });

  // Cek subscription
  const sub = limits.cekSubscription(userId);
  const tier = sub.tier || 'free';
  const priority = limits.SUBSCRIPTION_TIERS[tier]?.queuePriority || 100;

  // Kalau free tier, cek queue
  if (tier === 'free') {
    const queueSize = require('../core/queue').size();
    if (queueSize > 0) {
      const qid = require('../core/queue').enqueue(userId, userId, tier, priority);
      const pos = require('../core/queue').position(userId);
      return res.json({
        balasan: `⏳ Server lagi sibuk (${queueSize} orang dalam antrian). Posisi lo: ${pos}. Tunggu ya...`,
        queued: true,
        queueId: qid,
        position: pos,
        estimated: `${pos * 3} detik`
      });
    }
  }

  try {
    let chat = chatId ? memory.getChat(chatId) : null;
    if (!chat) chat = memory.newChat(pesan.slice(0, 30), userId);
    chat.messages.push({ role: 'user', content: pesan, ts: Date.now() });

    // Ambil history chat dari memori (max 20 pesan terakhir)
    const historyLimit = 20;
    const historyChat = (chat.messages || []).slice(-historyLimit).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    const result = await agentLoop(pesan, mode, bahasa, personality, reasoning, historyChat, systemPrompt);
    const balasan = typeof result === 'string' ? result : result.content;
    const usage = typeof result === 'string' ? {} : (result.usage || {});

    // Catat token usage ke user (buat billing)
    if (userId && usage.total_tokens) {
      try {
        const { catatUsage } = require('../core/billing');
        catatUsage(userId, usage, result.provider);
      } catch (e) {}
    }

    chat.messages.push({ role: 'ai', content: balasan, ts: Date.now() });
    memory.saveChat(chat.id, chat);
    limits.increment(cek.userId, tipe);

    // Hook: onAIResponse
    await hooks.onAIResponse(balasan, userId);

    res.json({ balasan, chatId: chat.id, mode, bahasa, personality, reasoning, limit: { tier: cek.tier, sisa: cek.sisa - 1 } });
  } catch (e) {
    await hooks.onError(e, { userId, pesan });
    res.json({ balasan: 'Error: ' + e.message });
  }
});

module.exports = router;
