const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;

async function updateFile(filepath, content, message = 'Update') {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return { ok: false, error: 'GITHUB_TOKEN or GITHUB_REPO missing' };
  }
  try {
    const getRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filepath}`, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json' }
    });
    let sha = null;
    if (getRes.ok) { const data = await getRes.json(); sha = data.sha; }

    const body = { message, content: Buffer.from(content).toString('base64') };
    if (sha) body.sha = sha;

    const putRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filepath}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const putData = await putRes.json();
    if (putData.error) return { ok: false, error: putData.error.message };
    return { ok: true, url: putData.content?.html_url };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function updateFiles(fileMap, message = 'Batch update') {
  const results = {};
  for (const [filepath, content] of Object.entries(fileMap)) {
    if (content === null) continue;
    results[filepath] = await updateFile(filepath, content, `${message}: ${filepath}`);
  }
  return results;
}

async function updateStatus(status, info = {}) {
  const statusText = status === 'on' ? '🟢 ONLINE' : '🔴 OFFLINE';
  const statusColor = status === 'on' ? '#0f0' : '#f44';
  const cloudflareUrl = info.cloudflareUrl || null;

  let button;
  if (status === 'on' && cloudflareUrl) {
    button = `
      <a class="btn" href="${cloudflareUrl}/onyx.html">📲 Open Onyx</a>
      <a class="btn btn-secondary" href="${cloudflareUrl}/onyx.html">⬇️ Install PWA</a>
      <p class="note">🔗 Link via Cloudflare Tunnel. If server is off, link disappears.</p>
    `;
  } else if (status === 'on') {
    button = `<a class="btn" href="http://localhost:3000/onyx.html">📲 Open Onyx (Local)</a>`;
  } else {
    button = `<div class="offline-note">⏳ Onyx server is offline. Link will appear when online.</div>`;
  }

  const files = {
    'index.html': buatHTMLStatus(status, statusText, statusColor, button),
    'status.json': JSON.stringify({ status, cloudflareUrl, updated: new Date().toISOString(), version: '1.0.0' }, null, 2),
    'config.json': JSON.stringify({
      serverUrl: cloudflareUrl,
      status: status,
      features: ['chat', 'coding', 'research', 'image', 'python', 'integrations'],
      updated: new Date().toISOString(),
      version: '1.0.0'
    }, null, 2),
    'how-onyx.html': buatHTMLHowOnyx(),
    'faq.html': buatHTMLFAQ(),
    'readme.html': buatHTMLReadme(),
    'docs.html': buatHTMLDocs(),
    'install.html': buatHTMLInstall(),
    'robots.txt': 'User-agent: *\nAllow: /\nSitemap: https://onyxdrake.github.io/onyx-cloud/sitemap.xml\n',
    'sitemap.xml': '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://onyxdrake.github.io/onyx-cloud/</loc><priority>1.0</priority></url><url><loc>https://onyxdrake.github.io/onyx-cloud/how-onyx.html</loc><priority>0.8</priority></url><url><loc>https://onyxdrake.github.io/onyx-cloud/faq.html</loc><priority>0.8</priority></url><url><loc>https://onyxdrake.github.io/onyx-cloud/docs.html</loc><priority>0.7</priority></url></urlset>'
  };

  const results = await updateFiles(files, `Update status: ${status}`);
  const failed = Object.entries(results).filter(([k, v]) => v && v.error);
  if (failed.length > 0) {
    return { ok: false, error: failed.map(([k, v]) => `${k}: ${v.error}`).join(', ') };
  }
  return { ok: true, url: 'https://github.com/' + GITHUB_REPO, files: Object.keys(results).length };
}

function buatHTMLInstall() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="theme-color" content="#0a0a0a">
<title>Install Onyx</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, sans-serif; background: #0a0a0a; color: #eee; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .box { background: #141414; border: 1px solid #1f1f1f; border-radius: 16px; padding: 24px; max-width: 400px; width: 100%; text-align: center; }
  h1 { font-size: 22px; margin-bottom: 8px; background: linear-gradient(90deg, #0f0, #0ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  p { color: #888; font-size: 13px; margin-bottom: 20px; line-height: 1.6; }
  .btn { display: block; background: #0f0; color: #000; text-decoration: none; padding: 14px; border-radius: 10px; font-weight: 700; font-size: 14px; margin: 10px 0; }
  .status { font-size: 12px; color: #666; margin-top: 16px; }
  .status.on { color: #0f0; }
  .status.off { color: #f44; }
</style>
</head>
<body>
  <div class="box">
    <h1>📲 Install Onyx</h1>
    <p>Onyx is installed as a PWA. Tap the button below to open the app, then use Chrome's "Add to Home screen".</p>
    <a class="btn" id="openBtn" href="#">📲 Open Onyx</a>
    <div class="status" id="status">Loading config...</div>
  </div>
  <script>
    fetch('https://raw.githubusercontent.com/onyxdrake/onyx-cloud/main/config.json', { cache: 'no-store' })
      .then(r => r.json())
      .then(config => {
        const statusEl = document.getElementById('status');
        if (config.status === 'on' && config.serverUrl) {
          statusEl.className = 'status on';
          statusEl.textContent = '🟢 Server online';
          document.getElementById('openBtn').href = config.serverUrl + '/onyx.html';
        } else {
          statusEl.className = 'status off';
          statusEl.textContent = '🔴 Server offline';
        }
      })
      .catch(() => {
        document.getElementById('status').textContent = '❌ Config load failed';
      });
  </script>
</body>
</html>`;
}

function buatHTMLStatus(status, statusText, statusColor, button) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0a0a0a">
<title>Onyx Cloud — ${statusText}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, sans-serif; background: #0a0a0a; color: #eee; min-height: 100vh; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; }
  .status { display: inline-block; background: #141414; border: 1px solid #222; padding: 6px 14px; border-radius: 20px; font-size: 12px; color: ${statusColor}; margin-bottom: 16px; }
  .status::before { content: '●'; margin-right: 6px; animation: blink 1.5s infinite; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  h1 { font-size: 28px; margin-bottom: 8px; background: linear-gradient(90deg, #0f0, #0ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .sub { color: #888; font-size: 14px; margin-bottom: 20px; line-height: 1.6; }
  .btn { display: block; text-align: center; background: #0f0; color: #000; text-decoration: none; padding: 14px; border-radius: 10px; font-weight: 700; font-size: 14px; margin: 12px 0; }
  .btn-secondary { background: #1a1a1a; color: #0f0; border: 1px solid #0f0; }
  .offline-note { background: #1a1a1a; border-left: 3px solid #f44; padding: 12px; border-radius: 8px; font-size: 13px; color: #aaa; margin: 12px 0; }
  .note { font-size: 11px; color: #666; margin-top: 8px; line-height: 1.5; }
  .info { background: #141414; border: 1px solid #1f1f1f; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  .info h3 { color: #0f0; font-size: 14px; margin-bottom: 8px; }
  .info ul { margin-left: 18px; color: #aaa; font-size: 13px; }
  .footer { color: #444; font-size: 11px; margin-top: 30px; text-align: center; }
</style>
</head>
<body>
  <div class="container">
    <div class="status">${statusText}</div>
    <h1>Onyx Cloud</h1>
    <p class="sub">The AI that doesn't just answer — it executes. We combine models, tools, and workflows into one workspace.</p>
    ${button}
    <div class="info">
      <h3>⚡ What Onyx Can Do</h3>
      <ul>
        <li>💬 Multi-language chat</li>
        <li>💻 Coding & debug</li>
        <li>🔍 Research & OSINT</li>
        <li>🎨 Image generation</li>
        <li>📊 Data analysis</li>
        <li>🐍 Run Python</li>
        <li>🔌 Integrations</li>
      </ul>
    </div>
    <div class="footer">
      © 2026 Onyx Cloud · Status: ${status} · ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>`;
}

function buatHTMLHowOnyx() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>How Onyx Works</title><style>body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#eee;padding:20px;max-width:700px;margin:0 auto;line-height:1.7}h1{color:#0f0}h2{color:#0ff;font-size:16px;margin:20px 0 8px}p,li{color:#ccc;font-size:14px}pre{background:#141414;padding:12px;border-radius:8px;color:#0f0;font-size:12px;overflow-x:auto}a{color:#0f0;text-decoration:none}.back{font-size:13px}</style></head><body><a class="back" href="/">← Back</a><h1>How Onyx Works</h1><h2>Architecture</h2><pre>ONYX CORE\n├── ONYX FAST — Quick, free\n├── ONYX PRO — Smart, unlimited\n└── TOOLS — Web, Files, Python, Image</pre><h2>Process</h2><ol><li>User sends message</li><li>Onyx detects language</li><li>Selects model</li><li>Uses tools if needed</li><li>Verifies & responds</li></ol></body></html>`;
}

function buatHTMLFAQ() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FAQ</title><style>body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#eee;padding:20px;max-width:700px;margin:0 auto;line-height:1.7}h1{color:#0f0}.faq{background:#141414;border:1px solid #1f1f1f;border-radius:12px;padding:16px;margin:12px 0}.faq h3{color:#0f0;font-size:15px;margin-bottom:8px}.faq p{color:#ccc;font-size:13px}a{color:#0f0;text-decoration:none}.back{font-size:13px}</style></head><body><a class="back" href="/">← Back</a><h1>❓ FAQ</h1><div class="faq"><h3>What is Onyx?</h3><p>An AI platform that combines models and tools.</p></div><div class="faq"><h3>Is it free?</h3><p>Yes, there is a free tier.</p></div><div class="faq"><h3>Why offline?</h3><p>The server runs on the developer's phone.</p></div></body></html>`;
}

function buatHTMLReadme() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Readme</title><style>body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#eee;padding:20px;max-width:700px;margin:0 auto;line-height:1.7}h1{color:#0f0}h2{color:#0ff;font-size:16px;margin:20px 0 8px}p,li{color:#ccc;font-size:14px}pre{background:#141414;padding:12px;border-radius:8px;color:#0f0;font-size:12px}a{color:#0f0;text-decoration:none}.back{font-size:13px}</style></head><body><a class="back" href="/">← Back</a><h1>📄 Readme</h1><h2>Onyx Cloud</h2><p>Multi-model, multi-tool AI platform.</p></body></html>`;
}

function buatHTMLDocs() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docs</title><style>body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#eee;padding:20px;max-width:700px;margin:0 auto;line-height:1.7}h1{color:#0f0}h2{color:#0ff;font-size:16px;margin:20px 0 8px}p,li{color:#ccc;font-size:14px}pre{background:#141414;padding:12px;border-radius:8px;color:#0f0;font-size:12px}a{color:#0f0;text-decoration:none}.back{font-size:13px}</style></head><body><a class="back" href="/">← Back</a><h1>📚 Docs</h1><h2>Quick Start</h2><ol><li>Register at /register.html</li><li>Verify email</li><li>Login</li><li>Start chatting</li></ol></body></html>`;
}

module.exports = { updateFile, updateFiles, updateStatus };
