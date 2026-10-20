const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Header: cuma /setup yang tanggung jawab Onyx
router.use('/oauth/setup', (req, res, next) => {
  res.setHeader('X-Onyx-Official', 'true');
  next();
});

const ENV_FILE = path.join(__dirname, '..', '.env');

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
  const redirect = encodeURIComponent('http://localhost:3000/api/oauth/spotify/callback');
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
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: 'http://localhost:3000/api/oauth/spotify/callback' })
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
  const redirect = encodeURIComponent('http://localhost:3000/api/oauth/google/callback');
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
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: 'http://localhost:3000/api/oauth/google/callback', grant_type: 'authorization_code' })
    });
    const data = await tokenRes.json();
    if (data.error) return res.json({ error: data.error_description });
    res.redirect(`/integrations.html?google_token=${data.access_token}`);
  } catch (e) { res.json({ error: e.message }); }
});

// GITHUB
router.get('/oauth/github', (req, res) => {
  const clientId = getEnv('GITHUB_CLIENT_ID');
  if (!clientId) return res.redirect('/setup-oauth.html');
  const redirect = encodeURIComponent('http://localhost:3000/api/oauth/github/callback');
  const scope = encodeURIComponent('repo user');
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect}&scope=${scope}`);
});

router.get('/oauth/github/callback', async (req, res) => {
  const code = req.query.code;
  const clientId = getEnv('GITHUB_CLIENT_ID');
  const clientSecret = getEnv('GITHUB_CLIENT_SECRET');
  if (!code || !clientId || !clientSecret) return res.json({ error: 'Gagal OAuth' });
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    });
    const data = await tokenRes.json();
    if (data.error) return res.json({ error: data.error_description });
    res.redirect(`/integrations.html?github_token=${data.access_token}`);
  } catch (e) { res.json({ error: e.message }); }
});

// NOTION
router.get('/oauth/notion', (req, res) => {
  const clientId = getEnv('NOTION_CLIENT_ID');
  if (!clientId) return res.redirect('/setup-oauth.html');
  const redirect = encodeURIComponent('http://localhost:3000/api/oauth/notion/callback');
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
      body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: 'http://localhost:3000/api/oauth/notion/callback' })
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
  const redirect = encodeURIComponent('http://localhost:3000/api/oauth/slack/callback');
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
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: 'http://localhost:3000/api/oauth/slack/callback' })
    });
    const data = await tokenRes.json();
    if (!data.ok) return res.json({ error: data.error });
    res.redirect(`/integrations.html?slack_token=${data.access_token}`);
  } catch (e) { res.json({ error: e.message }); }
});

module.exports = router;
