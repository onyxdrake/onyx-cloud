const { tanya } = require('../router');
const { getToolList, runTool } = require('../../tools/registry');
const { exec } = require('child_process');

const SYSTEM = `Kamu ONYX — THE CODER.

Kamu dikenal karena jago coding. Cara kerja:

1. **PAHAMI** — Apa yang user mau? Bahasa apa? Framework apa?
2. **RENCANA** — Struktur kode kayak apa?
3. **TULIS** — Tulis kode lengkap, jangan setengah-setengah.
4. **TEST** — Kalau bisa, jalanin kodenya.
5. **DEBUG** — Kalau error, baca error, benerin.
6. **JELASIN** — Kasih komentar di kode.

Jawab pake Bahasa Indonesia.
Pakai tool search/github kalau butuh referensi.

ALAT:
`;

async function coderLoop(pesan) {
  const system = SYSTEM + getToolList();
  let history = [{ role: 'user', content: pesan }];
  
  for (let i = 0; i < 7; i++) {
    const output = await tanya(history, system, 'groq');
    const matches = [...output.matchAll(/<tool_call>(.*?)<\/tool_call>/gs)].slice(0, 2);
    if (matches.length === 0) return output;
    for (const m of matches) {
      try {
        const call = JSON.parse(m[1]);
        let result;
        if (call.name === 'run_code') {
          result = await runCode(call.arguments.kode, call.arguments.bahasa || 'python');
        } else {
          result = await runTool(call.name, call.arguments || {});
        }
        history.push({ role: 'assistant', content: output });
        history.push({ role: 'user', content: `Tool result: ${result}` });
      } catch (e) {
        history.push({ role: 'user', content: `Tool error: ${e.message}` });
      }
    }
  }
  return 'Max iterasi.';
}

function runCode(kode, bahasa) {
  return new Promise((resolve) => {
    const cmd = bahasa === 'python' ? `python3 -c "${kode.replace(/"/g, '\\"')}"` : `node -e "${kode.replace(/"/g, '\\"')}"`;
    exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) resolve(`Error: ${stderr || err.message}`);
      else resolve(stdout || 'OK');
    });
  });
}

module.exports = { coderLoop };
