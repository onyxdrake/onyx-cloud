const { getDb, simpan } = require('./db');

function bikinPlayer(nama) {
  const db = getDb();
  const res = db.exec('SELECT id FROM sectors ORDER BY RANDOM() LIMIT 1');
  const sektorId = res[0].values[0][0];
  db.run('INSERT INTO players (nama, sektor_id) VALUES (?, ?)', [nama, sektorId]);
  const idRes = db.exec('SELECT last_insert_rowid() as id');
  const id = idRes[0].values[0][0];
  simpan();
  return id;
}

function ambilSumberDaya(playerId) {
  const db = getDb();
  const pRes = db.exec('SELECT * FROM players WHERE id = ?', [playerId]);
  const cols = pRes[0].columns;
  const vals = pRes[0].values[0];
  const player = {};
  cols.forEach((c, i) => player[c] = vals[i]);
  
  const sRes = db.exec('SELECT * FROM sectors WHERE id = ?', [player.sektor_id]);
  const sCols = sRes[0].columns;
  const sVals = sRes[0].values[0];
  const sektor = {};
  sCols.forEach((c, i) => sektor[c] = sVals[i]);
  
  const ambilBatu = Math.min(10, sektor.batu);
  const ambilMetal = Math.min(5, sektor.metal);
  const ambilEnergi = Math.min(3, sektor.energi);
  
  db.run('UPDATE sectors SET batu = batu - ?, metal = metal - ?, energi = energi - ? WHERE id = ?',
    [ambilBatu, ambilMetal, ambilEnergi, sektor.id]);
  db.run('UPDATE players SET batu = batu + ?, metal = metal + ?, energi = energi + ? WHERE id = ?',
    [ambilBatu, ambilMetal, ambilEnergi, playerId]);
  simpan();
  return { batu: ambilBatu, metal: ambilMetal, energi: ambilEnergi };
}

module.exports = { bikinPlayer, ambilSumberDaya };
