let isOnline = true;
let gagalCount = 0;

async function cekServer() {
  try {
    const res = await fetch('/api/ping', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      isOnline = true;
      gagalCount = 0;
      return;
    }
  } catch (e) {}

  gagalCount++;
  if (isOnline) isOnline = false;

  // Kalau 3x gagal berturut-turut, redirect ke offline.html
  if (gagalCount >= 3 && !window.location.pathname.includes('offline.html')) {
    window.location.href = '/offline.html';
  }
}

setInterval(cekServer, 10000);
cekServer();
