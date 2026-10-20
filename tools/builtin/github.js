module.exports = {
  name: 'github',
  description: 'Cari repo di GitHub.',
  params: { query: 'string' },
  run: async ({ query }) => {
    const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=3`, {
      headers: { 'User-Agent': 'onyx' }
    });
    const data = await res.json();
    return data.items?.map(r => `${r.full_name}: ${r.description}`).join('\n') || 'Gak nemu.';
  }
};
