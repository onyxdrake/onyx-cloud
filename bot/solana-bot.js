require('dotenv').config();
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const payments = require('../core/payments');
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');

const RPC_LIST = [
  process.env.SOLANA_RPC_PRIMARY || 'https://solana-rpc.publicnode.com',
  process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana'
];

const SEED_PHRASE = process.env.SEED_PHRASE;
const USDC_MINT = process.env.USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

if (!SEED_PHRASE) {
  console.error('❌ SEED_PHRASE belum di-set.');
  process.exit(1);
}

const seed = mnemonicToSeedSync(SEED_PHRASE);
const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
const keypair = Keypair.fromSeed(derivedSeed);
const walletPubkey = keypair.publicKey;

let rpcIndex = 0;
let requestCount = 0;
const LIMIT_PER_10S = 40;

setInterval(() => { requestCount = 0; }, 10000);

function getConnection() {
  if (requestCount >= LIMIT_PER_10S) {
    rpcIndex = (rpcIndex + 1) % RPC_LIST.length;
    requestCount = 0;
    console.log(`⚠️  Limit tercapai. Pindah RPC: ${RPC_LIST[rpcIndex]}`);
  }
  requestCount++;
  return new Connection(RPC_LIST[rpcIndex], 'confirmed');
}

async function cekTransaksi() {
  const connection = getConnection();
  console.log(`[RPC ${rpcIndex}] Request #${requestCount}`);

  try {
    const signatures = await connection.getSignaturesForAddress(walletPubkey, { limit: 10 });
    const db = payments.getDb();

    for (const sig of signatures) {
      const existing = db.exec(`SELECT * FROM payments WHERE tx_signature = '${sig.signature}'`);
      if (existing[0]?.values?.length) continue;

      const tx = await connection.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
      if (!tx || !tx.meta) continue;

      const preBalances = tx.meta.preTokenBalances || [];
      const postBalances = tx.meta.postTokenBalances || [];

      for (const post of postBalances) {
        if (post.mint !== USDC_MINT) continue;
        if (post.owner !== walletPubkey.toString()) continue;

        const pre = preBalances.find(p => p.accountIndex === post.accountIndex);
        const preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmount || 0) : 0;
        const postAmount = parseFloat(post.uiTokenAmount.uiAmount || 0);
        const diff = postAmount - preAmount;

        if (diff > 0) {
          const memo = tx.transaction.message.instructions
            .map(i => i.parsed?.info?.memo || '')
            .filter(Boolean)
            .join(' ');

          console.log(`💰 ${diff} USDC | Memo: ${memo || '-'}`);

          let userId = null;
          if (memo) {
            const match = memo.match(/ONYX-([a-f0-9]{16})/i);
            if (match) userId = match[1];
          }

          payments.recordPayment(userId || 'UNKNOWN', sig.signature, diff, USDC_MINT, '', memo);

          if (userId) {
            payments.verifyPayment(sig.signature);
            console.log(`✅ User ${userId} → premium`);
          }
        }
      }
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
    rpcIndex = (rpcIndex + 1) % RPC_LIST.length;
  }
}

async function main() {
  await payments.initDb();
  console.log('🤖 Bot Solana jalan...');
  console.log('👛 Wallet:', walletPubkey.toString());
  console.log('🔌 RPC:', RPC_LIST.join(', '));
  console.log('🔄 Cek tiap 30 detik...\n');

  await cekTransaksi();
  setInterval(cekTransaksi, 30000);
}

main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });
