const express = require('express');
const fs = require('fs');
const { initDb, getDb } = require('./db');
const { initSektor } = require('./sector');
const { bangun, RESEP } = require('./building');
const { bikinPlayer, ambilSumberDaya } = require('./player');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

const SYSTEM = fs.readFileSync('./system.txt', 'utf8');

app.post('/api/chat', async (req, res) => {
  const pesan = req.body.pesan;
  try {
    const r = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'onyx',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: pesan }
        ],
        max_tokens: 512,
        temperature: 0.7
      })
    });
    const data = await r.json();
    const balasan = data.choices?.[0]?.message?.content || 'Gak ada balasan.';
    res.json({ balasan });
  } catch (e) {
    res.json({ balasan: 'Error: ' + e.message });
  }
});

async function start() {
  await initDb();
  initSektor();

  app.post('/api/player', (req, res) => {
    const id = bikinPlayer(req.body.nama);
    res.json({ id });
  });

  app.get('/api/player/:id', (req, res) => {
    const db = getDb();
    const r = db.exec('SELECT * FROM players WHERE id = ?', [req.params.id]);
    if (!r[0]) return res.json({ error: 'gak ada' });
    const cols = r[0].columns;
    const vals = r[0].values[0];
    const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    res.json(obj);
  });

  app.post('/api/ambil', (req, res) => {
    res.json(ambilSumberDaya(req.body.playerId));
  });

  app.post('/api/bangun', (req, res) => {
    res.json(bangun(req.body.playerId, req.body.sektorId, req.body.tipe));
  });

  app.get('/api/resep', (req, res) => {
    res.json(RESEP);
  });

  app.listen(3000, () => console.log('Server di http://localhost:3000'));
}

start();
