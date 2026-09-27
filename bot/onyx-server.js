const WebSocket = require('ws');
const crypto = require('crypto');

const wss = new WebSocket.Server({ port: 8081 });

const nodes = new Map();      // userId -> { ws, resource }
const tasks = new Map();      // taskId -> { resolve, reject }

// Token sederhana (nanti bisa diganti JWT)
function buatToken(userId) {
  return crypto.createHash('sha256').update(userId + process.env.ADMIN_KEY).digest('hex').slice(0, 32);
}
function verifikasiToken(userId, token) {
  return buatToken(userId) === token;
}

wss.on('connection', (ws, req) => {
  const params = new URL(req.url, 'http://x').searchParams;
  const userId = params.get('userId');
  const token = params.get('token');

  if (!userId || !token || !verifikasiToken(userId, token)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Token salah' }));
    ws.close();
    return;
  }

  nodes.set(userId, { ws, resource: null });
  console.log(`✅ Node online: ${userId}`);

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'resource') {
        nodes.get(userId).resource = data.data;
        console.log(`📊 ${userId} — RAM: ${data.data.ram_available}GB, Disk: ${data.data.disk_free}GB`);
      }

      if (data.type === 'result') {
        const task = tasks.get(data.taskId);
        if (task) {
          task.resolve(data.result);
          tasks.delete(data.taskId);
        }
      }

      if (data.type === 'pong') {
        // heartbeat
      }
    } catch (e) {
      console.error('Error:', e.message);
    }
  });

  ws.on('close', () => {
    nodes.delete(userId);
    console.log(`❌ Node offline: ${userId}`);
  });
});

// Kirim tugas ke node
function kirimTugas(userId, kode, bahasa = 'python', timeout = 30000) {
  return new Promise((resolve, reject) => {
    const node = nodes.get(userId);
    if (!node) return reject(new Error('Node offline. Install agent dulu di Termux.'));

    const taskId = crypto.randomBytes(8).toString('hex');
    tasks.set(taskId, { resolve, reject });

    node.ws.send(JSON.stringify({ type: 'task', id: taskId, kode, bahasa }));

    setTimeout(() => {
      if (tasks.has(taskId)) {
        tasks.delete(taskId);
        reject(new Error('Timeout'));
      }
    }, timeout);
  });
}

function listNodes() {
  const list = [];
  for (const [userId, node] of nodes) {
    list.push({ userId, resource: node.resource });
  }
  return list;
}

console.log('🤖 Onyx WebSocket Server jalan di port 8081');
console.log('📡 Nunggu node konek...');

module.exports = { kirimTugas, listNodes };
