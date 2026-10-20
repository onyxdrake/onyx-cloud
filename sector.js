const { getDb, simpan } = require('./db');

function bikinSektor(x, y) {
  const db = getDb();
  const batu = Math.floor(Math.random() * 500) + 500;
  const metal = Math.floor(Math.random() * 300) + 200;
  const energi = Math.floor(Math.random() * 200) + 100;
  db.run('INSERT INTO sectors (x, y, batu, metal, energi) VALUES (?, ?, ?, ?, ?)',
    [x, y, batu, metal, energi]);
}

function initSektor() {
  const db = getDb();
  const result = db.exec('SELECT COUNT(*) as total FROM sectors');
  const total = result[0]?.values[0][0] || 0;
  if (total > 0) return;
  for (let x = 0; x < 40; x++) {
    for (let y = 0; y < 40; y++) {
      bikinSektor(x, y);
    }
  }
  simpan();
  console.log('1600 sektor dibuat.');
}

module.exports = { initSektor };
