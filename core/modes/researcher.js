const { tanya } = require('../router');
const { getToolList, runTool } = require('../../tools/registry');

const SYSTEM = `Kamu Onyx mode RESEARCHER.
Jawab pake Bahasa Indonesia.

CARA:
1. Panggil tool search dulu.
2. Baca hasil.
3. Baru jawab.

WAJIB pakai tool search. Jangan ngarang.
Maksimal 2 tool per waktu.

FORMAT:
<tool_call>{"name":"search","arguments":{"query":"..."}}</tool_call>

ALAT:
`;

async function researcherLoop(pesan) {
  const system = SYSTEM + getToolList();
  let history = [{ role: 'user', content: pesan }];
  let hasil = [];

  for (let i = 0; i < 5; i++) {
    const output = await tanya(history, system, 'auto');
    if (!output) return 'Model gak jawab.';

    const matches = [...output.matchAll(/<tool_call>(.*?)<\/tool_call>/gs)].slice(0, 2);
    if (matches.length === 0) {
      let jawaban = output;
      if (hasil.length) jawaban += '\n\n📚 Sumber:\n' + hasil.join('\n');
      return jawaban;
    }

    for (const m of matches) {
      try {
        const call = JSON.parse(m[1]);
        const result = await runTool(call.name, call.arguments || {});
        hasil.push(`- ${call.name}: ${String(result).slice(0, 300)}`);
        history.push({ role: 'assistant', content: output });
        history.push({ role: 'user', content: `Hasil ${call.name}: ${result}` });
      } catch (e) {
        history.push({ role: 'user', content: `Error: ${e.message}` });
      }
    }
  }
  return 'Max iterasi.';
}

module.exports = { researcherLoop };
