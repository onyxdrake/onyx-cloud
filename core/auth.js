const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

// ===== HASH PASSWORD PAKE SHA-256 + SALT =====
function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  try {
    const [method, salt, hash] = stored.split(':');
    if (method !== 'pbkdf2') return false;
    const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === verify;
  } catch { return false; }
}

// ===== VALIDASI =====
function validasiEmail(email) {
  if (!email || typeof email !== 'string') return { ok: false, error: 'Email required' };
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!re.test(email)) return { ok: false, error: 'Invalid email format' };
  if (email.length > 100) return { ok: false, error: 'Email too long' };
  return { ok: true };
}

function validasiPassword(password) {
  if (!password || typeof password !== 'string') return { ok: false, error: 'Password required' };
  if (password.length < 8) return { ok: false, error: 'Password min 8 characters' };
  if (password.length > 72) return { ok: false, error: 'Password max 72 characters' };
  if (!/[A-Z]/.test(password)) return { ok: false, error: 'Password must have uppercase' };
  if (!/[a-z]/.test(password)) return { ok: false, error: 'Password must have lowercase' };
  if (!/[0-9]/.test(password)) return { ok: false, error: 'Password must have number' };
  return { ok: true };
}

// ===== USER MANAGEMENT =====
function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveUsers(users) {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

async function registerUser(email, password) {
  const cekEmail = validasiEmail(email);
  if (!cekEmail.ok) return { ok: false, error: cekEmail.error };
  const cekPass = validasiPassword(password);
  if (!cekPass.ok) return { ok: false, error: cekPass.error };

  const users = loadUsers();
  if (users[email]) return { ok: false, error: 'Email already registered' };

  const hash = hashPassword(password);
  const userId = crypto.createHash('sha256').update(email + Date.now()).digest('hex').slice(0, 16);

  users[email] = {
    userId,
    email,
    passwordHash: hash,
    hashMethod: 'pbkdf2-sha512-100k',
    tier: 'free',
    banned: false,
    createdAt: Date.now(),
    lastLogin: null
  };

  saveUsers(users);
  return { ok: true, userId, email, hashMethod: 'pbkdf2-sha512-100k' };
}

async function loginUser(email, password) {
  const cekEmail = validasiEmail(email);
  if (!cekEmail.ok) return { ok: false, error: 'Email or password wrong' };

  const users = loadUsers();
  const user = users[email];
  if (!user) {
    hashPassword(password);
    return { ok: false, error: 'Email or password wrong' };
  }

  if (user.banned) return { ok: false, error: 'Account banned: ' + (user.banReason || 'TOS violation') };

  const cocok = verifyPassword(password, user.passwordHash);
  if (!cocok) return { ok: false, error: 'Email or password wrong' };

  user.lastLogin = Date.now();
  users[email] = user;
  saveUsers(users);

  const token = crypto.createHash('sha256').update(user.userId + Date.now()).digest('hex');

  return { ok: true, token, userId: user.userId, email: user.email, tier: user.tier, hashMethod: user.hashMethod };
}

function getUserById(userId) {
  const users = loadUsers();
  for (const email in users) {
    if (users[email].userId === userId) return { ...users[email], email };
  }
  return null;
}

function getUserByEmail(email) {
  const users = loadUsers();
  return users[email] || null;
}

function deleteUser(email) {
  const users = loadUsers();
  delete users[email];
  saveUsers(users);
}

module.exports = {
  validasiEmail, validasiPassword,
  registerUser, loginUser,
  getUserByEmail, getUserById, deleteUser,
  hashPassword, verifyPassword
};
