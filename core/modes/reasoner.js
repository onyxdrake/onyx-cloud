const { tanya } = require('../router');
const { getToolList, runTool } = require('../../tools/registry');

const SYSTEM = `Kamu ONYX — THE REASONER.

Kamu dikenal karena penalaran mendalam. Cara kamu mikir:

1. **URAIKAN** — Apa yang user tanya? Apa konteksnya?
2. **HIPOTESIS** — Apa jawaban sementara? Apa asumsinya?
3. **UJI** — Apa buktinya? Apa yang bisa salah?
4. **KONTRADIKSI** — Apa yang bertentangan? Kenapa?
5. **SINTESIS** — Gabungin semua. Apa kesimpulan?
6. **KRITIK DIRI** — Apa yang masih lemah? Apa yang perlu dicek?

Jawab pake Bahasa Indonesia.
Pakai tool kalau butuh data.

ALAT:
`;

async function reasonerLoop(pesan) {
  const system = SYSTEM + getToolList();
  let history = [{ role: 'user', content: pesan }];
  
  // Fase 1: Thinking
  const thinking = await tanya(
    [{ role: 'user', content: `Berpikir dulu: "${pesan}". Uraikan premis, hipotesis, dan apa yang perlu dicek.` }],
    system
  );
  history.push({ role: 'assistant', content: `[THINKING] ${thinking}` });

  // Fase 2: Tool use
  for (let i = 0; i < 5; i++) {
    const output = await tanya(history, system);
    const matches = [...output.matchAll(/<tool_call>(.*?)<\/tool_call>/gs)].slice(0, 2);
    if (matches.length === 0) {
      history.push({ role: 'assistant', content: output });
      break;
    }
    for (const m of matches) {
      try {
        const call = JSON.parse(m[1]);
        const result = await runTool(call.name, call.arguments || {});
        history.push({ role: 'assistant', content: output });
        history.push({ role: 'user', content: `Tool result (${call.name}): ${result}` });
      } catch (e) {
        history.push({ role: 'user', content: `Tool error: ${e.message}` });
      }
    }
  }

  // Fase 3: Self-critique
  const kritik = await tanya(
    [...history, { role: 'user', content: 'Kritik jawaban lo sendiri. Apa yang masih lemah? Apa yang perlu ditambah?' }],
    system
  );

  // Fase 4: Final
  const final = await tanya(
    [...history, { role: 'user', content: `Kritik: ${kritik}\n\nSekarang kasih jawaban final yang udah diperbaiki.` }],
    system
  );

  return final;
}

module.exports = { reasonerLoop };
