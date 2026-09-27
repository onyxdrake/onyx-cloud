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
      body: JSON.stringify({ model: 'onyx', messages: [{ role: 'system', content: sys }, ...messages], max_tokens: 300, temperature: 0.7 })
    }, 90000);
    if (!res.ok) return null;
    const data = await res.json();
    const hasil = data.choices?.[0]?.message?.content;
    if (!hasil || hasil.trim().length < 2) return null;
    console.log('[Local] OK');
    return hasil;
  } catch (e) { console.log('[Local] Error:', e.message); return null; }
}

async function groq(messages, system) {
  if (!GROQ_KEY || GROQ_KEY.includes('isi_')) { console.log('[Groq] No key'); return null; }
  const models = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
  for (const model of models) {
    try {
      const sys = system || getSystem();
      const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: sys }, ...messages], max_tokens: 2048 })
      }, 60000);
      const data = await res.json();
      if (data.error) { console.log(`[Groq/${model}] Error:`, data.error.message); continue; }
      console.log(`[Groq/${model}] OK`);
      return data.choices?.[0]?.message?.content || null;
    } catch (e) { console.log(`[Groq/${model}] Error:`, e.message); }
  }
  return null;
}

async function cerebras(messages, system) {
  if (!CEREBRAS_KEY || CEREBRAS_KEY.includes('isi_')) { console.log('[Cerebras] No key'); return null; }
  const models = ['gpt-oss-120b', 'qwen-3.8-27b'];
  for (const model of models) {
    try {
      const sys = system || getSystem();
      const res = await fetchWithTimeout('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CEREBRAS_KEY}` },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: sys }, ...messages], max_tokens: 2048 })
      }, 60000);
      const data = await res.json();
      if (data.error) { console.log(`[Cerebras/${model}] Error:`, data.error.message); continue; }
      console.log(`[Cerebras/${model}] OK`);
      return data.choices?.[0]?.message?.content || null;
    } catch (e) { console.log(`[Cerebras/${model}] Error:`, e.message); }
  }
  return null;
}

async function tanya(messages, system, mode = 'auto') {
  if (mode === 'groq') return await groq(messages, system) || 'Groq gagal.';
  if (mode === 'cerebras') return await cerebras(messages, system) || 'Cerebras gagal.';
  const lokal = await localModel(messages, system);
  if (lokal) return lokal;
  const g = await groq(messages, system);
  if (g) return g;
  const c = await cerebras(messages, system);
  if (c) return c;
  return '⚠️ Semua model gagal.';
}

module.exports = { tanya, localModel, groq, cerebras };
