const express = require('express');
const router = express.Router();

router.get('/safety/check', async (req, res) => {
  const domain = req.query.domain;
  const key = process.env.VIRUSTOTAL_API_KEY;
  if (!domain || !key) return res.json({ ok: false, error: 'Domain atau API key kosong' });

  try {
    const r = await fetch(`https://www.virustotal.com/api/v3/domains/${domain}`, {
      headers: { 'x-apikey': key }
    });
    if (r.status === 404) {
      return res.json({ ok: true, status: 'unknown', message: 'Domain belum pernah dianalisis. Aman diabaikan.' });
    }
    const d = await r.json();
    const stats = d.data?.attributes?.last_analysis_stats || {};
    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;

    res.json({
      ok: true,
      malicious,
      suspicious,
      harmless: stats.harmless || 0,
      status: (malicious + suspicious) > 0 ? 'warning' : 'clean'
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

module.exports = router;
