// core/billing.js
// Sistem billing: hitung biaya token, simpen balance, track usage

const fs = require('fs');
const ledger = require('./payment-ledger');
const path = require('path');

const BILLING_FILE = path.join(__dirname, '..', 'data', 'billing.json');

// HARGA GROQ (per 1M token, dalam USD)
const GROQ_PRICES = {
  'openai/gpt-oss-20b': { input: 0.10, output: 0.30 },
  'openai/gpt-oss-120b': { input: 0.15, output: 0.75 },
  'qwen/qwen3.8-27b': { input: 0.29, output: 0.59 },
  'default': { input: 0.15, output: 0.75 }
};

// HARGA CEREBRAS (per 1M token, dalam USD)
const CEREBRAS_PRICES = {
  'gpt-oss-120b': { input: 0.35, output: 0.75 },
  'qwen-3.8-27b': { input: 0.40, output: 0.80 },
  'default': { input: 0.35, output: 0.75 }
};

// MARKUP — berapa kali lo jual ke user (2.5x = 150% margin)
const MARKUP = 2.5;

// MULTIPLIER per mode (semakin kompleks, semakin boros token)
const MODE_MULTIPLIERS = {
  'chat': 1.0,          // chat ringan
  'coding': 1.5,        // butuh kode
  'reasoning': 3.0,     // think step-by-step
  'operator': 2.0,      // eksekusi tool
  'researcher': 5.0,    // banyak tool call
  'creator': 1.5,       // kreatif
  'expert': 4.0         // deep analysis
};

function loadBilling() {
  try { return JSON.parse(fs.readFileSync(BILLING_FILE, 'utf8')); }
  catch { return {}; }
}

function saveBilling(data) {
  const dir = path.dirname(BILLING_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BILLING_FILE, JSON.stringify(data, null, 2));
}

// Hitung biaya berdasarkan provider + model + usage
function hitungBiaya(provider, model, usage, mode = 'chat') {
  let prices = { input: 0, output: 0 };

  if (provider === 'groq') {
    prices = GROQ_PRICES[model] || GROQ_PRICES.default;
  } else if (provider === 'cerebras') {
    prices = CEREBRAS_PRICES[model] || CEREBRAS_PRICES.default;
  } else if (provider === 'local') {
    return { cost: 0, sell: 0, margin: 0 }; // lokal gratis
  }

  const inputCost = (usage.prompt_tokens || 0) / 1_000_000 * prices.input;
  const outputCost = (usage.completion_tokens || 0) / 1_000_000 * prices.output;
  const totalCost = inputCost + outputCost;
  const modeMultiplier = MODE_MULTIPLIERS[mode] || 1.0;
  const sellPrice = totalCost * MARKUP * modeMultiplier;

  return {
    cost: totalCost,        // biaya ke Groq/Cerebras
    sell: sellPrice,        // harga jual ke user
    margin: sellPrice - totalCost
  };
}

// Catat usage user
function catatUsage(userId, usage, provider, model = 'default', mode = 'chat') {
  const all = loadBilling();
  if (!all[userId]) {
    all[userId] = {
      userId,
      balance: 0,          // saldo USD (yang user bayar)
      totalUsed: 0,        // total biaya ke provider
      totalCharged: 0,     // total yang lo charge ke user
      totalMargin: 0,      // profit lo
      usageHistory: []
    };
  }

  const harga = hitungBiaya(provider, model, usage, mode);

  all[userId].balance -= harga.sell;
  all[userId].totalUsed += harga.cost;
  all[userId].totalCharged += harga.sell;
  all[userId].totalMargin += harga.margin;

  // Simpen history (max 100)
  all[userId].usageHistory.push({
    time: Date.now(),
    provider,
    model,
    tokens: usage,
    cost: harga.cost,
    sell: harga.sell
  });
  if (all[userId].usageHistory.length > 100) {
    all[userId].usageHistory = all[userId].usageHistory.slice(-100);
  }

  saveBilling(all);

  // Catat ke ledger (double-write, biar aman)
  try {
    ledger.catat(userId, 'usage', -harga.sell, {
      provider,
      model,
      tokens: usage,
      cost: harga.cost,
      margin: harga.margin
    });
  } catch (e) {
    console.error('[Billing] Ledger catat gagal:', e.message);
  }

  return all[userId];
}

// Top-up balance (dari payment user)
function topupBalance(userId, amountUsd, source = 'manual') {
  const all = loadBilling();
  if (!all[userId]) {
    all[userId] = {
      userId, balance: 0, totalUsed: 0, totalCharged: 0, totalMargin: 0, usageHistory: []
    };
  }
  all[userId].balance += amountUsd;
  all[userId].topupHistory = all[userId].topupHistory || [];
  all[userId].topupHistory.push({ time: Date.now(), amount: amountUsd, source });
  saveBilling(all);

  // Catat ke ledger
  try {
    ledger.catat(userId, 'topup', amountUsd, { source });
  } catch (e) {
    console.error('[Billing] Ledger topup gagal:', e.message);
  }

  return all[userId];
}

// Ambil billing user
function getBilling(userId) {
  const all = loadBilling();
  return all[userId] || { userId, balance: 0, totalUsed: 0, totalCharged: 0, totalMargin: 0 };
}

// Cek cukup gak balance
function cekBalance(userId, estimasiBiaya = 0.01) {
  const b = getBilling(userId);
  if (b.balance < estimasiBiaya) {
    return { ok: false, balance: b.balance, error: 'Saldo habis. Top-up dulu.' };
  }
  return { ok: true, balance: b.balance };
}

module.exports = {
  MODE_MULTIPLIERS,
  hitungBiaya,
  catatUsage,
  topupBalance,
  getBilling,
  cekBalance,
  GROQ_PRICES,
  CEREBRAS_PRICES,
  MARKUP
};
