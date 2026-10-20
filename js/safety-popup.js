// Safety Popup — Muncul sekali sampai user klik "Lanjut"
(function() {
  const KEY = 'onyx_safety_ok';
  const EXPIRE_DAYS = 30;

  // Cek apakah user udah pernah konfirmasi
  const lastOk = localStorage.getItem(KEY);
  if (lastOk) {
    const umur = Date.now() - parseInt(lastOk);
    if (umur < EXPIRE_DAYS * 24 * 60 * 60 * 1000) return;
  }

  // Skip di halaman tertentu
  const skip = ['/safety.html', '/admin.html'];
  if (skip.includes(window.location.pathname)) return;

  // Bikin popup
  const host = window.location.hostname;
  const vtUrl = 'https://www.virustotal.com/gui/domain/' + host;

  const overlay = document.createElement('div');
  overlay.id = 'onyx-safety-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.85);
    z-index: 99999; display: flex; align-items: center; justify-content: center;
    padding: 20px; font-family: -apple-system, sans-serif;
  `;

  overlay.innerHTML = `
    <div style="background:#141414;border:1px solid #1f1f1f;border-radius:16px;padding:24px;max-width:400px;width:100%;color:#eee;">
      <h2 style="color:#0f0;font-size:18px;margin-bottom:12px;">🛡️ Quick Safety Check</h2>
      <p style="font-size:13px;color:#aaa;line-height:1.6;margin-bottom:16px;">
        Sebelum lanjut, kamu bisa cek dulu apakah domain ini aman. Opsional — gak wajib.
      </p>
      <div style="background:#0a0a0a;border-radius:10px;padding:12px;margin-bottom:16px;">
        <div style="font-size:11px;color:#666;margin-bottom:4px;">Domain</div>
        <code style="color:#0f0;font-size:12px;word-break:break-all;">${host}</code>
      </div>
      <a href="${vtUrl}" target="_blank" rel="noopener"
         style="display:block;background:#1a2a3a;color:#4af;padding:12px;border-radius:10px;text-decoration:none;font-size:13px;text-align:center;margin-bottom:12px;">
        🔍 Cek di VirusTotal (opsional)
      </a>
      <div style="display:flex;gap:10px;">
        <button id="onyx-safety-exit" style="flex:1;background:#1a1a1a;color:#888;border:1px solid #333;padding:12px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;">Keluar</button>
        <button id="onyx-safety-next" style="flex:1;background:#0f0;color:#000;border:none;padding:12px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">Lanjut</button>
      </div>
      <p style="font-size:10px;color:#555;text-align:center;margin-top:14px;">Pilihan ini disimpan 30 hari. Gak muncul lagi setelah ini.</p>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('onyx-safety-next').onclick = () => {
    localStorage.setItem(KEY, Date.now().toString());
    overlay.remove();
  };

  document.getElementById('onyx-safety-exit').onclick = () => {
    window.location.href = 'https://www.google.com';
  };
})();
