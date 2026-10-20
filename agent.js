const fs = require('fs');

// Load system + tools
const SYSTEM = fs.readFileSync('./system.txt', 'utf8');
const TOOLS_JSON = JSON.parse(fs.readFileSync('./tools.json', 'utf8'));
const TOOL_LIST = TOOLS_JSON.tools.map(t => `- ${t.name}: ${t.description}`).join('\n');

// API keys dari .env
require('dotenv').config();
const GROQ_KEY = process.env.GROQ_API_KEY;
const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY;
const TELEGRAM_NOMOR = process.env.TELEGRAM_NOMOR;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

// ============ TOOLS ============
const TOOLS = {
  think: async ({ reasoning }) => reasoning,

  search: async ({ query }) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    return data.AbstractText || data.RelatedTopics?.[0]?.Text || 'Gak nemu.';
  },

  fetch: async ({ url }) => {
    const res = await fetch(url);
    return (await res.text()).slice(0, 2000);
  },

  github: async ({ query }) => {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=3`;
    const res = await fetch(url, { headers: { 'User-Agent': 'onyx' } });
    const data = await res.json();
    return data.items?.map(r => `${r.full_name}: ${r.description}`).join('\n') || 'Gak nemu.';
  },

  dread: async ({ query }) => {
    // Placeholder: nanti diintegrasi ke Tor MCP
    return `[Dread] Hasil untuk "${query}" — butuh setup Tor MCP.`;
  },

  torch: async ({ query }) => {
    // Placeholder: nanti diintegrasi ke Tor MCP
    return `[Torch] Hasil untuk "${query}" — butuh setup Tor MCP.`;
  },

  groq: async ({ prompt }) => {
    if (!GROQ_KEY) return 'Groq API key belum di-set.';
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'Groq gagal.';
  },

  cerebras: async ({ prompt }) => {
    if (!CEREBRAS_KEY) return 'Cerebras API key belum di-set.';
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CEREBRAS_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3.1-8b',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'Cerebras gagal.';
  },

  telegram: async ({ pesan }) => {
    // Placeholder: butuh Telegram API (bukan bot, tapi userbot)
    return `[Telegram] Pesan ke ${TELEGRAM_NOMOR}: "${pesan}" — butuh setup userbot.`;
  },

  gmail: async ({ to, subject, body }) => {
    // Placeholder: butuh nodemailer
    return `[Gmail] Email ke ${to}: "${subject}" — butuh setup nodemailer.`;
  }
};

// ============ MODEL ============
async function tanyaModel(prompt) {
  const fullSystem = SYSTEM + '\n\nALAT YANG TERSEDIA:\n' + TOOL_LIST + '\n\nPilih MAKSIMAL 2 alat per waktu.';
  const res = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'onyx',
      messages: [
        { role: 'system', content: fullSystem },
        { role: 'user', content: prompt }
      ],
      max_tokens: 256,
      temperature: 0.7
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============ LOOP ============
async function agentLoop(userInput, maxIter = 5) {
  let history = userInput;
  for (let i = 0; i < maxIter; i++) {
    const output = await tanyaModel(history);
    console.log(`[Iter ${i+1}]`, output.slice(0, 200));

    // Cari SEMUA tool_call, tapi batasi 2
    const matches = [...output.matchAll(/<tool_call>(.*?)<\/tool_call>/gs)].slice(0, 2);
    if (matches.length === 0) return output;

    for (const m of matches) {
      try {
        const call = JSON.parse(m[1]);
        const fn = TOOLS[call.name];
        if (!fn) {
          history += `\nTool error: ${call.name} gak ada`;
          continue;
        }
        const result = await fn(call.arguments);
        history += `\nTool result (${call.name}): ${result}`;
      } catch (e) {
        history += `\nTool error: ${e.message}`;
      }
    }
  }
  return 'Max iter.';
}

// ============ TEST ============
agentLoop('Cari game pardus di github').then(console.log);
