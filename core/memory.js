const fs = require('fs');
const path = require('path');

const CHATS_DIR = path.join(__dirname, '..', 'data', 'chats');

async function initDb() {
  if (!fs.existsSync(CHATS_DIR)) fs.mkdirSync(CHATS_DIR, { recursive: true });
  console.log('📁 Chat dir siap:', CHATS_DIR);
}

// PLACEHOLDER: gak pake embedding dulu (biar gak error)
async function simpanEmbedding(teks) {
  // Nanti bisa diintegrasiin ke embed.py
  return { ok: true };
}

function listChats(userId) {
  if (!fs.existsSync(CHATS_DIR)) return [];
  return fs.readdirSync(CHATS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(CHATS_DIR, f), 'utf8'));
        if (userId && data.userId !== userId) return null;
        return { id: f.replace('.json', ''), title: data.title, updated: data.updated, userId: data.userId };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.updated - a.updated);
}

function getChat(id) {
  const file = path.join(CHATS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function saveChat(id, data) {
  if (!fs.existsSync(CHATS_DIR)) fs.mkdirSync(CHATS_DIR, { recursive: true });
  data.updated = Date.now();
  fs.writeFileSync(path.join(CHATS_DIR, `${id}.json`), JSON.stringify(data, null, 2));
}

function newChat(title = 'Obrolan Baru', userId = 'anon') {
  const id = Date.now().toString();
  const data = { id, title, userId, messages: [], created: Date.now(), updated: Date.now() };
  saveChat(id, data);
  return data;
}

function deleteChat(id) {
  const file = path.join(CHATS_DIR, `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

module.exports = { initDb, listChats, getChat, saveChat, newChat, deleteChat, simpanEmbedding };
