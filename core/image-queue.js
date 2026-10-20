// core/image-queue.js
// Queue system buat image generation — premium skip antri

const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '..', 'data', 'image-queue.json');

let queue = [];
let processing = false;
const MAX_CONCURRENT = 3; // Max 3 gambar paralel

function loadQueue() {
  try { queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); }
  catch { queue = []; }
}

function saveQueue() {
  try { fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2)); } catch {}
}

// Priority: makin kecil, makin diprioritasin
function getPriority(tier) {
  return {
    'free': 100,
    'basic': 50,
    'premium': 10,
    'pro': 1
  }[tier] || 100;
}

function enqueue(userId, prompt, tier = 'free') {
  loadQueue();
  const id = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  queue.push({
    id,
    userId,
    prompt,
    tier,
    priority: getPriority(tier),
    joinedAt: Date.now(),
    status: 'waiting'
  });
  queue.sort((a, b) => a.priority - b.priority || a.joinedAt - b.joinedAt);
  saveQueue();
  return { id, position: queue.findIndex(q => q.id === id) + 1, total: queue.length };
}

function getNext() {
  loadQueue();
  if (queue.length === 0) return null;
  const next = queue.shift();
  saveQueue();
  return next;
}

function position(userId) {
  loadQueue();
  const idx = queue.findIndex(q => q.userId === userId);
  return idx === -1 ? null : idx + 1;
}

function size() {
  loadQueue();
  return queue.length;
}

module.exports = { enqueue, getNext, position, size, getPriority, MAX_CONCURRENT };
