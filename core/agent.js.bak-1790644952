const { tanya } = require('./router');
const { getToolList, runTool } = require('../tools/registry');
const { getSystemPrompt } = require('./i18n');

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

async function agentLoop(pesan, mode = 'chat', bahasa = 'EN', personality = 'formal', reasoning = 'medium') {
  // Deteksi gambar
  if (deteksiGambar(pesan)) {
    const prompt = ekstrakPrompt(pesan);
    const seed = Date.now();
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', high quality, detailed')}?width=512&height=512&nologo=true&seed=${seed}`;
    const teks = personality === 'formal'
      ? `Here is your image: "${prompt}"`
      : `🎨 Here's your image: "${prompt}"`;
    return `${teks}\n\n[IMAGE]${url}[/IMAGE]\n\n— Onyx`;
  }

  // System prompt sesuai bahasa + personality + reasoning
  const system = getSystemPrompt(bahasa, personality, reasoning) + getToolList();
  let history = [{ role: 'user', content: pesan }];

  for (let i = 0; i < 6; i++) {
    const output = await tanya(history, system, mode);
    if (!output) return 'Model not responding.';
    const matches = [...output.matchAll(/<tool_call>(.*?)<\/tool_call>/gs)].slice(0, 2);
    if (matches.length === 0) return output;
    for (const m of matches) {
      try {
        const call = JSON.parse(m[1]);
        const result = await runTool(call.name, call.arguments || {});
        history.push({ role: 'assistant', content: output });
        history.push({ role: 'user', content: `Tool result (${call.name}): ${result}` });
      } catch (e) {
        history.push({ role: 'user', content: `Error: ${e.message}` });
      }
    }
  }
  return 'Max iterations.';
}

module.exports = { agentLoop };
