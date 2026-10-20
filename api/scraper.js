const express = require('express');
const router = express.Router();
const scraper = require('../core/scraper');

router.post('/scrape', async (req, res) => {
  const { url, format = 'json' } = req.body;
  const email = req.apiUser;

  const limits = require('../core/limits');
  const sub = limits.cekSubscription(email);
  if (!sub.ok || sub.tier === 'free') {
    return res.json({ error: 'Fitur premium.' });
  }

  const result = await scraper.scrape(url);
  if (result.error) return res.json({ error: result.error });

  if (format === 'markdown') {
    let md = `# ${result.title}\n\n`;
    md += result.text + '\n\n';
    md += '## Links\n';
    for (const l of result.links.slice(0, 20)) md += `- ${l}\n`;
    return res.type('text/markdown').send(md);
  }

  res.json({ ok: true, ...result });
});

module.exports = router;
