let currentReasoning = localStorage.getItem('onyx_reasoning') || 'medium';
// ===== SERVER URL =====
function getServerUrl() {
  // Prioritas: localStorage > localhost
  const url = localStorage.getItem('onyx_server_url');
  if (url) return url;
  // Fallback: current origin (kalo diakses dari server langsung)
  return window.location.origin;
}

let currentPersonality = localStorage.getItem('onyx_personality') || 'formal';
// ===== USER =====
const userId = localStorage.getItem('onyx_userId');
const userEmail = localStorage.getItem('onyx_email');
let currentLang = localStorage.getItem('onyx_lang') || 'EN';

if (userEmail) {
  const el = document.getElementById('user-email');
  if (el) el.textContent = userEmail;
}
if (userId) {
  fetch(getServerUrl() + '/api/user/' + userId).then(r => r.json()).then(d => {
    if (d.tier) {
      const el = document.getElementById('user-tier');
      if (el) el.textContent = d.tier.toUpperCase();
      localStorage.setItem('onyx_tier', d.tier);
    }
  }).catch(() => {});
} else {
  const el = document.getElementById('user-tier');
  if (el) el.textContent = 'Not logged in';
}

// ===== CHAT =====
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const send = document.getElementById('send');
let currentChatId = null;
let currentMode = 'chat';
let waitingWorker = null;

loadChatList();
loadLimit();

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 80) + 'px';
});
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); kirim(); }
});

function gantiBahasa() {
  currentLang = document.getElementById('lang-select').value;
  localStorage.setItem('onyx_lang', currentLang);
}

function gantiReasoning() {
  currentReasoning = document.getElementById('reasoning-select').value;
  localStorage.setItem('onyx_reasoning', currentReasoning);
}

function gantiPersonality() {
  currentPersonality = document.getElementById('personality-select').value;
  localStorage.setItem('onyx_personality', currentPersonality);
}

function gantiMode() {
  currentMode = document.getElementById('mode-select').value;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

function tambah(teks, kelas, msgId) {
  const div = document.createElement('div');
  div.className = 'msg ' + kelas;
  if (msgId) div.dataset.msgId = msgId;

  const imageMatch = teks.match(/\[IMAGE\](.*?)\[\/IMAGE\]/);
  if (imageMatch) {
    const url = imageMatch[1];
    const textWithout = teks.replace(/\[IMAGE\].*?\[\/IMAGE\]/, '');
    div.innerHTML = textWithout.replace(/\n/g, '<br>') + `<img src="${url}">`;
  } else {
    div.textContent = teks;
  }

  if (kelas === 'ai') {
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    actions.innerHTML = `
      <button onclick="salinPesan(this)">📋</button>
      <button onclick="sukaPesan(this)">👍</button>
      <button onclick="gakSukaPesan(this)">👎</button>
      <button onclick="bagikanPesan(this)">📤</button>
      <button onclick="simpanPesan(this)">💾</button>
    `;
    div.appendChild(actions);
  }
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function tambahGambar(url, prompt) {
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.innerHTML = `<div>🎨 ${prompt}</div><img src="${url}">`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function salinPesan(btn) {
  const teks = btn.closest('.msg').childNodes[0].textContent;
  navigator.clipboard.writeText(teks);
  btn.textContent = '✅';
  setTimeout(() => btn.textContent = '📋', 1500);
}
function sukaPesan(btn) { btn.classList.toggle('active'); }
function gakSukaPesan(btn) { btn.classList.toggle('active'); }
function bagikanPesan(btn) {
  const teks = btn.closest('.msg').childNodes[0].textContent;
  if (navigator.share) navigator.share({ text: teks });
  else { navigator.clipboard.writeText(teks); alert('Copied'); }
}
function simpanPesan(btn) {
  const teks = btn.closest('.msg').childNodes[0].textContent;
  const saved = JSON.parse(localStorage.getItem('onyx_saved') || '[]');
  saved.push({ teks, ts: Date.now() });
  localStorage.setItem('onyx_saved', JSON.stringify(saved));
  btn.textContent = '✅';
  setTimeout(() => btn.textContent = '💾', 1500);
}

async function loadLimit() {
  try {
    const res = await fetch(getServerUrl() + '/api/limit');
    const data = await res.json();
    const el = document.getElementById('limit-info');
    if (el) el.textContent = `${data.tier} • ${data.usage.chat}/${data.limits.chat}`;
  } catch {}
}

async function kirim() {
  const pesan = input.value.trim();
  if (!pesan) return;

  if (!userId) {
    tambah('⚠️ Please login first.', 'ai');
    setTimeout(() => window.location.href = '/login.html', 1500);
    return;
  }

  input.value = '';
  input.style.height = 'auto';
  tambah(pesan, 'user');
  send.disabled = true;
  const loading = tambah('Onyx is thinking...', 'ai typing');
  try {
    const res = await fetch(getServerUrl() + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pesan, chatId: currentChatId, mode: currentMode, userId, bahasa: currentLang, personality: currentPersonality, reasoning: currentReasoning })
    });
    const data = await res.json();
    loading.remove();
    tambah(data.balasan || 'Error.', 'ai');
    if (data.chatId) currentChatId = data.chatId;
    loadLimit();
    loadChatList();
  } catch (e) {
    loading.remove();
    tambah('Error: ' + e.message, 'ai');
  }
  send.disabled = false;
  input.focus();
}

async function kerjakan() {
  const tujuan = input.value.trim();
  if (!tujuan) return alert('Write your goal first\n\nExample: "Build a shop website from this product data"');
  if (!userId) {
    tambah('⚠️ Please login first.', 'ai');
    setTimeout(() => window.location.href = '/login.html', 1500);
    return;
  }

  input.value = '';
  input.style.height = 'auto';
  tambah(`🎯 Goal: ${tujuan}`, 'user');
  const loading = tambah('🚀 Onyx is working...', 'ai typing');
  send.disabled = true;

  try {
    const res = await fetch(getServerUrl() + '/api/work', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tujuan, userId, bahasa: currentLang, personality: currentPersonality })
    });
    const data = await res.json();
    loading.remove();
    tambah(data.balasan || 'Done.', 'ai');
    loadLimit();
    loadChatList();
  } catch (e) {
    loading.remove();
    tambah('❌ Error: ' + e.message, 'ai');
  }
  send.disabled = false;
}

async function generateGambar() {
  const prompt = input.value.trim() || window.prompt('Image prompt:');
  if (!prompt) return;
  tambah(prompt, 'user');
  const loading = tambah('Drawing...', 'ai typing');
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&seed=${Date.now()}`;
  const img = new Image();
  const timeout = setTimeout(() => {
    loading.remove();
    tambah('⏱️ Timeout. Try again.', 'ai');
  }, 60000);
  img.onload = () => {
    clearTimeout(timeout);
    loading.remove();
    tambahGambar(url, prompt);
  };
  img.onerror = () => {
    clearTimeout(timeout);
    loading.remove();
    tambah('❌ Failed to generate image.', 'ai');
  };
  img.src = url;
}

function mintaLokasi() {
  if (!navigator.geolocation) return tambah('Browser does not support location', 'ai');
  navigator.geolocation.getCurrentPosition(
    p => tambah(`📍 Location: ${p.coords.latitude}, ${p.coords.longitude}`, 'ai'),
    e => tambah('❌ Location failed: ' + e.message, 'ai')
  );
}

function uploadFile() { document.getElementById('file-input').click(); }
function handleFile(inp) {
  const file = inp.files[0];
  if (!file) return;
  tambah(`📁 Upload: ${file.name}`, 'user');
  const reader = new FileReader();
  reader.onload = () => tambah('✅ File received: ' + file.type, 'ai');
  reader.readAsText(file);
}

function newChat() {
  currentChatId = null;
  chat.innerHTML = '<div class="msg ai">New chat. How can I help?</div>';
  if (window.innerWidth < 1024) toggleSidebar();
}

async function loadChatList() {
  const list = document.getElementById('chat-list');
  if (!userId) {
    list.innerHTML = '<div style="color:#555;font-size:11px;padding:6px;">Login first</div>';
    return;
  }
  try {
    const res = await fetch(getServerUrl() + '/api/chats?userId=' + userId);
    const chats = await res.json();
    list.innerHTML = chats.map(c => `
      <div class="item ${c.id === currentChatId ? 'active' : ''}" onclick="bukaChat('${c.id}')">${c.title || 'Chat'}</div>
    `).join('') || '<div style="color:#555;font-size:11px;padding:6px;">No chats yet</div>';
  } catch {
    list.innerHTML = '';
  }
}

async function bukaChat(id) {
  try {
    const res = await fetch(getServerUrl() + '/api/chat/' + id);
    const c = await res.json();
    if (!c) return;
    currentChatId = id;
    chat.innerHTML = '';
    for (const m of c.messages || []) tambah(m.content, m.role === 'user' ? 'user' : 'ai');
    if (window.innerWidth < 1024) toggleSidebar();
    loadChatList();
  } catch {}
}

function filterChats(q) {
  document.querySelectorAll('#chat-list .item').forEach(el => {
    el.style.display = el.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

async function clearAll() {
  if (!confirm('Delete all chats?')) return;
  const res = await fetch(getServerUrl() + '/api/chats?userId=' + userId);
  const chats = await res.json();
  for (const c of chats) await fetch(getServerUrl() + '/api/chat/' + c.id, { method: 'DELETE' });
  loadChatList();
  newChat();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    setInterval(() => reg.update(), 30000);
  });
}

setInterval(async () => {
  try {
    const r = await fetch(getServerUrl() + '/api/ping', { cache: 'no-store' });
    const el = document.getElementById('status');
    el.textContent = r.ok ? '🟢' : '🔴';
    el.className = 'status ' + (r.ok ? 'online' : 'offline');
  } catch {
    const el = document.getElementById('status');
    el.textContent = '🔴';
    el.className = 'status offline';
  }
}, 10000);
