const express = require('express');
const path = require('path');
require('dotenv').config();

const apiRouter = require('./api');
const { initDb } = require('./core/memory');
const { updateStatus } = require('./core/github');
const { startTunnel, startWebSocket, getUrl, stopTunnel } = require('./core/cloudflare');
require('./bot/global-chat');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/api', apiRouter);

app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb().then(async () => {
  app.listen(3000, async () => {
    console.log('✅ Onyx di http://localhost:3000');

    // 1. Jalanin Cloudflare Tunnel
    let cloudflareUrl = null;
    try {
      cloudflareUrl = await startTunnel(3000);
      startWebSocket(8082);
    } catch (e) {
      console.log('⚠️  Cloudflare gagal:', e.message);
      console.log('⚠️  Pake URL lokal aja');
    }

    // 2. Update GitHub pake URL Cloudflare
    if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
      console.log('🌐 Update GitHub status ON...');
      const r = await updateStatus('on', {
        url: 'http://localhost:3000',
        cloudflareUrl: cloudflareUrl
      });
      if (r && r.ok) {
        console.log('✅ GitHub updated:', r.url || 'success');
      } else {
        console.log('❌ GitHub gagal:', r ? r.error : 'unknown');
      }
    } else {
      console.log('⚠️  GITHUB_TOKEN atau GITHUB_REPO kosong. Skip update.');
    }
  });
}).catch(e => {
  console.error('❌ Init DB gagal:', e.message);
  process.exit(1);
});

// Pas server mati
process.on('SIGINT', async () => {
  console.log('\n🛑 Server mati...');
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
    console.log('🌐 Update GitHub status OFF...');
    await updateStatus('off');
    console.log('✅ GitHub di-update');
  }
  stopTunnel();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) await updateStatus('off');
  stopTunnel();
  process.exit(0);
});
