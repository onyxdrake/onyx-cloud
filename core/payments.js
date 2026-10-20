const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

require('dotenv').config();

const SEED_PHRASE = process.env.SEED_PHRASE;
const USDC_MINT = process.env.USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

const DB_PATH = path.join(__dirname, '..', 'data', 'payments.db');

let db = null;
let SQL = null;

async function initDb() {
  if (db) return db;
  SQL = await initSqlJs();

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      tx_signature TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      mint TEXT NOT NULL,
      from_address TEXT,
      memo TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER,
      verified_at INTEGER
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      tier TEXT DEFAULT 'free',
      created_at INTEGER,
      premium_until INTEGER
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);`);

  simpan();
  return db;
}

function simpan() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function getDb() {
  if (!db) throw new Error('DB belum di-init. Panggil initDb() dulu.');
  return db;
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  simpan();
}

// Hash password pake scrypt
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const verify = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === verify;
}

function registerUser(email, password) {
  const userId = crypto.createHash('md5').update(email).digest('hex').slice(0, 16);
  const passwordHash = hashPassword(password);
  try {
    run('INSERT INTO users (user_id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
      [userId, email, passwordHash, Math.floor(Date.now() / 1000)]);
    return { ok: true, userId };
  } catch (e) {
    if (e.message.includes('UNIQUE')) return { ok: false, error: 'Email udah terdaftar' };
    return { ok: false, error: e.message };
  }
}

function loginUser(email, password) {
  const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) return { ok: false, error: 'Email gak terdaftar' };
  if (!verifyPassword(password, user.password_hash)) return { ok: false, error: 'Password salah' };
  return { ok: true, userId: user.user_id, tier: user.tier };
}

function recordPayment(userId, txSignature, amount, mint, fromAddress, memo) {
  try {
    run(`INSERT INTO payments (user_id, tx_signature, amount, mint, from_address, memo, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [userId, txSignature, amount, mint, fromAddress, memo, Math.floor(Date.now() / 1000)]);
    return { ok: true };
  } catch (e) {
    if (e.message.includes('UNIQUE')) return { ok: false, error: 'Transaksi udah tercatat' };
    return { ok: false, error: e.message };
  }
}

function verifyPayment(txSignature) {
  const payment = queryOne('SELECT * FROM payments WHERE tx_signature = ?', [txSignature]);
  if (!payment) return { ok: false, error: 'Transaksi gak ketemu' };
  if (payment.status === 'verified') return { ok: true, already: true };

  run('UPDATE payments SET status = ?, verified_at = ? WHERE tx_signature = ?',
    ['verified', Math.floor(Date.now() / 1000), txSignature]);

  const premiumUntil = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
  run('UPDATE users SET tier = ?, premium_until = ? WHERE user_id = ?',
    ['premium', premiumUntil, payment.user_id]);

  return { ok: true };
}

function listPending() {
  return queryAll("SELECT * FROM payments WHERE status = 'pending' ORDER BY created_at DESC");
}

function listAll(limit = 50) {
  return queryAll('SELECT * FROM payments ORDER BY created_at DESC LIMIT ?', [limit]);
}

function getUser(userId) {
  return queryOne('SELECT user_id, email, tier, premium_until FROM users WHERE user_id = ?', [userId]);
}

module.exports = {
  initDb, getDb, registerUser, loginUser,
  recordPayment, verifyPayment, listPending, listAll, getUser,
  WALLET_ADDRESS, USDC_MINT
};
