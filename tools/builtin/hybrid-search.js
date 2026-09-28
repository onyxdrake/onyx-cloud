module.exports = {
  name: 'hybrid_search',
  description: 'Search web + dark web (Tor). Multi-source, cross-check.',
  params: { query: 'string', scope: 'string' },
  run: async ({ query, scope = 'web' }) => {
    const results = [];
    
    // Web search (DuckDuckGo)
    if (scope === 'web' || scope === 'both') {
      try {
        const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
        const data = await res.json();
        if (data.AbstractText) {
          results.push({ source: 'web', text: data.AbstractText });
        }
      } catch (e) {}
    }
    
    // Dark web search (Tor MCP — kalo ada)
    if (scope === 'dark' || scope === 'both') {
      // Placeholder: panggil Tor MCP
      results.push({ source: 'dark', text: '[Dark web search requires Tor MCP]' });
    }
    
    return results.length > 0 
      ? results.map(r => `[${r.source}] ${r.text}`).join('\n\n')
      : 'No results found.';
  }
};
