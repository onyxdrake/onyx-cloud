// bot/onyx-bot.js — Onyx Bot (fixed)
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN || TOKEN.length < 20) {
  console.error('❌ TELEGRAM_BOT_TOKEN kosong atau invalid');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

const BILLING_FILE = path.join(__dirname, '..', 'data', 'billing.json');
const REFERRAL_FILE = path.join(__dirname, '..', 'data', 'referrals.json');
const LOGIN_FILE = path.join(__dirname, '..', 'data', 'telegram-logins.json');

function loadJSON(file, def = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return def; }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// === /start ===
bot.onText(/\/start(.*)/, (msg, match) => {
  if (msg.chat.type === 'channel') return;

  const userId = String(msg.from.id);
  const name = msg.from.first_name || 'User';
  const logins = loadJSON(LOGIN_FILE);

  // Kalau belum login, kasih menu interaktif (bukan cuma teks)
  if (!logins[userId]) {
    const opts = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💡 Coba Fitur Onyx', callback_data: 'demo' }],
          [{ text: '💎 Lihat Harga Premium', callback_data: 'harga' }],
          [{ text: '🔐 Login via Gmail', url: `${process.env.OAUTH_BASE_URL || 'https://compactly-propeller-livestock.ngrok-free.dev'}/login.html?telegram=${userId}` }]
        ]
      }
    };

    const welcomeText = `🚀 *Halo ${name}!* Selamat datang di Onyx Cloud.

Onyx adalah AI yang *bisa ngerjain tugas*, bukan cuma ngobrol.

Klik tombol di bawah buat mulai:`;

    return bot.sendMessage(msg.chat.id, welcomeText, { parse_mode: 'Markdown', ...opts });
  }

  // Cek referral
  const text = match[1] || '';
  const refMatch = text.match(/ref_(\w+)/);

  // Kalau udah login
  if (logins[userId]) {
    const welcomeText = `🚀 *Selamat datang kembali, ${name}!*

Akun lo udah ke-link: \`${logins[userId].email}\`

*Command:*
/status — cek saldo
/premium — paket
/topup — top up
/tanya — tanya soal Onyx
/checkin — cek status
/referral — program referral
/help — bantuan`;

    return bot.sendMessage(msg.chat.id, welcomeText, { parse_mode: 'Markdown' });
  }

  // Belum login
  const loginUrl = `${process.env.OAUTH_BASE_URL || 'https://compactly-propeller-livestock.ngrok-free.dev'}/login.html?telegram=${userId}${refMatch ? '&ref=' + refMatch[1] : ''}`;

  const welcomeText2 = `🚀 *Selamat datang di Onyx Cloud, ${name}!*

Sebelum mulai, lo harus *login Gmail* dulu biar akun Onyx lo ke-link dengan Telegram ini.

*Kenapa perlu login?*
✅ Buat sync data lo
✅ Buat antisipasi abuse
✅ Buat bonus harian
✅ Buat referral (dapet 1% per teman)

Klik link di bawah buat login:

[🔐 Login dengan Gmail](${loginUrl})

Setelah login, balik ke sini dan ketik /start lagi.`;

  bot.sendMessage(msg.chat.id, welcomeText2, {
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
});

// === /status ===
bot.onText(/\/status/, (msg) => {
  if (msg.chat.type === 'channel') return;
  const userId = String(msg.from.id);
  const billing = loadJSON(BILLING_FILE);
  const user = billing[userId] || { balance: 0, totalUsed: 0, tier: 'free' };

  const text = `📊 *Status Akun*

👤 User ID: \`${userId}\`
💰 Saldo: *$${(user.balance || 0).toFixed(2)}*
📉 Total used: $${(user.totalUsed || 0).toFixed(2)}
📦 Tier: *${user.tier || 'free'}*`;

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// === /premium ===
bot.onText(/\/premium/, (msg) => {
  if (msg.chat.type === 'channel') return;
  const text = `💎 *Paket Premium Onyx*

🆓 *Free* — $0/bulan
• 20 chat/hari
• 3 image/hari

⭐ *Basic* — $2.5/bulan
• 100 chat/hari
• 20 image/hari
• 1 API Key

🔥 *Premium* — $7/bulan
• 500 chat/hari
• 100 image/hari
• 5 API Key

👑 *Pro* — $25/bulan
• 2.000 chat/hari
• 500 image/hari
• 20 API Key

Bayar: /topup`;

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// === /topup ===
bot.onText(/\/topup/, (msg) => {
  if (msg.chat.type === 'channel') return;
  const url = 'https://compactly-propeller-livestock.ngrok-free.dev/topup.html';
  bot.sendMessage(msg.chat.id, `💳 *Top-up Onyx*\n\n${url}\n\nMetode: USDC (Solana)`, { parse_mode: 'Markdown' });
});

// === /checkin ===
bot.onText(/\/checkin/, (msg) => {
  if (msg.chat.type === 'channel') return;
  const userId = String(msg.from.id);
  const billing = loadJSON(BILLING_FILE);
  const user = billing[userId] || { balance: 0 };

  const text = `📅 *Check-in*

💰 Saldo lo: *$${(user.balance || 0).toFixed(2)}*

Mau dapet bonus? Ajak temen pakai /referral`;

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// === /referral ===
bot.onText(/\/referral/, (msg) => {
  if (msg.chat.type === 'channel') return;
  const userId = String(msg.from.id);
  const referrals = loadJSON(REFERRAL_FILE);
  if (!referrals[userId]) {
    referrals[userId] = { code: userId.slice(-6), count: 0, earned: 0 };
    saveJSON(REFERRAL_FILE, referrals);
  }

  const r = referrals[userId];
  const link = `https://t.me/onyxinitium_bot?start=ref_${r.code}`;

  const text = `🎁 *Referral Program*

Link lo:
${link}

*Cara kerja:*
Temen lo daftar + top-up paket → Lo dapet *1% dari nilai paket*

*Contoh:*
• Basic $2.5 → Lo dapet $0.025
• Premium $7 → Lo dapet $0.07
• Pro $25 → Lo dapet $0.25

*Total:*
👥 Referral: *${r.count}*
💰 Earned: *$${r.earned.toFixed(3)}*`;

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
});

// === /tanya ===
bot.onText(/\/tanya (.+)/, async (msg, match) => {
  if (msg.chat.type === 'channel') return;
  const pertanyaan = match[1].trim();

  bot.sendChatAction(msg.chat.id, 'typing');

  try {
    const response = await fetch('http://localhost:3000/api/tanya-onyx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pertanyaan, userId: String(msg.from.id) })
    });
    const data = await response.json();

    if (data.ok) {
      bot.sendMessage(msg.chat.id, data.jawaban, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(msg.chat.id, '❌ Maaf, Onyx lagi sibuk.');
    }
  } catch (e) {
    bot.sendMessage(msg.chat.id, '❌ Error: ' + e.message);
  }
});

// === /help ===
bot.onText(/\/help/, (msg) => {
  if (msg.chat.type === 'channel') return;
  const text = `❓ *Bantuan Onyx*

/start — mulai
/status — cek saldo
/premium — paket
/topup — top up
/tanya — tanya soal Onyx
/checkin — status harian
/referral — referral
/help — bantuan

*Link:*
🌐 Web: https://compactly-propeller-livestock.ngrok-free.dev
📢 Channel: https://t.me/Onyxdrak
💬 Discord: https://discord.gg/vbwY2VfHd

📧 onyxdrake.ai@gmail.com`;

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown', disable_web_page_preview: true });
});

// Error handler
bot.on('polling_error', (err) => {
  console.error('Polling error:', err.message);
});

console.log('🤖 Onyx Bot aktif! (@onyxinitium_bot)');
console.log('📡 Polling messages...');

process.on('SIGINT', () => {
  bot.stopPolling();
  process.exit(0);
});
