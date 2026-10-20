require('dotenv').config();
// Setup Telegram Client — pakai teleproto (gak butuh native build)
const { TelegramClient } = require('teleproto');
const { StringSession } = require('teleproto/sessions');
const input = require('input');
const fs = require('fs');
const path = require('path');

const API_ID = parseInt(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;
const SESSION_FILE = path.join(__dirname, 'data', 'telegram-session.txt');

(async () => {
  if (!API_ID || !API_HASH) {
    console.error('❌ Set TELEGRAM_API_ID dan TELEGRAM_API_HASH di .env');
    process.exit(1);
  }

  let sessionString = '';
  if (fs.existsSync(SESSION_FILE)) {
    sessionString = fs.readFileSync(SESSION_FILE, 'utf8').trim();
    console.log('📁 Session lama ditemukan.');
  }

  const client = new TelegramClient(
    new StringSession(sessionString),
    API_ID,
    API_HASH,
    { connectionRetries: 5 }
  );

  await client.start({
    phoneNumber: async () => await input.text('Nomor HP (+62xxx): '),
    password: async () => await input.text('Password 2FA (kosongin kalau gak ada): '),
    phoneCode: async () => await input.text('Kode OTP Telegram: '),
    onError: (err) => console.error(err)
  });

  fs.writeFileSync(SESSION_FILE, client.session.save());
  console.log('✅ Session tersimpan:', SESSION_FILE);

  const me = await client.getMe();
  console.log('👤 Login sebagai:', me.firstName, '(@' + (me.username || 'no-username') + ')');

  await client.sendMessage(me.id, { message: '🚀 Test dari Onyx!' });
  console.log('✅ Test pesan terkirim ke diri sendiri');

  await client.disconnect();
  process.exit(0);
})();
