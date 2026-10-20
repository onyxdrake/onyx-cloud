const { tanya } = require('./router');
const { getToolList, runTool, getAll } = require('../tools/registry');

// Bikin tools dalam format Groq
function getGroqTools() {
  const all = getAll();
  return Object.entries(all).map(([name, def]) => ({
    type: 'function',
    function: {
      name,
      description: def.description || name,
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Query atau parameter' },
          args: { type: 'object', description: 'Arguments' }
        },
        required: []
      }
    }
  }));
}
const { getSystemPrompt, deteksiBahasaPesan } = require('./i18n');

function deteksiGambar(pesan) {
  const keywords = [
    'buat gambar', 'bikin gambar', 'generate gambar', 'gambarkan', 'lukis', 'desain', 'ilustrasi', 'wallpaper', 'poster',
    'create image', 'generate image', 'draw', 'design', 'illustration', 'wallpaper', 'poster', 'make image'
  ];
  const lower = pesan.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

function ekstrakPrompt(pesan) {
  let p = pesan.toLowerCase();
  const keywords = [
    'buat gambar', 'bikin gambar', 'generate gambar', 'gambarkan', 'buatkan gambar', 'gambar ', 'lukis', 'desain ', 'ilustrasi', 'wallpaper', 'poster',
    'create image', 'generate image', 'draw', 'design ', 'illustration', 'wallpaper', 'poster', 'make image'
  ];
  for (const k of keywords) p = p.replace(k, '');
  return p.trim() || pesan;
}

async function agentLoop(pesan, mode = 'chat', bahasa = 'EN', personality = 'formal', reasoning = 'medium', history = []) {
  // Deteksi gambar — comment dulu biar gak salah trigger
  // TODO: aktifin lagi kalau udah ada tool image proper
  if (false && deteksiGambar(pesan)) {
    const prompt = ekstrakPrompt(pesan);
    const seed = Date.now();
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', high quality, detailed')}?width=512&height=512&nologo=true&seed=${seed}`;
    const teks = personality === 'formal'
      ? `Here is your image: "${prompt}"`
      : `🎨 Here's your image: "${prompt}"`;
    return `${teks}\n\n[IMAGE]${url}[/IMAGE]\n\n— Onyx`;
  }

  // System prompt sesuai bahasa + personality + reasoning
  const bahasaDariPesan = deteksiBahasaPesan(pesan);
  const bahasaFinal = bahasaDariPesan || bahasa || 'EN';
  const system = getSystemPrompt(bahasaFinal, personality, reasoning) + getToolList();

  // History dari memori + pesan baru
  let chatHistory = [...(history || [])];
  chatHistory.push({ role: 'user', content: pesan });
  let historyMsg = chatHistory;

  let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let finalProvider = 'none';

  for (let i = 0; i < 6; i++) {
    console.log(`[Agent] History: ${historyMsg.length} pesan`);
    const result = await tanya(historyMsg, system, mode, getGroqTools());
    if (!result) return { content: 'Model not responding.', usage: totalUsage, provider: 'none' };

    // Handle dua format: string (dari localModel) atau object (dari groq/cerebras)
    const output = typeof result === 'string' ? result : (result.content || '');
    const usage = (typeof result === 'object' && result.usage) ? result.usage : {};
    if (result.provider) finalProvider = result.provider;

    // Akumulasi usage
    totalUsage.prompt_tokens += usage.prompt_tokens || 0;
    totalUsage.completion_tokens += usage.completion_tokens || 0;
    totalUsage.total_tokens += usage.total_tokens || 0;

    // Guard: pastiin output string
    const outputStr = String(output || '');
    const matches = [...outputStr.matchAll(/<tool_call>(.*?)<\/tool_call>/gs)].slice(0, 2);

    if (matches.length === 0) {
      return { content: outputStr, usage: totalUsage, provider: finalProvider };
    }

    for (const m of matches) {
      try {
        const call = JSON.parse(m[1]);
        const toolResult = await runTool(call.name, call.arguments || {});
        historyMsg.push({ role: 'assistant', content: outputStr });
        historyMsg.push({ role: 'user', content: `Tool result (${call.name}): ${toolResult}` });
      } catch (e) {
        historyMsg.push({ role: 'user', content: `Error: ${e.message}` });
      }
    }
  }
  return { content: 'Max iterations reached.', usage: totalUsage, provider: finalProvider };
}

module.exports = { agentLoop };
