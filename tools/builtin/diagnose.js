// tools/builtin/diagnose.js
// Tool buat AI cek kesehatan sistem Onyx

require('dotenv').config();
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'diagnose',
  description: 'Cek kesehatan sistem Onyx: server, model AI, OAuth, file, user. Args: { area: "all"|"oauth"|"model"|"files"|"users" }',
  async run(args) {
    const area = args.area || 'all';
    const hasil = {};

    // 1. Cek file penting
    if (area === 'all' || area === 'files') {
      const files = [
        'server.js', 'core/router.js', 'core/agent.js', 'core/i18n.js',
        'core/verify.js', 'core/user-id.js', 'core/limits.js',
        'api/oauth.js', 'api/index.js', 'api/health.js', 'api/safety.js',
        'data/users.json', 'data/oauth-tokens.json', 'data/verify-codes.json',
        '.env'
      ];
      hasil.files = {};
      for (const f of files) {
        const p = path.join(__dirname, '..', '..', f);
        hasil.files[f] = fs.existsSync(p) ? '✅' : '❌ MISSING';
      }
    }

    // 2. Cek model AI
    if (area === 'all' || area === 'model') {
      hasil.models = {};
      // Cek lokal
      try {
        const r = await fetch('http://127.0.0.1:8080/v1/models', { signal: AbortSignal.timeout(3000) });
        hasil.models.local = r.ok ? '✅ online' : '⚠️ status ' + r.status;
      } catch (e) {
        hasil.models.local = '❌ offline (' + e.message + ')';
      }
      // Cek Groq
      hasil.models.groq = process.env.GROQ_API_KEY ? '✅ key ada' : '❌ key kosong';
      // Cek Cerebras
      hasil.models.cerebras = process.env.CEREBRAS_API_KEY ? '✅ key ada' : '❌ key kosong';
    }

    // 3. Cek OAuth
    if (area === 'all' || area === 'oauth') {
      hasil.oauth = {};
      const providers = ['github', 'google', 'spotify', 'notion', 'slack', 'netlify'];
      for (const p of providers) {
        const key = p.toUpperCase() + '_OAUTH_CLIENT_ID';
        const keyAlt = p.toUpperCase() + '_CLIENT_ID';
        const ada = process.env[key] || process.env[keyAlt];
        hasil.oauth[p] = ada ? '✅ key ada' : '❌ key kosong';
      }
      // Cek file token
      const tokenFile = path.join(__dirname, '..', '..', 'data', 'oauth-tokens.json');
      if (fs.existsSync(tokenFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
          hasil.oauth.tokenCount = Object.keys(data).length + ' user';
        } catch { hasil.oauth.tokenFile = '⚠️ corrupt'; }
      } else {
        hasil.oauth.tokenFile = '❌ belum ada';
      }
    }

    // 4. Cek user
    if (area === 'all' || area === 'users') {
      try {
        const users = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'users.json'), 'utf8'));
        hasil.users = {
          total: Object.keys(users).length,
          tiers: {}
        };
        for (const u of Object.values(users)) {
          const t = u.tier || 'free';
          hasil.users.tiers[t] = (hasil.users.tiers[t] || 0) + 1;
        }
      } catch (e) {
        hasil.users = '❌ ' + e.message;
      }
    }

    // Format output
    let out = '🔍 **Diagnostic Report**\n\n';
    for (const [section, data] of Object.entries(hasil)) {
      out += `**${section.toUpperCase()}**\n`;
      if (typeof data === 'string') {
        out += `  ${data}\n`;
      } else {
        for (const [k, v] of Object.entries(data)) {
          out += `  ${k}: ${v}\n`;
        }
      }
      out += '\n';
    }

    return out;
  }
};
