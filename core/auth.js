const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// ============ VALIDASI ============
function validasiEmail(email) {
  if (!email || typeof email !== 'string') return { ok: false, error: 'Email wajib diisi' };
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!re.test(email)) return { ok: false, error: 'Format email salah' };
  if (email.length > 100) return { ok: false, error: 'Email terlalu panjang' };
  return { ok: true };
}

function validasiPassword(password) {
  if (!password || typeof password !== 'string') return { ok: false, error: 'Password wajib diisi' };
  if (password.length < 8) return { ok: false, error: 'Password minimal 8 karakter' };
  if (password.length > 72) return { ok: false, error: 'Password maksimal 72 karakter' };
  if (!/[A-Z]/.test(password)) return { ok: false, error: 'Password harus ada huruf besar' };
  if (!/[a-z]/.test(password)) return { ok: false, error: 'Password harus ada huruf kecil' };
  if (!/[0-9]/.test(password)) return { ok: false, error: 'Password harus ada angka' };
  return { ok: true };
}

// ============ USER MANAGEMENT ============
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
  // Validasi
  const cekEmail = validasiEmail(email);
  if (!cekEmail.ok) return { ok: false, error: cekEmail.error };
  const cekPass = validasiPassword(password);
  if (!cekPass.ok) return { ok: false, error: cekPass.error };

  const users = loadUsers();

  // Cek duplikat
  if (users[email]) return { ok: false, error: 'Email udah terdaftar' };

  // Hash password pake bcrypt (cost 12)
  const hash = await bcrypt.hash(password, 12);

  const userId = crypto.createHash('sha256').update(email + Date.now()).digest('hex').slice(0, 16);

  users[email] = {
    userId,
    email,
    passwordHash: hash,
    tier: 'free',
    banned: false,
    createdAt: Date.now(),
    lastLogin: null
  };

  saveUsers(users);
  return { ok: true, userId, email };
}

async function loginUser(email, password) {
  const cekEmail = validasiEmail(email);
  if (!cekEmail.ok) return { ok: false, error: 'Email atau password salah' };

  const users = loadUsers();
  const user = users[email];

  // Selalu cek password walau user gak ada (biar timing attack gak bisa)
  if (!user) {
    await bcrypt.hash(password, 12);
    return { ok: false, error: 'Email atau password salah' };
  }

  if (user.banned) return { ok: false, error: 'Akun di-ban: ' + (user.banReason || 'Pelanggaran TOS') };

  const cocok = await bcrypt.compare(password, user.passwordHash);
  if (!cocok) return { ok: false, error: 'Email atau password salah' };

  // Update last login
  user.lastLogin = Date.now();
  users[email] = user;
  saveUsers(users);

  // Bikin JWT
  const token = jwt.sign(
    { userId: user.userId, email: user.email, tier: user.tier },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { ok: true, token, userId: user.userId, email: user.email, tier: user.tier };
}

function verifikasiToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function getUserByEmail(email) {
  const users = loadUsers();
  return users[email] || null;
}

function getUserById(userId) {
  const users = loadUsers();
  for (const email in users) {
    if (users[email].userId === userId) return { ...users[email], email };
  }
  return null;
}

function deleteUser(email) {
  const users = loadUsers();
  delete users[email];
  saveUsers(users);
}

function banUser(email, alasan) {
  const users = loadUsers();
  if (!users[email]) return { ok: false, error: 'User gak ada' };
  users[email].banned = true;
  users[email].banReason = alasan;
  users[email].bannedAt = Date.now();
  saveUsers(users);
  return { ok: true };
}

module.exports = {
  validasiEmail, validasiPassword,
  registerUser, loginUser, verifikasiToken,
  getUserByEmail, getUserById, deleteUser, banUser,
  JWT_SECRET
};
