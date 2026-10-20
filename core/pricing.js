// core/pricing.js
// Custom tier builder — user pilih fitur, harga dihitung

const FEATURE_PRICES = {
  // AI Chat
  chat_free: { price: 0, label: 'Chat AI - Free (20/hari)' },
  chat_basic: { price: 1.5, label: 'Chat AI - Basic (100/hari)' },
  chat_premium: { price: 4, label: 'Chat AI - Premium (500/hari)' },
  chat_pro: { price: 12, label: 'Chat AI - Pro (2000/hari)' },

  // Gambar
  image_basic: { price: 0.5, label: 'Gambar - 20/hari (antri)' },
  image_premium: { price: 2, label: 'Gambar - 100/hari (no antri)' },
  image_pro: { price: 5, label: 'Gambar - 500/hari (no antri, priority)' },

  // OTP
  otp_100: { price: 1, label: 'OTP - 100/bulan' },
  otp_1000: { price: 7, label: 'OTP - 1.000/bulan' },
  otp_10000: { price: 50, label: 'OTP - 10.000/bulan' },

  // API Key
  apikey_1: { price: 0.5, label: '1 API Key' },
  apikey_5: { price: 2, label: '5 API Key' },
  apikey_20: { price: 6, label: '20 API Key' },

  // QR
  qr_basic: { price: 0.5, label: 'QR Generator - 100/bulan' },
  qr_pro: { price: 3, label: 'QR Generator - 10.000/bulan' },

  // Payment
  payment_link: { price: 3, label: 'Payment Link (1% fee)' }
};

function hitungHarga(fitur = []) {
  let total = 0;
  const breakdown = [];

  for (const id of fitur) {
    const f = FEATURE_PRICES[id];
    if (f) {
      total += f.price;
      breakdown.push({ id, ...f });
    }
  }

  // Discount kalau user pilih paket lengkap
  if (fitur.length >= 5) total *= 0.9; // 10% off
  if (fitur.length >= 8) total *= 0.8; // 20% off

  return {
    total: Math.round(total * 100) / 100,
    breakdown,
    discount: fitur.length >= 5 ? (fitur.length >= 8 ? '20%' : '10%') : '0%'
  };
}

module.exports = { FEATURE_PRICES, hitungHarga };
