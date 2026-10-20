// tools/builtin/discover-api.js
// Tool buat nyari API publik secara dinamis

module.exports = {
  name: 'discover_api',
  description: 'Cari API publik dari Public APIs registry (github.com/public-apis). Args: { query: "kategori atau keyword", limit: 5 }',
  async run(args) {
    const q = (args.query || '').toLowerCase();
    const limit = Math.min(parseInt(args.limit) || 5, 20);

    try {
      // Ambil registry Public APIs
      const res = await fetch('https://raw.githubusercontent.com/public-apis/public-apis/master/README.md');
      const text = await res.text();
      const lines = text.split('\n');

      const results = [];
      for (const line of lines) {
        if (!line.startsWith('|')) continue;
        const parts = line.split('|').map(s => s.trim());
        if (parts.length < 6) continue;
        const [, name, desc, auth, https, cors] = parts;
        if (!name || name === 'API' || name.startsWith('---')) continue;
        if (q && !(name.toLowerCase().includes(q) || desc.toLowerCase().includes(q))) continue;

        results.push({
          name,
          description: desc,
          auth: auth || 'No',
          https: https || 'No',
          cors: cors || 'Unknown'
        });
        if (results.length >= limit) break;
      }

      if (results.length === 0) {
        return `Gak ada API yang cocok sama "${q}". Coba keyword lain.`;
      }

      let out = `📡 Ditemukan ${results.length} API untuk "${q}":\n\n`;
      for (const r of results) {
        out += `**${r.name}**\n`;
        out += `- ${r.description}\n`;
        out += `- Auth: ${r.auth} | HTTPS: ${r.https} | CORS: ${r.cors}\n\n`;
      }
      return out;
    } catch (e) {
      return `Error discover_api: ${e.message}`;
    }
  }
};
