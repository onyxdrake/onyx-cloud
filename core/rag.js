const EMBED_URL = 'http://127.0.0.1:5001';

async function simpanEmbedding(teks) {
  try {
    const res = await fetch(`${EMBED_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: teks, ts: Date.now() })
    });
    return await res.json();
  } catch (e) {
    console.error('❌ Embed error:', e.message);
    return null;
  }
}

async function cariRelevan(query, limit = 5) {
  try {
    const res = await fetch(`${EMBED_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit })
    });
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    console.error('❌ Search error:', e.message);
    return [];
  }
}

module.exports = { simpanEmbedding, cariRelevan };
