// core/self-heal.js
// Auto-recovery system — server gak mati kalau ada error

const fs = require('fs');
const path = require('path');

const HEAL_LOG = path.join(__dirname, '..', 'data', 'self-heal.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(HEAL_LOG, line); } catch {}
  console.log(`[SelfHeal] ${msg}`);
}

// Handle uncaught errors biar server gak crash
function init() {
  process.on('uncaughtException', (err) => {
    log(`UNCAUGHT: ${err.message}\n${err.stack}`);
    // Jangan exit — biar server tetep jalan
  });

  process.on('unhandledRejection', (reason, promise) => {
    log(`UNHANDLED PROMISE: ${reason}`);
  });

  log('✅ Self-heal aktif');
}

module.exports = { init, log };
