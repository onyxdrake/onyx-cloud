module.exports = {
  name: 'search',
  description: 'Cari informasi di internet lewat DuckDuckGo.',
  params: { query: 'string' },
  run: async ({ query }) => {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
    const data = await res.json();
    return data.AbstractText || data.RelatedTopics?.[0]?.Text || 'Gak nemu.';
  }
};
