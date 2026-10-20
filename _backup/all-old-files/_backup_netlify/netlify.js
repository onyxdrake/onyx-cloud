const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
const SITE_ID_FILE = require('path').join(__dirname, '..', 'data', 'netlify-site.json');
const TMP_DIR = require('path').join(__dirname, '..', 'data', 'tmp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function loadSiteId() {
  try { return JSON.parse(fs.readFileSync(SITE_ID_FILE, 'utf8')).siteId; }
  catch { return null; }
}
function saveSiteId(siteId) {
  const dir = path.dirname(SITE_ID_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SITE_ID_FILE, JSON.stringify({ siteId, ts: Date.now() }, null, 2));
}

async function buatSite(nama) {
  if (!NETLIFY_TOKEN) return { ok: false, error: 'NETLIFY_TOKEN kosong' };
  try {
    const res = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${NETLIFY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nama })
    });
    const data = await res.json();
    if (data.error) return { ok: false, error: data.error };
    return { ok: true, site: data };
  } catch (e) { return { ok: false, error: e.message }; }
}

function buatZip(files) {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const tmpDir = path.join(TMP_DIR, 'deploy-' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  for (const [filename, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(tmpDir, filename), content);
  }

  const zipPath = path.join(TMP_DIR, 'deploy-' + Date.now() + '.zip');
  execSync(`cd ${tmpDir} && zip -r ${zipPath} .`, { stdio: 'ignore' });

  const buffer = fs.readFileSync(zipPath);
  try { execSync(`rm -rf ${tmpDir} ${zipPath}`); } catch {}

  return buffer;
}

async function deployZip(siteId, files) {
  if (!NETLIFY_TOKEN) return { ok: false, error: 'Token kosong' };
  try {
    const zipBuffer = buatZip(files);
    const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/zip'
      },
      body: zipBuffer
    });
    const deploy = await deployRes.json();
    if (deploy.error) return { ok: false, error: deploy.error };
    return { ok: true, deployId: deploy.id, url: deploy.ssl_url || deploy.url };
  } catch (e) { return { ok: false, error: e.message }; }
}

function buatHTMLStatus(status, info = {}) {
  const statusText = status === 'on' ? '🟢 ONLINE' : '🔴 OFFLINE';
  const statusColor = status === 'on' ? '#0f0' : '#f44';
  const cloudflareUrl = info.cloudflareUrl || null;

  let tombol;
  if (status === 'on' && cloudflareUrl) {
    tombol = `
      <a class="btn" href="${cloudflareUrl}/onyx.html">📲 Buka Onyx</a>
      <a class="btn btn-secondary" href="${cloudflareUrl}/onyx.html" onclick="installPWA(event, '${cloudflareUrl}')">⬇️ Install PWA</a>
      <p class="note">🔗 Link dibuka lewat Cloudflare Tunnel. Kalo server mati, link ilang.</p>
    `;
  } else if (status === 'on') {
    tombol = `
      <a class="btn" href="http://localhost:3000/onyx.html">📲 Buka Onyx (Lokal)</a>
      <p class="note">🔗 Server online, tapi Cloudflare belum aktif.</p>
    `;
  } else {
    tombol = `
      <div class="offline-note">⏳ Server Onyx offline. Link download bakal muncul saat online.</div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0a0a0a"><title>Onyx Cloud — ${statusText}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, sans-serif; background: #0a0a0a; color: #eee; min-height: 100vh; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; }
  .status { display: inline-block; background: #141414; border: 1px solid #222; padding: 6px 14px; border-radius: 20px; font-size: 12px; color: ${statusColor}; margin-bottom: 16px; }
  .status::before { content: '●'; margin-right: 6px; animation: blink 1.5s infinite; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  h1 { font-size: 28px; margin-bottom: 8px; background: linear-gradient(90deg, #0f0, #0ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .sub { color: #888; font-size: 14px; margin-bottom: 20px; line-height: 1.6; }
  .info { background: #141414; border: 1px solid #1f1f1f; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  .info h3 { color: #0f0; font-size: 14px; margin-bottom: 8px; }
  .info ul { margin-left: 18px; color: #aaa; font-size: 13px; }
  .info li { margin-bottom: 4px; }
  .info p { color: #aaa; font-size: 13px; line-height: 1.6; }
  .btn { display: block; text-align: center; background: #0f0; color: #000; text-decoration: none; padding: 14px; border-radius: 10px; font-weight: 700; font-size: 14px; margin: 12px 0; }
  .btn-secondary { background: #1a1a1a; color: #0f0; border: 1px solid #0f0; }
  .offline-note { background: #1a1a1a; border-left: 3px solid #f44; padding: 12px; border-radius: 8px; font-size: 13px; color: #aaa; margin: 12px 0; }
  .note { font-size: 11px; color: #666; margin-top: 8px; line-height: 1.5; }
  .links { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 20px; }
  .links a { background: #141414; border: 1px solid #1f1f1f; color: #0f0; text-decoration: none; padding: 10px; border-radius: 8px; font-size: 12px; text-align: center; }
  .footer { color: #444; font-size: 11px; margin-top: 30px; text-align: center; }
</style></head>
<body><div class="container">
  <div class="status">${statusText}</div>
  <h1>Onyx Cloud</h1>
  <p class="sub">Onyx adalah AI yang <b>bukan cuma menjawab</b> — tapi <b>mengerjakan</b>.</p>
  ${tombol}
  <div class="info"><h3>⚡ Yang Bisa Dilakuin</h3><ul><li>💬 Chat multi-bahasa</li><li>💻 Coding & debug</li><li>🔍 Riset & OSINT</li><li>🎨 Generate gambar</li><li>📊 Analisis data</li><li>🐍 Jalanin Python</li><li>🔌 Integrasi</li></ul></div>
  <div class="links"><a href="/how-onyx.html">📖 How Onyx</a><a href="/faq.html">❓ FAQ</a><a href="/readme.html">📄 Readme</a><a href="/docs.html">📚 Docs</a></div>
  <div class="footer">© 2026 Onyx Cloud · Status: ${status} · ${new Date().toLocaleString('id-ID')}</div>
</div>
  <script>
    let deferredPrompt = null;
    function installPWA(e, url) {
      e.preventDefault();
      if (window.matchMedia('(display-mode: standalone)').matches) {
        alert('Onyx udah keinstall!');
        return;
      }
      window.location.href = url + '/onyx.html';
    }
  </script>
</body></html>`;
}

function buatHTMLHowOnyx() {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>How Onyx Works</title><style>body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#eee;padding:20px;max-width:700px;margin:0 auto;line-height:1.7}h1{color:#0f0}h2{color:#0ff;font-size:16px;margin:20px 0 8px}p,li{color:#ccc;font-size:14px}pre{background:#141414;padding:12px;border-radius:8px;color:#0f0;font-size:12px;overflow-x:auto}a{color:#0f0;text-decoration:none}.back{font-size:13px}</style></head><body><a class="back" href="/">← Balik</a><h1>How Onyx Works</h1><h2>Arsitektur</h2><pre>ONYX CORE\n├── ONYX FAST — Cepet, gratis\n├── ONYX PRO — Pinter, unlimited\n└── TOOLS — Web, Files, Python, Image</pre><h2>Cara Kerja</h2><ol><li>User kirim pesan</li><li>Onyx deteksi bahasa</li><li>Pilih model (Fast/Pro)</li><li>Panggil tools kalo butuh</li><li>Verifikasi & jawab</li></ol><h2>Kenapa Beda?</h2><ul><li>Multi-Model</li><li>Multi-Tool</li><li>Realistis</li><li>Gratis</li></ul></body></html>`;
}

function buatHTMLFAQ() {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FAQ</title><style>body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#eee;padding:20px;max-width:700px;margin:0 auto;line-height:1.7}h1{color:#0f0}.faq{background:#141414;border:1px solid #1f1f1f;border-radius:12px;padding:16px;margin:12px 0}.faq h3{color:#0f0;font-size:15px;margin-bottom:8px}.faq p{color:#ccc;font-size:13px}a{color:#0f0;text-decoration:none}.back{font-size:13px}</style></head><body><a class="back" href="/">← Balik</a><h1>❓ FAQ</h1><div class="faq"><h3>Apa itu Onyx?</h3><p>Platform AI yang gabungin model + tools.</p></div><div class="faq"><h3>Gratis?</h3><p>Iya, ada tier Free. Upgrade kalo butuh lebih.</p></div><div class="faq"><h3>Kenapa offline?</h3><p>Server jalan di HP developer. Kalo HP mati, server offline.</p></div><div class="faq"><h3>Data aman?</h3><p>Password di-hash bcrypt. Session JWT.</p></div>
  <script>
    let deferredPrompt = null;
    function installPWA(e, url) {
      e.preventDefault();
      if (window.matchMedia('(display-mode: standalone)').matches) {
        alert('Onyx udah keinstall!');
        return;
      }
      window.location.href = url + '/onyx.html';
    }
  </script>
</body></html>`;
}

function buatHTMLReadme() {
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Readme</title><style>body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#eee;padding:20px;max-width:700px;margin:0 auto;line-height:1.7}h1{color:#0f0}h2{color:#0ff;font-size:16px;margin:20px 0 8px}p,li{color:#ccc;font-size:14px}pre{background:#141414;padding:12px;border-radius:8px;color:#0f0;font-size:12px}a{color:#0f0;text-decoration:none}.back{font-size:13px}</style></head><body><a class="back" href="/">← Balik</a><h1>📄 Readme</h1><h2>Onyx Cloud</h2><p>Platform AI multi-model, multi-tool.</p><h2>Fitur</h2><ul><li>💬 Chat</li><li>💻 Coding</li><li>🔍 Riset</li><li>🎨 Gambar</li><li>🐍 Python</li></ul></body></html>`;
}

async function updateStatus(status, info = {}) {
  if (!NETLIFY_TOKEN || NETLIFY_TOKEN.includes('isi_')) {
    return { ok: false, error: 'NETLIFY_TOKEN belum di-set' };
  }
  try {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

    let siteId = loadSiteId();
    if (!siteId) {
      const buat = await buatSite('onyx-cloud-' + Date.now().toString(36));
      if (!buat.ok) return buat;
      siteId = buat.site.id;
      saveSiteId(siteId);
      console.log('✅ Site ID disimpen:', siteId);
    }

    const files = {
      'index.html': buatHTMLStatus(status, info),
      'how-onyx.html': buatHTMLHowOnyx(),
      'faq.html': buatHTMLFAQ(),
      'readme.html': buatHTMLReadme(),
      '_redirects': '/onyx/*  https://' + (info.cloudflareUrl || 'localhost:3000').replace('https://', '') + '/onyx/:splat  200\n/onyx.html  https://' + (info.cloudflareUrl || 'localhost:3000').replace('https://', '') + '/onyx.html  200\n/chat/*  https://' + (info.cloudflareUrl || 'localhost:3000').replace('https://', '') + '/chat/:splat  200',
      'robots.txt': 'User-agent: *\nAllow: /\nSitemap: https://onyxdrake.github.io/onyx-cloud/sitemap.xml\n',
      'sitemap.xml': '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://onyxdrake.github.io/onyx-cloud/</loc><priority>1.0</priority></url><url><loc>https://onyxdrake.github.io/onyx-cloud/how-onyx.html</loc><priority>0.8</priority></url><url><loc>https://onyxdrake.github.io/onyx-cloud/faq.html</loc><priority>0.8</priority></url><url><loc>https://onyxdrake.github.io/onyx-cloud/readme.html</loc><priority>0.7</priority></url></urlset>'
    };

    // Tambahin file verifikasi Google kalo ada
    const googleFile = 'googlefacc72d422e3b5b6.html';
    const googlePath = path.join(__dirname, '..', 'public', googleFile);
    if (fs.existsSync(googlePath)) {
      files[googleFile] = fs.readFileSync(googlePath, 'utf8');
      console.log('✅ File verifikasi Google ditambahin');
    }

    const deploy = await deployZip(siteId, files);
    if (!deploy.ok) return deploy;

    return { ok: true, url: deploy.url, status, siteId };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { buatSite, deployZip, updateStatus, loadSiteId, saveSiteId };
