const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'pardus.db');

let db = null;
let SQL = null;

async function initDb() {
  SQL = await initSqlJs();
  
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS sectors (
      id INTEGER PRIMARY KEY,
      x INTEGER, y INTEGER,
      batu INTEGER DEFAULT 1000,
      metal INTEGER DEFAULT 500,
      energi INTEGER DEFAULT 300
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY,
      nama TEXT,
      sektor_id INTEGER,
      batu INTEGER DEFAULT 200,
      metal INTEGER DEFAULT 100,
      energi INTEGER DEFAULT 50
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS buildings (
      id INTEGER PRIMARY KEY,
      sektor_id INTEGER,
      tipe TEXT,
      level INTEGER DEFAULT 1
    );
  `);
  
  simpan();
  console.log('Database siap.');
}

function simpan() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

function getDb() {
  return db;
}

module.exports = { initDb, getDb, simpan };
