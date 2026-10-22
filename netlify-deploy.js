require('dotenv').config();
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.NETLIFY_TOKEN;
if (!TOKEN) {
  console.error('❌ NETLIFY_TOKEN gak ada di .env');
  process.exit(1);
}

async function deployToNetlify() {
  console.log('🚀 Mulai deploy ke Netlify...');

  // 1. Ambil daftar situs, cari yang namanya "onyx-cloud"
  let siteId = null;
  try {
    const res = await fetch('https://api.netlify.com/api/v1/sites', {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    });
    const sites = await res.json();
    const onyxSite = sites.find(s => s.name.includes('onyx'));
    
    if (onyxSite) {
      siteId = onyxSite.id;
      console.log('✅ Situs Netlify ditemukan:', onyxSite.ssl_url);
    }
  } catch (e) {
    console.error('Error cek situs:', e.message);
  }

  // 2. Kalau belum ada, bikin situs baru
  if (!siteId) {
    console.log('🌐 Bikin situs Netlify baru...');
    const res = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'onyx-cloud-' + Date.now() })
    });
    const newSite = await res.json();
    siteId = newSite.id;
    console.log('✅ Situs baru dibuat:', newSite.ssl_url);
  }

  // 3. Siapin file buat di-upload (HTML & JSON)
  console.log('📦 Mempersiapkan file...');
  const publicDir = path.join(__dirname, 'public');
  const files = {};

  // Upload index.html (Landing Page)
  if (fs.existsSync(path.join(publicDir, 'index.html'))) {
    files['/index.html'] = fs.readFileSync(path.join(publicDir, 'index.html')).toString('base64');
  }

  // Upload download.html (Halaman APK)
  if (fs.existsSync(path.join(publicDir, 'download.html'))) {
    files['/download.html'] = fs.readFileSync(path.join(publicDir, 'download.html')).toString('base64');
  }

  // Upload status.json (Info Online/Offline)
  if (fs.existsSync(path.join(publicDir, 'status.json'))) {
    files['/status.json'] = fs.readFileSync(path.join(publicDir, 'status.json')).toString('base64');
  }

  // 4. Deploy!
  console.log('☁️  Upload ke Netlify...');
  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ files })
  });

  const deploy = await deployRes.json();
  if (deploy.error) {
    console.error('❌ Gagal deploy:', deploy.error);
  } else {
    console.log('✅ Sukses! Web Onyx sekarang online di Netlify:');
    console.log('🔗 ' + deploy.ssl_url);
    console.log('🔗 Link Download: ' + deploy.ssl_url + '/download.html');
  }
}

deployToNetlify();
