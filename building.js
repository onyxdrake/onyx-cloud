const { getDb, simpan } = require('./db');

const RESEP = {
  tambang_batu:   { batu: 0,   metal: 20,  energi: 0,  produksi: 'batu' },
  tambang_metal:  { batu: 30,  metal: 0,   energi: 0,  produksi: 'metal' },
  kilang_energi:  { batu: 40,  metal: 10,  energi: 0,  produksi: 'energi' },
  barak:          { batu: 50,  metal: 20,  energi: 0,  produksi: 'tentara' },
  gudang:         { batu: 30,  metal: 15,  energi: 0,  produksi: 'kapasitas' },
  pabrik_metal:   { batu: 60,  metal: 30,  energi: 5,  produksi: 'metal' },
  pabrik_senjata: { batu: 0,   metal: 80,  energi: 20, produksi: 'senjata' },
  lab_riset:      { batu: 100, metal: 50,  energi: 30, produksi: 'riset' },
  menara_radar:   { batu: 0,   metal: 40,  energi: 20, produksi: 'deteksi' },
  dermaga:        { batu: 70,  metal: 40,  energi: 0,  produksi: 'kapal' },
  rumah_sakit:    { batu: 50,  metal: 30,  energi: 10, produksi: 'heal' },
  pasar:          { batu: 40,  metal: 20,  energi: 0,  produksi: 'trade' },
  benteng:        { batu: 120, metal: 60,  energi: 0,  produksi: 'defense' },
  pabrik_chip:    { batu: 0,   metal: 100, energi: 50, produksi: 'chip' },
  markas_faksi:   { batu: 200, metal: 100, energi: 50, produksi: 'faksi' }
};

function getPlayer(id) {
  const db = getDb();
  const res = db.exec('SELECT * FROM players WHERE id = ?', [id]);
  if (!res[0]) return null;
  const cols = res[0].columns;
  const vals = res[0].values[0];
  const obj = {};
  cols.forEach((c, i) => obj[c] = vals[i]);
  return obj;
}

function bangun(playerId, sektorId, tipe) {
  const db = getDb();
  const player = getPlayer(playerId);
  const resep = RESEP[tipe];
  if (!resep) return { error: 'Bangunan gak dikenal' };
  if (player.batu < resep.batu || player.metal < resep.metal || player.energi < resep.energi) {
    return { error: 'Material kurang' };
  }
  db.run('UPDATE players SET batu = batu - ?, metal = metal - ?, energi = energi - ? WHERE id = ?',
    [resep.batu, resep.metal, resep.energi, playerId]);
  db.run('INSERT INTO buildings (sektor_id, tipe) VALUES (?, ?)', [sektorId, tipe]);
  simpan();
  return { sukses: true, tipe };
}

module.exports = { bangun, RESEP };
