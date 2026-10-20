// core/osint.js
// OSINT lookup — phone, email, IP

async function lookupPhone(phone) {
  // Bersihin nomor
  const clean = phone.replace(/[^0-9+]/g, '');
  const code = clean.startsWith('+') ? clean.slice(1, 3) : clean.slice(0, 2);

  // Database operator Indonesia (kasar)
  const operatorMap = {
    '628': 'Telkomsel',
    '6281': 'Telkomsel',
    '6282': 'Telkomsel',
    '6285': 'Telkomsel',
    '6287': 'Telkomsel',
    '6288': 'Telkomsel',
    '6289': 'Telkomsel',
    '6281': 'Telkomsel',
    '6285': 'Telkomsel',
    '62858': 'Telkomsel',
    '62859': 'Telkomsel',
    '62811': 'Telkomsel',
    '62812': 'Telkomsel',
    '62813': 'Telkomsel',
    '62821': 'Telkomsel',
    '62822': 'Telkomsel',
    '62823': 'Telkomsel',
    '62851': 'Telkomsel',
    '62852': 'Telkomsel',
    '62853': 'Telkomsel',
    '62855': 'Telkomsel',
    '62856': 'Telkomsel',
    '62857': 'Telkomsel',
    '62858': 'Telkomsel',
    '62859': 'Telkomsel',
  };

  let operator = 'Unknown';
  for (const [prefix, name] of Object.entries(operatorMap)) {
    if (clean.startsWith(prefix)) {
      operator = name;
      break;
    }
  }

  return {
    nomor: clean,
    negara: clean.startsWith('62') ? 'Indonesia' : 'Unknown',
    operator,
    timezone: clean.startsWith('62') ? 'Asia/Jakarta' : 'Unknown',
    tipe: 'Mobile'
  };
}

async function lookupIP(ip) {
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,regionName,isp,timezone,query`);
    const d = await r.json();
    if (d.status !== 'success') return { error: 'IP gak kedeteksi' };
    return d;
  } catch (e) {
    return { error: e.message };
  }
}

async function lookupEmail(email) {
  const domain = email.split('@')[1];
  if (!domain) return { error: 'Email invalid' };

  // Cek MX record sederhana
  const disposable = ['tempmail.com', 'guerrillamail.com', '10minutemail.com', 'mailinator.com', 'throwaway.com'];

  return {
    email,
    domain,
    disposable: disposable.includes(domain.toLowerCase()),
    tipe: disposable.includes(domain.toLowerCase()) ? 'Temporary' : 'Permanent'
  };
}

module.exports = { lookupPhone, lookupIP, lookupEmail };
