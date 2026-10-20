// core/notif-transaksi.js
// Kirim notif transaksi ke Telegram + Discord

const fs = require('fs');
const path = require('path');
const tgClient = require('./telegram-client');

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;


// Sensor wallet — cuma tampilkan 4 awal + 4 akhir
function sensorWallet(wallet) {
  if (!wallet || wallet.length < 10) return '***';
  return wallet.slice(0, 4) + '...' + wallet.slice(-4);
}

// Sensor email — cuma tampilkan 3 awal + domain
function sensorEmail(email) {
  if (!email || !email.includes('@')) return '***';
  const [name, domain] = email.split('@');
  const visible = name.slice(0, 3);
  return visible + '***@' + domain;
}

async function kirimNotifTransaksi(data) {
  const {
    userId,
    email,
    paket,
    amount,
    signature,
    wallet,
    network = 'solana',
    timestamp
  } = data;

  const waktu = new Date(timestamp).toLocaleString('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Singapore'
  });

  // === TELEGRAM (Markdown) ===
  const tgPesan = `🎉 *TRANSAKSI BARU*

👤 User: \`${sensorEmail(email || userId)}\`
📦 Paket: *${paket}*
💰 Amount: *$${amount} USDC*
🌐 Network: ${network}
📅 Waktu: ${waktu} (SGT)
🔐 Sig: \`${signature ? signature.slice(0, 20) + '...' : '-'}\`

💼 Wallet: \`${sensorWallet(wallet)}\`
✅ User udah di-upgrade ke *${paket}*!`;

  // Kirim ke Telegram channel (kalau ada), fallback ke self
  try {
    if (TELEGRAM_CHANNEL_ID) {
      const tgResult = await tgClient.kirimKeNomor(TELEGRAM_CHANNEL_ID, tgPesan);
      if (tgResult.ok) console.log('✅ Notif terkirim ke Telegram channel');
    } else {
      const tgResult = await tgClient.kirimKeSelf(tgPesan);
      if (tgResult.ok) console.log('✅ Notif terkirim ke Telegram self');
    }
  } catch (e) {
    console.error('❌ Telegram error:', e.message);
  }

  // === DISCORD (Embed) ===
  if (DISCORD_WEBHOOK) {
    try {
      const embed = {
        username: 'Onyx Bot',
        avatar_url: 'https://onyxdrake.github.io/onyx-cloud/icon-192.png',
        embeds: [{
          title: '🎉 TRANSAKSI BARU',
          color: 0x00ff00, // hijau
          fields: [
            { name: '👤 User', value: '`' + sensorEmail(email || userId) + '`', inline: true },
            { name: '📦 Paket', value: paket || '-', inline: true },
            { name: '💰 Amount', value: `$${amount} USDC`, inline: true },
            { name: '🌐 Network', value: network || '-', inline: true },
            { name: '📅 Waktu', value: waktu + ' (SGT)', inline: false },
            { name: '🔐 Signature', value: '`' + (signature ? signature.slice(0, 30) + '...' : '-') + '`', inline: false },
            { name: '💼 Wallet', value: '`' + (wallet || '-') + '`', inline: false }
          ],
          footer: { text: '✅ User udah di-upgrade' },
          timestamp: new Date(timestamp).toISOString()
        }]
      };

      await fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(embed)
      });
      console.log('✅ Notif terkirim ke Discord');
    } catch (e) {
      console.error('❌ Discord error:', e.message);
    }
  }

  // Log ke file
  try {
    const logFile = path.join(__dirname, '..', 'data', 'transactions.log');
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${JSON.stringify(data)}\n`);
  } catch {}
}

module.exports = { kirimNotifTransaksi };
