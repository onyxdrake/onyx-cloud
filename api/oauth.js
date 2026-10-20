const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { userIdFromEmail } = require('../core/user-id');

// Header: cuma /setup yang tanggung jawab Onyx
router.use('/oauth/setup', (req, res, next) => {
  res.setHeader('X-Onyx-Official', 'true');
  next();
});

const ENV_FILE = path.join(__dirname, '..', '.env');
const TOKEN_FILE = path.join(__dirname, '..', 'data', 'oauth-tokens.json');

function loadTokens() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); }
  catch { return {}; }
}
function saveTokens(data) {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
}
function simpenToken(userId, provider, token, extra) {
  const all = loadTokens();
  if (!all[userId]) all[userId] = {};
  all[userId][provider] = { token, extra: extra || {}, savedAt: Date.now() };
  saveTokens(all);
}

// Base URL dynamic — baca dari .env atau auto-detect dari request
function getBaseUrl(req) {
  // 1. Prioritas: dari .env
  const fromEnv = getEnv('OAUTH_BASE_URL');
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  // 2. Fallback: deteksi dari request headers
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

// Baca .env langsung tiap kali (biar update tanpa restart)
function getEnv(key) {
  // Cek process.env dulu
  if (process.env[key]) return process.env[key];
  // Kalo gak ada, baca dari file
  try {
    const env = fs.readFileSync(ENV_FILE, 'utf8');
    const match = env.match(new RegExp('^' + key + '=(.*)$', 'm'));
    return match ? match[1].trim() : null;
  } catch { return null; }
}

// Simpen OAuth credentials
router.post('/oauth/setup', (req, res) => {
  // Proteksi: wajib ADMIN_KEY
  const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
  if (!adminKey || adminKey !== getEnv('ADMIN_KEY')) {
    return res.status(403).json({ error: 'Admin key salah' });
  }

  const { layanan, clientId, clientSecret } = req.body;
  if (!layanan || !clientId || !clientSecret) return res.json({ error: 'Data kurang' });

  const key = layanan.toUpperCase();
  const envKeyId = `${key}_CLIENT_ID`;
  const envKeySecret = `${key}_CLIENT_SECRET`;

  try {
    let env = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';

    // Hapus baris lama
    env = env.replace(new RegExp(`^${envKeyId}=.*$`, 'gm'), '');
    env = env.replace(new RegExp(`^${envKeySecret}=.*$`, 'gm'), '');

    // Tambahin baru
    env += `\n${envKeyId}=${clientId}\n${envKeySecret}=${clientSecret}\n`;

    fs.writeFileSync(ENV_FILE, env);

    // Update process.env biar langsung aktif
    process.env[envKeyId] = clientId;
    process.env[envKeySecret] = clientSecret;

    console.log(`✅ OAuth ${layanan} di-setup`);
    res.json({ ok: true, layanan });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// SPOTIFY
router.get('/oauth/spotify', (req, res) => {
  const clientId = getEnv('SPOTIFY_CLIENT_ID');
  if (!clientId) return res.redirect('/setup-oauth.html');
  const redirect = encodeURIComponent(getBaseUrl(req) + '/api/oauth/spotify/callback');
  const scope = encodeURIComponent('user-read-playback-state user-modify-playback-state playlist-read-private');
  res.redirect(`https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirect}&scope=${scope}`);
});

router.get('/oauth/spotify/callback', async (req, res) => {
  const code = req.query.code;
  const clientId = getEnv('SPOTIFY_CLIENT_ID');
  const clientSecret = getEnv('SPOTIFY_CLIENT_SECRET');
  if (!code || !clientId || !clientSecret) return res.json({ error: 'Gagal OAuth' });
  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: getBaseUrl(req) + '/api/oauth/spotify/callback' })
    });
    const data = await tokenRes.json();
    if (data.error) return res.json({ error: data.error_description });
    res.redirect(`/integrations.html?spotify_token=${data.access_token}&refresh=${data.refresh_token}`);
  } catch (e) { res.json({ error: e.message }); }
});

// GOOGLE
router.get('/oauth/google', (req, res) => {
  const clientId = getEnv('GOOGLE_CLIENT_ID');
  if (!clientId) return res.redirect('/setup-oauth.html');
  const redirect = encodeURIComponent(getBaseUrl(req) + '/api/oauth/google/callback');
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly');
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=code&redirect_uri=${redirect}&scope=${scope}&access_type=offline`);
});

router.get('/oauth/google/callback', async (req, res) => {
  const code = req.query.code;
  const clientId = getEnv('GOOGLE_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET');
  if (!code || !clientId || !clientSecret) return res.json({ error: 'Gagal OAuth' });
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: getBaseUrl(req) + '/api/oauth/google/callback', grant_type: 'authorization_code' })
    });
    const data = await tokenRes.json();
    if (data.error) return res.json({ error: data.error_description });
    res.redirect(`/integrations.html?google_token=${data.access_token}`);
  } catch (e) { res.json({ error: e.message }); }
});

// GITHUB
router.get('/oauth/github', (req, res) => {
  const clientId = getEnv('GITHUB_OAUTH_CLIENT_ID');
  if (!clientId) return res.redirect('/setup-oauth.html');
  const redirect = encodeURIComponent(getBaseUrl(req) + '/api/oauth/github/callback');
  const scope = encodeURIComponent('read:user user:email');
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect}&scope=${scope}`);
});

router.get('/oauth/github/callback', async (req, res) => {
  const code = req.query.code;
  const clientId = getEnv('GITHUB_OAUTH_CLIENT_ID');
  const clientSecret = getEnv('GITHUB_OAUTH_CLIENT_SECRET');
  if (!code || !clientId || !clientSecret) return res.json({ error: 'Gagal OAuth' });
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    });
    const data = await tokenRes.json();
    if (data.error) return res.json({ error: data.error_description });

    // Ambil info user GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${data.access_token}`, 'User-Agent': 'Onyx-Cloud' }
    });
    const user = await userRes.json();

    // Ambil email kalau null (private email)
    let email = user.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { 'Authorization': `Bearer ${data.access_token}`, 'User-Agent': 'Onyx-Cloud' }
      });
      const emails = await emailRes.json();
      email = emails.find(e => e.primary)?.email || emails[0]?.email;
    }

    // Generate userId dari email — SAMA dengan yang di users.json
    const userId = email ? userIdFromEmail(email) : 'gh_' + (user.login || 'unknown');

    // Simpen token pake userId konsisten
    simpenToken(userId, 'github', data.access_token, {
      username: user.login,
      name: user.name,
      email: email,
      avatar: user.avatar_url
    });

    // Redirect — bawa userId, bukan token
    res.redirect(`/integrations.html?connected=github&userId=${encodeURIComponent(userId)}`);
  } catch (e) { res.json({ error: e.message }); }
});

// NOTION
router.get('/oauth/notion', (req, res) => {
  const clientId = getEnv('NOTION_CLIENT_ID');
  if (!clientId) return res.redirect('/setup-oauth.html');
  const redirect = encodeURIComponent(getBaseUrl(req) + '/api/oauth/notion/callback');
  res.redirect(`https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${redirect}`);
});

router.get('/oauth/notion/callback', async (req, res) => {
  const code = req.query.code;
  const clientId = getEnv('NOTION_CLIENT_ID');
  const clientSecret = getEnv('NOTION_CLIENT_SECRET');
  if (!code || !clientId || !clientSecret) return res.json({ error: 'Gagal OAuth' });
  try {
    const tokenRes = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: getBaseUrl(req) + '/api/oauth/notion/callback' })
    });
    const data = await tokenRes.json();
    if (data.error) return res.json({ error: data.error });
    res.redirect(`/integrations.html?notion_token=${data.access_token}`);
  } catch (e) { res.json({ error: e.message }); }
});

// SLACK
router.get('/oauth/slack', (req, res) => {
  const clientId = getEnv('SLACK_CLIENT_ID');
  if (!clientId) return res.redirect('/setup-oauth.html');
  const redirect = encodeURIComponent(getBaseUrl(req) + '/api/oauth/slack/callback');
  const scope = encodeURIComponent('channels:read chat:write');
  res.redirect(`https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirect}`);
});

router.get('/oauth/slack/callback', async (req, res) => {
  const code = req.query.code;
  const clientId = getEnv('SLACK_CLIENT_ID');
  const clientSecret = getEnv('SLACK_CLIENT_SECRET');
  if (!code || !clientId || !clientSecret) return res.json({ error: 'Gagal OAuth' });
  try {
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: getBaseUrl(req) + '/api/oauth/slack/callback' })
    });
    const data = await tokenRes.json();
    if (!data.ok) return res.json({ error: data.error });
    res.redirect(`/integrations.html?slack_token=${data.access_token}`);
  } catch (e) { res.json({ error: e.message }); }
});

// NETLIFY
router.get('/oauth/netlify', (req, res) => {
  const clientId = getEnv('NETLIFY_OAUTH_CLIENT_ID');
  if (!clientId) return res.redirect('/setup-oauth.html');
  const redirect = encodeURIComponent(getBaseUrl(req) + '/api/oauth/netlify/callback');
  res.redirect(`https://app.netlify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirect}`);
});

router.get('/oauth/netlify/callback', async (req, res) => {
  const code = req.query.code;
  const clientId = getEnv('NETLIFY_OAUTH_CLIENT_ID');
  const clientSecret = getEnv('NETLIFY_OAUTH_CLIENT_SECRET');
  if (!code || !clientId || !clientSecret) return res.json({ error: 'Gagal OAuth' });
  try {
    const tokenRes = await fetch('https://api.netlify.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getBaseUrl(req) + '/api/oauth/netlify/callback'
      })
    });
    const data = await tokenRes.json();
    if (data.error) return res.json({ error: data.error_description || data.error });
    res.redirect(`/integrations.html?netlify_token=${data.access_token}`);
  } catch (e) { res.json({ error: e.message }); }
});

// GITHUB SETUP (post-install)
router.get('/oauth/github/setup', (req, res) => {
  const installationId = req.query.installation_id;
  if (installationId) {
    console.log(`[GitHub Setup] installation_id=${installationId}`);
    // TODO: simpen installation_id ke DB user
  }
  res.redirect('/integrations.html?github_setup=ok');
});

// CEK STATUS — provider apa aja yang udah connect
router.get('/oauth/status', (req, res) => {
  const userId = req.query.user;
  if (!userId) return res.json({ error: 'User kosong' });
  const all = loadTokens();
  const userTokens = all[userId] || {};
  const status = {};
  for (const provider of ['github', 'google', 'spotify', 'notion', 'slack', 'netlify']) {
    status[provider] = !!userTokens[provider];
  }
  res.json({ ok: true, user: userId, status });
});

// CEK SESSION — user udah login apa belum
router.get('/oauth/session', (req, res) => {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(/onyx_session=([^;]+)/);
  if (!match) return res.json({ ok: false, loggedIn: false });

  try {
    const session = JSON.parse(Buffer.from(match[1], 'base64').toString());
    res.json({
      ok: true,
      loggedIn: true,
      userId: session.userId,
      email: session.email,
      provider: session.provider,
      loginAt: session.loginAt
    });
  } catch {
    res.json({ ok: false, loggedIn: false });
  }
});

module.exports = router;
