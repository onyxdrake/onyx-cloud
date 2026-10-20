// core/solana-payment.js
// Terima USDC Solana — polling otomatis

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { kirimNotifTransaksi } = require('./notif-transaksi');

const PAYMENTS_FILE = path.join(__dirname, '..', 'data', 'crypto-payments.json');
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

function loadPayments() {
  try { return JSON.parse(fs.readFileSync(PAYMENTS_FILE, 'utf8')); }
  catch { return {}; }
}

function savePayments(data) {
  const dir = path.dirname(PAYMENTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(data, null, 2));
}

const PAKET_HARGA = {
  basic: 2.5,
  premium: 7,
  pro: 25,
  enterprise: 100
};

// Bikin order baru
function buatOrder(userId, email, paket) {
  const payments = loadPayments();
  const orderId = 'ord_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const amount = PAKET_HARGA[paket];

  if (!amount) return { error: 'Paket gak valid' };

  payments[orderId] = {
    orderId,
    userId,
    email,
    paket,
    amountUsdc: amount,
    wallet: process.env.WALLET_ADDRESS,
    usdcMint: process.env.USDC_MINT,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000, // 30 menit
    status: 'pending',
    memo: 'ONYX-' + orderId.slice(-8).toUpperCase()
  };

  savePayments(payments);
  return payments[orderId];
}

// Cek transaksi masuk ke wallet
async function cekTransaksiMasuk() {
  const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
  const WALLET = process.env.WALLET_ADDRESS;

  if (!WALLET || WALLET.length < 40) return [];

  try {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [WALLET, { limit: 20 }]
      }),
      signal: AbortSignal.timeout(10000)
    });
    const d = await r.json();
    if (!d.result) return [];
    return d.result.map(tx => tx.signature);
  } catch (e) {
    console.error('[Solana] RPC error:', e.message);
    return [];
  }
}

// Verifikasi transaksi USDC
async function verifikasiTransaksi(signature) {
  const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
  const WALLET = process.env.WALLET_ADDRESS;
  const USDC_MINT = process.env.USDC_MINT;

  try {
    const r = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
      }),
      signal: AbortSignal.timeout(10000)
    });
    const d = await r.json();
    if (!d.result) return null;

    const tx = d.result;
    const meta = tx.meta;
    if (!meta || meta.err) return null;

    const preBalances = meta.preTokenBalances || [];
    const postBalances = meta.postTokenBalances || [];

    for (const post of postBalances) {
      if (post.mint === USDC_MINT && post.owner === WALLET) {
        const pre = preBalances.find(p => p.accountIndex === post.accountIndex);
        const preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmount) : 0;
        const postAmount = parseFloat(post.uiTokenAmount.uiAmount);
        const diff = postAmount - preAmount;

        if (diff > 0) {
          return {
            amount: diff,
            signature,
            slot: tx.slot,
            blockTime: tx.blockTime
          };
        }
      }
    }
    return null;
  } catch (e) {
    console.error('[Solana] Verify error:', e.message);
    return null;
  }
}

// Upgrade user
async function upgradeUser(userId, paket) {
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));

  for (const email in users) {
    if (users[email].userId === userId || email === userId) {
      users[email].tier = paket;
      users[email].subscriptionStart = Date.now();
      users[email].subscriptionExpires = Date.now() + 30 * 24 * 60 * 60 * 1000;
      users[email].updatedAt = Date.now();
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
      console.log(`✅ User ${email} upgraded ke ${paket}`);
      return { ok: true, email };
    }
  }
  return { ok: false };
}

// Polling
async function pollPendingOrders() {
  const payments = loadPayments();
  const signatures = await cekTransaksiMasuk();

  for (const sig of signatures) {
    // Skip kalau udah diproses
    const already = Object.values(payments).find(p => p.signature === sig);
    if (already) continue;

    const tx = await verifikasiTransaksi(sig);
    if (!tx) continue;

    // Cari order yang cocok
    const pendingOrders = Object.values(payments).filter(
      p => p.status === 'pending' && Math.abs(p.amountUsdc - tx.amount) < 0.01
    );

    if (pendingOrders.length > 0) {
      const order = pendingOrders[0];
      order.status = 'paid';
      order.signature = sig;
      order.paidAt = Date.now();
      order.txAmount = tx.amount;
      savePayments(payments);

      // Upgrade user
      const hasil = await upgradeUser(order.userId, order.paket);

      // Kirim notif
      try {
        await kirimNotifTransaksi({
          userId: order.userId,
          email: order.email || hasil.email,
          paket: order.paket,
          amount: order.amountUsdc,
          signature: sig,
          wallet: process.env.WALLET_ADDRESS,
          network: 'solana',
          timestamp: order.paidAt
        });
      } catch (e) {
        console.error('Notif error:', e.message);
      }

      console.log(`✅ Payment: ${order.email} → ${order.paket}`);
    }
  }
}

function cekOrder(orderId) {
  const payments = loadPayments();
  return payments[orderId] || null;
}

function startPolling() {
  console.log('🔄 Solana payment polling aktif (tiap 30 detik)');
  setInterval(pollPendingOrders, 30000);
  // Langsung poll sekali waktu start
  setTimeout(pollPendingOrders, 5000);
}


// Kasih bonus ke referrer (1% dari paket)
function kasihBonusReferral(userId, paket, amount) {
  const REFERRAL_FILE = path.join(__dirname, '..', 'data', 'referrals.json');
  const BILLING_FILE = path.join(__dirname, '..', 'data', 'billing.json');

  let referrals = {};
  try { referrals = JSON.parse(fs.readFileSync(REFERRAL_FILE, 'utf8')); }
  catch { return { ok: false }; }

  // Cari referrer
  const referrerId = Object.keys(referrals).find(k => referrals[k].referrals?.includes(userId));
  if (!referrerId) return { ok: false, error: 'No referrer' };

  // Bonus 1%
  const bonus = amount * 0.01;

  let billing = {};
  try { billing = JSON.parse(fs.readFileSync(BILLING_FILE, 'utf8')); }
  catch {}

  if (!billing[referrerId]) billing[referrerId] = { balance: 0 };
  billing[referrerId].balance += bonus;
  fs.writeFileSync(BILLING_FILE, JSON.stringify(billing, null, 2));

  // Update referral stats
  referrals[referrerId].count = (referrals[referrerId].count || 0) + 1;
  referrals[referrerId].earned = (referrals[referrerId].earned || 0) + bonus;
  fs.writeFileSync(REFERRAL_FILE, JSON.stringify(referrals, null, 2));

  console.log(`✅ Bonus referral $${bonus} ke ${referrerId}`);
  return { ok: true, bonus, referrerId };
}

module.exports = {
  kasihBonusReferral,
  buatOrder,
  cekOrder,
  upgradeUser,
  startPolling,
  cekTransaksiMasuk,
  verifikasiTransaksi
};
