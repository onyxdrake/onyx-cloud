// core/queue.js
// Queue system buat free tier kalau API rate limit

const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '..', 'data', 'queue.json');

let queue = [];
let processing = false;

function loadQueue() {
  try { queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); }
  catch { queue = []; }
}

function saveQueue() {
  try { fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2)); } catch {}
}

// Tambahin user ke queue
function enqueue(userId, email, tier, priority = 100) {
  loadQueue();
  // Cek udah di queue belum
  const existing = queue.find(q => q.userId === userId);
  if (existing) return existing.id;

  const id = 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  queue.push({
    id,
    userId,
    email,
    tier,
    priority,        // makin kecil = makin prioritas
    joinedAt: Date.now()
  });
  // Sort by priority
  queue.sort((a, b) => a.priority - b.priority || a.joinedAt - b.joinedAt);
  saveQueue();
  return id;
}

// Ambil user berikutnya dari queue
function dequeue() {
  loadQueue();
  if (queue.length === 0) return null;
  const next = queue.shift();
  saveQueue();
  return next;
}

// Cek posisi di queue
function position(userId) {
  loadQueue();
  const idx = queue.findIndex(q => q.userId === userId);
  return idx === -1 ? null : idx + 1;
}

// Get queue size
function size() {
  loadQueue();
  return queue.length;
}

module.exports = { enqueue, dequeue, position, size, loadQueue };
