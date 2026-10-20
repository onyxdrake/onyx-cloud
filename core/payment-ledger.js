// core/payment-ledger.js
// Payment ledger — catat setiap transaksi, backup otomatis

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LEDGER_FILE = path.join(__dirname, '..', 'data', 'payment-ledger.json');
const BACKUP_FILE = path.join(__dirname, '..', 'data', 'payment-ledger.backup.json');
const BACKUP_INTERVAL = 5 * 60 * 1000; // 5 menit

let ledger = null;
let dirty = false;

function load() {
  if (ledger) return ledger;

  // Coba load dari file utama
  if (fs.existsSync(LEDGER_FILE)) {
    try {
      ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
      console.log('[Ledger] Loaded', Object.keys(ledger).length, 'users');
      return ledger;
    } catch (e) {
      console.error('[Ledger] File corrupt, coba backup...');
    }
  }

  // Fallback ke backup
  if (fs.existsSync(BACKUP_FILE)) {
    try {
      ledger = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
      console.log('[Ledger] Recovered from backup');
      return ledger;
    } catch {}
  }

  ledger = {};
  return ledger;
}

function save() {
  dirty = true;
  // Save langsung ke file utama
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
}

function backup() {
  try {
    fs.copyFileSync(LEDGER_FILE, BACKUP_FILE);
    console.log('[Ledger] Backup saved');
  } catch (e) {
    console.error('[Ledger] Backup failed:', e.message);
  }
}

// Catat transaksi (atomik)
function catat(userId, type, amount, meta = {}) {
  const l = load();
  if (!l[userId]) {
    l[userId] = {
      balance: 0,
      totalIn: 0,
      totalOut: 0,
      ledger: []
    };
  }

  const tx = {
    id: 'tx_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex'),
    type,           // 'topup' | 'usage' | 'refund' | 'bonus'
    amount: parseFloat(amount),
    time: Date.now(),
    ...meta
  };

  l[userId].ledger.push(tx);

  // Update balance
  if (amount > 0) {
    l[userId].balance += parseFloat(amount);
    l[userId].totalIn += parseFloat(amount);
  } else {
    l[userId].balance += parseFloat(amount);
    l[userId].totalOut += Math.abs(parseFloat(amount));
  }

  // Keep max 1000 transaksi per user
  if (l[userId].ledger.length > 1000) {
    l[userId].ledger = l[userId].ledger.slice(-1000);
  }

  save();
  return tx;
}

function getBalance(userId) {
  const l = load();
  return l[userId]?.balance || 0;
}

function getLedger(userId) {
  const l = load();
  return l[userId]?.ledger || [];
}

function getSummary(userId) {
  const l = load();
  if (!l[userId]) return { balance: 0, totalIn: 0, totalOut: 0, txCount: 0 };
  return {
    balance: l[userId].balance,
    totalIn: l[userId].totalIn,
    totalOut: l[userId].totalOut,
    txCount: l[userId].ledger.length
  };
}

// Backup otomatis tiap 5 menit
setInterval(backup, BACKUP_INTERVAL);

// Backup saat server mati
process.on('SIGINT', () => { backup(); process.exit(0); });
process.on('SIGTERM', () => { backup(); process.exit(0); });

module.exports = { catat, getBalance, getLedger, getSummary, backup };
