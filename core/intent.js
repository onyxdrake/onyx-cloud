// ===== INTENT DETECTION =====
// Baca niat, bukan cuma keyword

// Korban rentan — kalo ada ini + aksi seksual = TOLAK
const VULNERABLE = [
  'anak', 'bocah', 'balita', 'bayi', 'smp', 'sd', 'tk',
  'pelajar', 'siswa', 'murid', 'remaja', 'abg',
  'dibawah umur', 'di bawah umur', 'underage', 'minor',
  'kakek', 'nenek', 'lansia', 'orang tua',
  'cacat', 'disabilitas', 'down syndrome',
  'paman', 'om', 'tante', 'keluarga', 'saudara',
  'adik', 'kakak', 'sepupu', 'keponakan'
];

// Aksi seksual / kekerasan
const SEXUAL_ACTION = [
  'perkosa', 'perkosaan', 'memperkosa', 'digilir',
  'cabul', 'cabuli', 'mencabuli', 'pelecehan',
  'lecehkan', 'mengintip', 'voyeur',
  'masturbasi', 'onani', 'colmek', 'coli',
  'sodomi', 'oral', 'anal', 'sex', 'seks',
  'telanjang', 'bugil', 'porno', 'bokep',
  'hubungan intim', 'bersetubuh', 'bercinta'
];

// Niat jahat — kombinasi
const MALICIOUS_INTENT = [
  { pattern: /(cara|gimana|bagaimana)\s+(perkosa|memperkosa|cabuli|mencabuli)/i, reason: 'how to commit sexual assault' },
  { pattern: /(cari|nyari|dimana|di mana)\s+(anak|bocah|smp|sd|pelajar).{0,30}(perkosa|cabul|sex|seks|telanjang)/i, reason: 'searching for child abuse content' },
  { pattern: /(jual|beli|tukar)\s+(anak|bocah|smp|sd|pelajar|bayi)/i, reason: 'child trafficking' },
  { pattern: /(perkosa|cabul)\s+(anak|bocah|smp|sd|pelajar|bayi|adik)/i, reason: 'child sexual abuse' },
  { pattern: /(anak|bocah|smp|sd|pelajar|bayi)\s+(perkosa|cabul|sex|seks|telanjang|bugil)/i, reason: 'child sexual abuse' },
  { pattern: /(kakek|nenek|om|paman|tante)\s+(perkosa|cabul|sex|seks)/i, reason: 'elder abuse' },
  { pattern: /(bunuh|bunuh diri|suicide).{0,20}(cara|gimana|bagaimana)/i, reason: 'suicide instruction' },
  { pattern: /(cara|gimana|bagaimana)\s+(bunuh|membunuh|menghabisi)/i, reason: 'how to kill' },
  { pattern: /(racun|racuni).{0,20}(orang|manusia|dia|target)/i, reason: 'poisoning' },
  { pattern: /(culik|menculik|kidnap|kidnapping)/i, reason: 'kidnapping' },
  { pattern: /(jual|beli|tukar).{0,20}(organ|ginjal|jantung|mata)/i, reason: 'organ trafficking' },
  { pattern: /(pelecehan|lecehkan).{0,20}(anak|bocah|smp|sd|pelajar)/i, reason: 'child harassment' }
];

// 18+ legal — boleh, tapi gak boleh ekstrem
const ADULT_ALLOWED = [
  'film 18+', 'film dewasa', 'film adult', 'bokep', 'porno',
  'video 18+', 'konten dewasa', 'adult content',
  'cerita dewasa', 'novel dewasa'
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
    .replace(/\$/g, 's');
}

function isWhitelisted(text) {
  const lower = text.toLowerCase();
  const WHITELIST = ['hackathon', 'lifehack', 'growthhack', 'crackers', 'cracker', 'nutcracker', 'cardigan', 'cardinal'];
  return WHITELIST.some(w => lower.includes(w));
}

function cekNiat(pesan) {
  if (!pesan || typeof pesan !== 'string') {
    return { ok: false, error: 'Invalid message' };
  }

  const lower = pesan.toLowerCase();
  const normalized = normalize(pesan);

  if (isWhitelisted(pesan)) {
    return { ok: true, category: 'whitelist' };
  }

  // LAPIS 1: Hard block — keyword eksplisit
  const HARD_BLOCK = ['hack', 'crack', 'carding', 'phishing', 'keylogger', 'narkoba', 'sabu', 'ganja', 'ekstasi', 'heroin', 'kokain', 'senjata api'];
  for (const kw of HARD_BLOCK) {
    if (lower.includes(kw) || normalized.includes(kw)) {
      return { ok: false, error: 'Blocked: prohibited content', layer: 1, keyword: kw };
    }
  }

  // LAPIS 2: Niat jahat — kombinasi korban + aksi
  for (const intent of MALICIOUS_INTENT) {
    if (intent.pattern.test(pesan)) {
      return { ok: false, error: 'Blocked: malicious intent detected', layer: 2, reason: intent.reason };
    }
  }

  // LAPIS 3: Kombinasi korban rentan + aksi seksual
  const hasVulnerable = VULNERABLE.some(v => lower.includes(v));
  const hasSexual = SEXUAL_ACTION.some(s => lower.includes(s));
  if (hasVulnerable && hasSexual) {
    // Cek apakah ini edukasi atau niat jahat
    const isEducational = /(edukasi|penjelasan|bahaya|bahayanya|dampak|hukum|uu|pasal)/i.test(pesan);
    if (!isEducational) {
      return { ok: false, error: 'Blocked: vulnerable subject + sexual content', layer: 3 };
    }
  }

  // LAPIS 4: 18+ legal
  for (const allowed of ADULT_ALLOWED) {
    if (lower.includes(allowed)) {
      return { ok: true, category: 'adult', keyword: allowed };
    }
  }

  // LAPIS 5: Kalo cuma "bokep" atau "porno" tanpa kombinasi jahat
  if (/(bokep|porno|18\+|dewasa|adult)/i.test(pesan)) {
    // Cek apakah ada konteks jahat
    const hasBadContext = /(anak|bocah|smp|sd|pelajar|bayi|paksa|paksa|tanpa izin|non-consent|dipaksa)/i.test(pesan);
    if (hasBadContext) {
      return { ok: false, error: 'Blocked: non-consensual or minor context', layer: 5 };
    }
    return { ok: true, category: 'adult' };
  }

  return { ok: true, category: 'normal' };
}

module.exports = { cekNiat, normalize, isWhitelisted };
