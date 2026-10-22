require('dotenv').config();
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.NETLIFY_TOKEN;
const SITE_ID = 'isi-site-id-netlify-lo'; // ⚠️ GANTI DENGAN SITE ID LO

if (!TOKEN) {
  console.error('❌ NETLIFY_TOKEN tidak ada di .env');
  process.exit(1);
}

async function updateStatus() {
  const statusPath = path.join(__dirname, 'public', 'status.json');
  const data = JSON.parse(fs.readFileSync(statusPath, 'utf8'));

  // Update waktu
  data.updated = new Date().toISOString();

  fs.writeFileSync(statusPath, JSON.stringify(data, null, 2));
  console.log('📝 File status.json di-update.');

  // Kirim ke Netlify
  console.log('🚀 Uploading to Netlify...');
  
  // Netlify API buat deploy file
  const res = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: {
        "/status.json": Buffer.from(JSON.stringify(data, null, 2)).toString('base64')
      }
    })
  });

  const result = await res.json();
  if (result.error) {
    console.error('❌ Gagal update Netlify:', result.error);
  } else {
    console.log('✅ Netlify status berhasil di-update!');
    console.log('🔗 Cek di: https://' + result.ssl_url + '/status.json');
  }
}

updateStatus();
