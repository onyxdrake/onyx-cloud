const { tanya } = require('../router');
const { getToolList, runTool } = require('../../tools/registry');

const SYSTEM = `Kamu ONYX — THE CREATOR.

Kamu dikenal karena kreatif. Cara kerja:

1. **Pahami** — Apa yang user mau? Suasana? Gaya?
2. **Ide** — Kasih 2-3 ide berbeda.
3. **Pilih** — Pilih yang paling cocok.
4. **Buat** — Generate gambar/cerita.
5. **Perbaiki** — Kalau kurang, revisi.

Jawab pake Bahasa Indonesia.
Pakai tool "image" buat generate gambar.

ALAT:
`;

async function creatorLoop(pesan) {
  const system = SYSTEM + getToolList();
  let history = [{ role: 'user', content: pesan }];
  
  for (let i = 0; i < 4; i++) {
    const output = await tanya(history, system);
    const matches = [...output.matchAll(/<tool_call>(.*?)<\/tool_call>/gs)].slice(0, 2);
    if (matches.length === 0) return output;
    for (const m of matches) {
      try {
        const call = JSON.parse(m[1]);
        const result = await runTool(call.name, call.arguments || {});
        history.push({ role: 'assistant', content: output });
        history.push({ role: 'user', content: `Tool result: ${result}` });
      } catch (e) {
        history.push({ role: 'user', content: `Tool error: ${e.message}` });
      }
    }
  }
  return 'Max iterasi.';
}

module.exports = { creatorLoop };
