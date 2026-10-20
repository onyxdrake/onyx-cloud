// core/scraper.js
const cheerio = require('cheerio');

async function scrape(url) {
  if (!url || !url.startsWith('http')) {
    return { error: 'URL invalid' };
  }

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OnyxBot/1.0)'
      },
      signal: AbortSignal.timeout(15000)
    });

    const html = await r.text();
    const $ = cheerio.load(html);

    // Hapus script & style
    $('script, style, noscript').remove();

    const title = $('title').text().trim() || $('h1').first().text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000);

    const links = $('a[href]').map((i, el) => $(el).attr('href')).get()
      .filter(h => h && (h.startsWith('http') || h.startsWith('/')))
      .slice(0, 50);

    const images = $('img[src]').map((i, el) => $(el).attr('src')).get()
      .filter(Boolean).slice(0, 20);

    const headings = $('h1, h2, h3').map((i, el) => ({
      tag: el.tagName,
      text: $(el).text().trim()
    })).get().slice(0, 30);

    return {
      url,
      title,
      description,
      ogImage,
      text,
      headings,
      links,
      images,
      fetchedAt: Date.now()
    };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { scrape };
