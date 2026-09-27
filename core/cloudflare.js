const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const URL_FILE = path.join(__dirname, '..', 'data', 'cloudflare-url.json');
let tunnelUrl = null;
let tunnelProcess = null;
let wss = null;

function loadUrl() {
  try { return JSON.parse(fs.readFileSync(URL_FILE, 'utf8')).url; }
  catch { return null; }
}

function saveUrl(url) {
  const dir = path.dirname(URL_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(URL_FILE, JSON.stringify({ url, ts: Date.now() }, null, 2));
}

function startTunnel(port = 3000) {
  return new Promise((resolve, reject) => {
    console.log('☁️  Starting Cloudflare Tunnel...');
    tunnelProcess = spawn('cloudflared', [
      'tunnel', '--url', `http://localhost:${port}`,
      '--no-tls-verify'
    ]);

    let found = false;
    let fullLog = '';

    tunnelProcess.stderr.on('data', (data) => {
      const output = data.toString();
      fullLog += output;

      const matches = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
      if (matches) {
        for (const url of matches) {
          if (!url.includes('api.trycloudflare') && !found) {
            found = true;
            tunnelUrl = url;
            saveUrl(tunnelUrl);
            console.log('✅ Cloudflare URL:', tunnelUrl);
            // Broadcast URL baru ke semua client
            broadcastUrl(tunnelUrl);
            resolve(tunnelUrl);
            break;
          }
        }
      }
    });

    tunnelProcess.on('error', (err) => {
      console.error('❌ Cloudflare error:', err.message);
      reject(err);
    });

    tunnelProcess.on('close', (code) => {
      console.log('☁️  Cloudflare tunnel closed:', code);
      tunnelUrl = null;
      tunnelProcess = null;
    });

    setTimeout(() => {
      if (!found) {
        console.error('❌ Timeout 30 detik. Log terakhir:');
        console.error(fullLog.slice(-500));
        if (tunnelProcess) tunnelProcess.kill();
        reject(new Error('Timeout: Cloudflare URL gak muncul'));
      }
    }, 30000);
  });
}

// WebSocket server buat broadcast URL
function startWebSocket(port = 8082) {
  wss = new WebSocket.Server({ port });
  console.log('📡 WebSocket URL broadcaster jalan di port', port);

  wss.on('connection', (ws) => {
    console.log('👤 Client connect');
    // Kirim URL sekarang
    if (tunnelUrl) {
      ws.send(JSON.stringify({ type: 'url', url: tunnelUrl }));
    }
    ws.on('close', () => console.log('👤 Client disconnect'));
  });
}

function broadcastUrl(url) {
  if (!wss) return;
  const msg = JSON.stringify({ type: 'url', url });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
  console.log('📡 URL broadcasted:', url);
}

function getUrl() {
  return tunnelUrl || loadUrl();
}

function stopTunnel() {
  if (tunnelProcess) {
    try { tunnelProcess.kill(); } catch {}
    tunnelProcess = null;
  }
  if (wss) {
    try { wss.close(); } catch {}
    wss = null;
  }
  tunnelUrl = null;
}

module.exports = { startTunnel, startWebSocket, getUrl, stopTunnel, loadUrl, saveUrl, broadcastUrl };
