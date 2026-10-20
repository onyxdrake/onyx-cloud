// core/telegram-otp.js
// Fallback OTP — kirim ke admin via Bot API

const TelegramBot = require('node-telegram-bot-api');

let bot = null;

function getBot() {
  if (bot) return bot;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  bot = new TelegramBot(token, { polling: false });
  return bot;
}

async function kirimOTPKeAdmin(email, kode, userAgent, ip) {
  const b = getBot();
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!b || !adminChatId) {
    return { ok: false, error: 'Telegram gak dikonfig' };
  }

  const text = `🔐 *OTP Request — Onyx*\n\n` +
    `📧 Email: \`${email}\`\n` +
    `🔢 Kode: \`${kode}\`\n` +
    `🌐 IP: \`${ip}\`\n` +
    `💻 Device: \`${(userAgent || '').slice(0, 50)}\``;

  try {
    await b.sendMessage(adminChatId, text, { parse_mode: 'Markdown' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { kirimOTPKeAdmin };
