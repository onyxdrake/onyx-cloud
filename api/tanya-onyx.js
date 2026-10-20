const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Load system prompt Onyx
const SYSTEM_FILE = path.join(__dirname, '..', 'system.txt');

function getSystemPrompt() {
  try {
    return fs.readFileSync(SYSTEM_FILE, 'utf8');
  } catch {
    return 'Kamu Onyx, AI dari Onyx Cloud.';
  }
}

router.post('/tanya-onyx', async (req, res) => {
  const { pertanyaan, userId } = req.body;
  if (!pertanyaan) return res.json({ error: 'Pertanyaan wajib' });

  // System prompt khusus bot Telegram
  const systemPrompt = `Kamu Onyx Bot Assistant — AI dari Onyx Cloud yang bantu user di Telegram.

KAMU HARUS TAU SEMUA SISTEM ONYX:
- Fitur: Chat AI, Image gen, OSINT, Scrape, Coding, API service
- Paket: Free ($0), Basic ($2.5), Premium ($7), Pro ($25)
- Pembayaran: USDC Solana
- Command bot: /status, /premium, /topup, /referral, /help, /checkin
- Website: https://compactly-propeller-livestock.ngrok-free.dev
- Discord: https://discord.gg/vbwY2VfHd
- Channel Telegram: https://t.me/Onyxdrak
- Email: onyxdrake.ai@gmail.com

ATURAN:
1. Jawab singkat (max 3 paragraf)
2. Ramah + helpful
3. Kalau gak tau, bilang "gue gak tau, hubungi admin"
4. Jangan sebut API key, token, atau info sensitif
5. Jangan sebut model AI (Groq, Cerebras, dll)

Pertanyaan user: ${pertanyaan}`;

  try {
    // Panggil Groq
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: pertanyaan }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (data.error) {
      return res.json({ ok: false, error: data.error.message });
    }

    const jawaban = data.choices?.[0]?.message?.content || 'Maaf, gak bisa jawab.';

    res.json({ ok: true, jawaban });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

module.exports = router;
