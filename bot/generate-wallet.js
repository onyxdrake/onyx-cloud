require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// BIP39 wordlist (2048 kata)
const { generateMnemonic, mnemonicToSeedSync, validateMnemonic } = require('bip39');
const { Keypair } = require('@solana/web3.js');
const { derivePath } = require('ed25519-hd-key');

const ENV_FILE = path.join(__dirname, '..', '.env');

function generateWallet() {
  console.log('🔐 Generate wallet baru...\n');

  // 1. Generate mnemonic 12 kata
  const mnemonic = generateMnemonic(128); // 128 bit = 12 kata
  console.log('📝 Seed Phrase (SIMPEN BAIK-BAIK):');
  console.log('   ' + mnemonic + '\n');

  // 2. Convert mnemonic ke seed
  const seed = mnemonicToSeedSync(mnemonic);

  // 3. Derive Solana keypair (path: m/44'/501'/0'/0')
  const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
  const keypair = Keypair.fromSeed(derivedSeed);

  const publicKey = keypair.publicKey.toString();
  const secretKey = Buffer.from(keypair.secretKey).toString('hex');

  console.log('👛 Wallet Address:', publicKey);
  console.log('🔑 Private Key (JANGAN DIBAGI):', secretKey.slice(0, 20) + '...\n');

  // 4. Simpen ke .env
  let env = fs.readFileSync(ENV_FILE, 'utf8');

  // Ganti atau tambah SEED_PHRASE
  if (env.includes('SEED_PHRASE=')) {
    env = env.replace(/SEED_PHRASE=.*/g, `SEED_PHRASE=${mnemonic}`);
  } else {
    env += `\nSEED_PHRASE=${mnemonic}\n`;
  }

  // Ganti atau tambah WALLET_ADDRESS
  if (env.includes('WALLET_ADDRESS=')) {
    env = env.replace(/WALLET_ADDRESS=.*/g, `WALLET_ADDRESS=${publicKey}`);
  } else {
    env += `WALLET_ADDRESS=${publicKey}\n`;
  }

  // Ganti atau tambah PRIVATE_KEY
  if (env.includes('PRIVATE_KEY=')) {
    env = env.replace(/PRIVATE_KEY=.*/g, `PRIVATE_KEY=${secretKey}`);
  } else {
    env += `PRIVATE_KEY=${secretKey}\n`;
  }

  fs.writeFileSync(ENV_FILE, env);

  console.log('✅ Seed phrase & wallet address disimpen ke .env');
  console.log('⚠️  BACKUP seed phrase di kertas! Jangan cuma di HP!\n');

  return { mnemonic, publicKey, secretKey };
}

// Cek kalo udah ada wallet
function cekWallet() {
  const env = fs.readFileSync(ENV_FILE, 'utf8');
  const match = env.match(/WALLET_ADDRESS=(.+)/);
  return match ? match[1].trim() : null;
}

// Main
const existing = cekWallet();
if (existing && !process.argv.includes('--force')) {
  console.log('⚠️  Wallet udah ada:', existing);
  console.log('   Kalo mau generate ulang, jalanin: node bot/generate-wallet.js --force');
  process.exit(0);
}

generateWallet();
