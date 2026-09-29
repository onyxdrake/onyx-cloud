const express = require('express');
const router = express.Router();
const intent = require('../core/intent');

router.post('/search', async (req, res) => {
  const { query, scope = 'web', userId } = req.body;
  if (!query) return res.json({ error: 'Query required' });

  const cek = intent.cekNiat(query);
  if (!cek.ok) return res.json({ error: cek.error, blocked: true });

  const results = [];

  if (scope === 'web' || scope === 'both') {
    try {
      const res2 = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
      const data = await res2.json();
      if (data.AbstractText) {
        results.push({ source: 'web', text: data.AbstractText });
      }
      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        for (const topic of data.RelatedTopics.slice(0, 3)) {
          if (topic.Text) results.push({ source: 'web', text: topic.Text });
        }
      }
    } catch (e) {
      console.error('[Search] Web error:', e.message);
    }
  }

  if (scope === 'dark' || scope === 'both') {
    results.push({ source: 'dark', text: '[Dark web search requires Tor MCP setup]' });
  }

  res.json({ results, query, scope });
});

module.exports = router;
