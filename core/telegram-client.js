// core/telegram-client.js
// Kirim pesan dari nomor pribadi via MTProto

const { TelegramClient } = require('teleproto');
const { StringSession } = require('teleproto/sessions');
const fs = require('fs');
const path = require('path');

const SESSION_FILE = path.join(__dirname, '..', 'data', 'telegram-session.txt');

let client = null;

async function connect() {
  if (client && client.connected) return client;
  if (!fs.existsSync(SESSION_FILE)) {
    throw new Error('Session Telegram gak ada. Jalanin: node setup-telegram-client.js');
  }

  const sessionString = fs.readFileSync(SESSION_FILE, 'utf8').trim();
  client = new TelegramClient(
    new StringSession(sessionString),
    parseInt(process.env.TELEGRAM_API_ID),
    process.env.TELEGRAM_API_HASH,
    { connectionRetries: 3 }
  );

  await client.connect();
  return client;
}

async function kirimKeNomor(nomor, pesan) {
  try {
    const c = await connect();
    const result = await c.sendMessage(nomor, { message: pesan });
    return { ok: true, id: result.id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function kirimKeSelf(pesan) {
  try {
    const c = await connect();
    const me = await c.getMe();
    const result = await c.sendMessage(me.id, { message: pesan });
    return { ok: true, id: result.id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}



async function kirimKeChannel(channelId, pesan) {
  try {
    const c = await connect();
    const result = await c.sendMessage(channelId, { message: pesan });
    return { ok: true, id: result.id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { connect, kirimKeNomor, kirimKeSelf, kirimKeChannel };
