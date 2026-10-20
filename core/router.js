require('dotenv').config();
const fs = require('fs');
const path = require('path');

const GROQ_KEY = process.env.GROQ_API_KEY;
const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY;
const SYSTEM_FILE = path.join(__dirname, '..', 'system.txt');

function getSystem() {
  try { return fs.readFileSync(SYSTEM_FILE, 'utf8'); }
  catch { return 'Kamu Onyx. Jawab pake Bahasa Indonesia.'; }
}

async function fetchWithTimeout(url, options, timeout = 60000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) { clearTimeout(id); throw e; }
}

async function localModel(messages, system) {
  try {
    const sys = system || getSystem();
    const res = await fetchWithTimeout('http://127.0.0.1:8080/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'onyx', messages: [{ role: 'system', content: sys }, ...messages], max_tokens: 1024, temperature: 0.7 })
    }, 90000);
    if (!res.ok) return null;
    const data = await res.json();
    const hasil = data.choices?.[0]?.message?.content;
    if (!hasil || hasil.trim().length < 2) return null;
    console.log('[Local] OK');
    return hasil;
  } catch (e) { console.log('[Local] Error:', e.message); return null; }
}

async function groq(messages, system, tools = null) {
  if (!GROQ_KEY || GROQ_KEY.includes('isi_')) { console.log('[Groq] No key'); return null; }
  const models = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
  for (const model of models) {
    try {
      const sys = system || getSystem();
      const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: sys }, ...messages],
          max_tokens: 4096,
          ...(tools ? { tools, tool_choice: 'auto' } : {})
        })
      }, 60000);
      const data = await res.json();
      if (data.error) {
        console.log(`[Groq/${model}] Error:`, data.error.message);

        // Rate limit → return special object
        if (data.error.message?.includes('rate limit') || data.error.message?.includes('429')) {
          return { error: 'RATE_LIMIT', provider: 'groq', model };
        }
        continue;
      }
      console.log(`[Groq/${model}] OK`);

      // Return content + usage
      const content = data.choices?.[0]?.message?.content || null;
      const usage = data.usage || {};
      if (content) {
        return { content, usage, provider: 'groq', model };
      }
      return null;
    } catch (e) { console.log(`[Groq/${model}] Error:`, e.message); }
  }
  return null;
}

async function cerebras(messages, system, tools = null) {
  if (!CEREBRAS_KEY || CEREBRAS_KEY.includes('isi_')) { console.log('[Cerebras] No key'); return null; }
  const models = ['gpt-oss-120b', 'qwen-3.8-27b'];
  for (const model of models) {
    try {
      const sys = system || getSystem();
      const res = await fetchWithTimeout('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CEREBRAS_KEY}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: sys }, ...messages],
          max_tokens: 4096,
          ...(tools ? { tools, tool_choice: 'auto' } : {})
        })
      }, 60000);
      const data = await res.json();
      if (data.error) { console.log(`[Cerebras/${model}] Error:`, data.error.message); continue; }
      console.log(`[Cerebras/${model}] OK`);

      const content = data.choices?.[0]?.message?.content || null;
      const usage = data.usage || {};
      if (content) {
        return { content, usage, provider: 'cerebras', model };
      }
      return null;
    } catch (e) { console.log(`[Cerebras/${model}] Error:`, e.message); }
  }
  return null;
}

// Deteksi tipe pertanyaan untuk smart routing
function klasifikasiPesan(messages) {
  const last = (messages[messages.length - 1]?.content || '').toLowerCase();
  const len = last.length;

  // Keyword coding
  const codingKw = ['kode', 'code', 'coding', 'fungsi', 'function', 'script', 'debug', 'error',
    'bug', 'compile', 'program', 'python', 'javascript', 'node', 'html', 'css', 'sql',
    'api', 'endpoint', 'class', 'variable', 'loop', 'array', 'object', 'git', 'bash',
    'regex', 'algoritma', 'algorithm', 'refactor', 'optimize'];

  // Keyword reasoning / analisis
  const reasoningKw = ['analisis', 'analyze', 'jelaskan', 'explain', 'bandingkan', 'compare',
    'kenapa', 'mengapa', 'why', 'bagaimana', 'how', 'strategi', 'strategy', 'trade-off',
    'kelebihan', 'kekurangan', 'pro', 'cons', 'evaluasi', 'evaluate', 'kesimpulan'];

  // Keyword research
  const researchKw = ['cari', 'search', 'research', 'berita', 'news', 'terbaru', 'latest',
    'siapa', 'who', 'kapan', 'when', 'dimana', 'where', 'harga', 'price', 'update'];

  const hasCoding = codingKw.some(k => last.includes(k));
  const hasReasoning = reasoningKw.some(k => last.includes(k));
  const hasResearch = researchKw.some(k => last.includes(k));

  if (hasCoding) return 'coding';
  if (hasReasoning) return 'reasoning';
  if (hasResearch) return 'research';
  if (len > 150) return 'reasoning'; // pertanyaan panjang = butuh mikir
  return 'chat'; // sisanya chat ringan
}

// Normalize return value — content + usage
function normalizeResult(r) {
  if (!r) return null;
  if (typeof r === 'string') return { content: r, usage: {}, provider: 'local', model: 'onyx' };
  return r; // udah object
}

async function tanya(messages, system, mode = 'auto', tools = null) {
  if (mode === 'groq') {
    const r = await groq(messages, system, tools);
    return normalizeResult(r) || { content: 'Sistem lagi sibuk, coba lagi.', usage: {}, provider: 'none' };
  }
  if (mode === 'cerebras') {
    const r = await cerebras(messages, system, tools);
    return normalizeResult(r) || { content: 'Sistem lagi sibuk, coba lagi.', usage: {}, provider: 'none' };
  }
  if (mode === 'local') {
    const r = await localModel(messages, system);
    return normalizeResult(r) || { content: 'Sistem lagi sibuk, coba lagi.', usage: {}, provider: 'none' };
  }

  const tipe = klasifikasiPesan(messages);
  console.log(`[Router] Tipe: ${tipe}`);

  if (tipe === 'chat') {
    const lokal = await localModel(messages, system);
    if (lokal && lokal.trim().length > 5) {
      return { content: lokal, usage: {}, provider: 'local', model: 'onyx' };
    }
    const g = await groq(messages, system, tools);
    if (g) return normalizeResult(g);
    const c = await cerebras(messages, system, tools);
    if (c) return normalizeResult(c);
  } else {
    const g = await groq(messages, system, tools);
    if (g) return normalizeResult(g);
    const c = await cerebras(messages, system, tools);
    if (c) return normalizeResult(c);
    const lokal = await localModel(messages, system);
    if (lokal) return { content: lokal, usage: {}, provider: 'local', model: 'onyx' };
  }

  return { content: 'Sistem lagi sibuk, coba lagi.', usage: {}, provider: 'none' };
}


// ===== OPENROUTER =====
async function openrouter(messages, system, tools = null) {
  const KEY = process.env.OPENROUTER_API_KEY;
  if (!KEY) return null;
  try {
    const sys = system || getSystem();
    const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`,
        'HTTP-Referer': 'https://onyx-cloud-mu.netlify.app',
        'X-Title': 'Onyx Cloud'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free', // Model gratis
        messages: [{ role: 'system', content: sys }, ...messages],
        max_tokens: 2048
      })
    }, 60000);
    const data = await res.json();
    if (data.error) { console.log('[OpenRouter] Error:', data.error.message); return null; }
    console.log('[OpenRouter] OK');
    const content = data.choices?.[0]?.message?.content;
    const usage = data.usage || {};
    if (content) return { content, usage, provider: 'openrouter', model: 'llama-3.1-8b:free' };
    return null;
  } catch (e) { console.log('[OpenRouter] Error:', e.message); return null; }
}

// ===== MISTRAL =====
async function mistral(messages, system, tools = null) {
  const KEY = process.env.MISTRAL_API_KEY;
  if (!KEY) return null;
  try {
    const sys = system || getSystem();
    const res = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'system', content: sys }, ...messages],
        max_tokens: 2048
      })
    }, 60000);
    const data = await res.json();
    if (data.error) { console.log('[Mistral] Error:', data.error.message); return null; }
    console.log('[Mistral] OK');
    const content = data.choices?.[0]?.message?.content;
    const usage = data.usage || {};
    if (content) return { content, usage, provider: 'mistral', model: 'mistral-small' };
    return null;
  } catch (e) { console.log('[Mistral] Error:', e.message); return null; }
}

// ===== GEMINI =====
async function gemini(messages, system, tools = null) {
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) return null;
  try {
    const sys = system || getSystem();
    // Format pesan buat Gemini
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sys }] },
        contents,
        generationConfig: { maxOutputTokens: 2048 }
      })
    }, 60000);
    const data = await res.json();
    if (data.error) { console.log('[Gemini] Error:', data.error.message); return null; }
    console.log('[Gemini] OK');
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const usage = {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0
    };
    if (content) return { content, usage, provider: 'gemini', model: 'gemini-1.5-flash' };
    return null;
  } catch (e) { console.log('[Gemini] Error:', e.message); return null; }
}

module.exports = { tanya, localModel, groq, cerebras, openrouter, mistral, gemini, klasifikasiPesan };
