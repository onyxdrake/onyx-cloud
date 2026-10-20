// ===== FILTER MULTI-LAYER =====

// Layer 1: Exact match
const BLOCKED_EXACT = [
  'hack', 'crack', 'carding', 'carder', 'phishing', 'keylogger',
  'jual beli senjata', 'jual beli narkoba', 'jual beli organ',
  'pembunuh bayaran', 'bunuh orang', 'cara bunuh',
  'senjata api', 'senjata ilegal', 'narkoba', 'sabu', 'ganja',
  'ekstasi', 'heroin', 'kokain', 'morfin',
  'jual data', 'jual akun', 'jual kartu kredit', 'jual identitas'
];

// Layer 2: Regex patterns (buat ngakalin h4ck, j4l, dll)
const BLOCKED_PATTERNS = [
  /h[a4]ck/i,
  /cr[a4]ck/i,
  /c[a4]rd[i1]ng/i,
  /ph[i1]sh[i1]ng/i,
  /k[e3]yl[o0]gg[e3]r/i,
  /j[u4][a4]l\s*b[e3]l[i1]/i,
  /b[u4]n[u4]h/i,
  /s[e3]nj[a4]t[a4]/i,
  /n[a4]rk[o0]b[a4]/i,
  /s[a4]b[u4]/i,
  /g[a4]nj[a4]/i,
  /[e3]kst[a4]s[i1]/i,
  /h[e3]r[o0][i1]n/i,
  /k[o0]k[a4][i1]n/i,
  /m[o0]rf[i1]n/i,
  /d[a4]t[a4]\s*b[o0]c[o0]r/i,
  /k[a4]rt[u4]\s*cr[e3]d[i1]t/i
];

// Layer 3: Context patterns (buat deteksi niat jahat)
const BLOCKED_CONTEXT = [
  /cara\s+(bikin|buat|membuat)\s+(bom|senjata|racun)/i,
  /dimana\s+(beli|jual)\s+(narkoba|sabu|senjata)/i,
  /siapa\s+(pembunuh|pengedar)/i,
  /harga\s+(sabu|ganja|narkoba)/i,
  /kontak\s+(pengedar|pembunuh)/i,
  /cara\s+(mencuri|merampok|membobol)/i,
  /cara\s+(ngehack|membobol)\s+(akun|email|bank)/i
];

// Layer 4: Whitelist (kata yang mengandung blocked tapi aman)
const WHITELIST = [
  'hackathon', 'hackathon', 'lifehack', 'growthhack',
  'crackle', 'cracker', 'crackers', 'nutcracker',
  'cardigan', 'cardinal',
  'narkoba' // buat edukasi
];

function normalize(text) {
  return text.toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/!/g, 'i');
}

function isWhitelisted(text) {
  const lower = text.toLowerCase();
  return WHITELIST.some(w => lower.includes(w));
}

function cekPesan(pesan) {
  if (!pesan || typeof pesan !== 'string') {
    return { ok: false, error: 'Invalid message' };
  }

  const lower = pesan.toLowerCase();
  const normalized = normalize(pesan);

  // Kalo whitelisted, skip
  if (isWhitelisted(pesan)) {
    return { ok: true, category: 'whitelist' };
  }

  // Layer 1: Exact
  for (const blocked of BLOCKED_EXACT) {
    if (lower.includes(blocked) || normalized.includes(blocked)) {
      return { ok: false, error: 'Blocked: prohibited content', layer: 1, keyword: blocked };
    }
  }

  // Layer 2: Regex patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(pesan)) {
      return { ok: false, error: 'Blocked: prohibited content', layer: 2, pattern: pattern.toString() };
    }
  }

  // Layer 3: Context
  for (const pattern of BLOCKED_CONTEXT) {
    if (pattern.test(pesan)) {
      return { ok: false, error: 'Blocked: prohibited context', layer: 3, pattern: pattern.toString() };
    }
  }

  // Allowed: 18+ content
  const adultKeywords = ['18+', 'film', 'bokep', 'dewasa', 'adult', 'porno', 'xxx'];
  for (const kw of adultKeywords) {
    if (lower.includes(kw)) {
      return { ok: true, category: 'adult', keyword: kw };
    }
  }

  return { ok: true, category: 'normal' };
}

module.exports = { cekPesan, normalize, isWhitelisted };
