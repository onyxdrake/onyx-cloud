const crypto = require('crypto');

// KUNCI RAHASIA INI HANYA BOLEH ADA DI SERVER LO!
// JANGAN PERNAH TARO DI KODE HTML/JS CLIENT!
const SERVER_SECRET = process.env.ADMIN_KEY || 'onyx-default-secret-change-me';

function generateSignature(payload) {
  // Bikin tanda tangan berdasarkan data + kunci rahasia
  return crypto.createHmac('sha256', SERVER_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
}

function verifySignature(payload, signature) {
  const expected = generateSignature(payload);
  return expected === signature;
}

module.exports = { generateSignature, verifySignature };
