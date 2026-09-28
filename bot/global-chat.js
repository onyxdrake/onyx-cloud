const WebSocket = require('ws');
const intent = require('../core/intent');

const PORT = 8083;
const wss = new WebSocket.Server({ port: PORT });

// Room: 1 room global
const clients = new Map(); // userId -> ws

console.log('💬 Global Chat jalan di port', PORT);

wss.on('connection', (ws, req) => {
  const params = new URL(req.url, 'http://x').searchParams;
  const userId = params.get('userId') || 'anon-' + Date.now();
  const username = params.get('username') || 'Anonymous';

  clients.set(userId, { ws, username });
  console.log(`👤 ${username} (${userId}) joined`);

  // Broadcast join
  broadcast({
    type: 'join',
    userId,
    username,
    count: clients.size
  }, ws);

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      
      if (data.type === 'message') {
        // Cek filter
        const cekFilter = intent.cekNiat(data.text);
        if (!cekFilter.ok) {
          ws.send(JSON.stringify({
            type: 'error',
            error: cekFilter.error
          }));
          return;
        }
        
        // Broadcast ke semua
        broadcast({
          type: 'message',
          userId,
          username,
          text: data.text,
          category: cekFilter.category,
          ts: Date.now()
        });
      }
      
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', error: e.message }));
    }
  });

  ws.on('close', () => {
    clients.delete(userId);
    console.log(`👤 ${username} left`);
    broadcast({
      type: 'leave',
      userId,
      username,
      count: clients.size
    });
  });
});

function broadcast(data, exclude = null) {
  const msg = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.ws !== exclude && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  });
}

module.exports = { wss, broadcast };
