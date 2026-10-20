// tools/builtin/read-project.js
// AI bisa baca file proyek — KECUALI .env, node_modules, .git, data/ (user data)

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// Path yang DILARANG dibaca
const BLOCKED = [
  '.env',
  '.env.local',
  '.env.production',
  'node_modules',
  '.git',
  'data/users.json',
  'data/oauth-tokens.json',
  'data/verify-codes.json',
  'data/limits.json',
  'pardus.db',
  'core/cloudflare-url.json'
];

// Extensions yang boleh dibaca
const ALLOWED_EXT = [
  '.js', '.json', '.html', '.css', '.md', '.txt', '.yml', '.yaml', '.sh'
];

// Max ukuran file (100 KB)
const MAX_SIZE = 100 * 1024;

function isBlocked(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  for (const b of BLOCKED) {
    if (normalized === b) return true;
    if (normalized.startsWith(b + '/')) return true;
    if (normalized.includes('/' + b + '/')) return true;
    if (normalized.endsWith('/' + b)) return true;
  }
  return false;
}

module.exports = {
  name: 'read_project',
  description: 'Baca file atau struktur proyek Onyx. Args: { mode: "tree"|"file"|"list", path: "path/ke/file" }. Blocked: .env, node_modules, .git, data user.',
  async run(args) {
    const mode = args.mode || 'tree';
    const target = args.path || '';

    try {
      // MODE: LIST — list folder
      if (mode === 'list') {
        const dir = path.join(ROOT, target);
        if (!fs.existsSync(dir)) return `❌ Folder gak ada: ${target}`;
        if (isBlocked(target)) return `🔒 Folder diblokir: ${target}`;

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files = [];
        for (const e of entries) {
          const rel = path.join(target, e.name);
          if (isBlocked(rel)) continue;
          const icon = e.isDirectory() ? '📁' : '📄';
          files.push(`${icon} ${e.name}`);
        }
        return `📂 **${target || '/'}**\n\n` + files.join('\n');
      }

      // MODE: FILE — baca 1 file
      if (mode === 'file') {
        if (!target) return '❌ Path kosong';
        if (isBlocked(target)) return `🔒 File diblokir (keamanan): ${target}`;

        const ext = path.extname(target).toLowerCase();
        if (!ALLOWED_EXT.includes(ext)) {
          return `⚠️ Extension ${ext} gak diizinkan. Yang boleh: ${ALLOWED_EXT.join(', ')}`;
        }

        const file = path.join(ROOT, target);
        if (!fs.existsSync(file)) return `❌ File gak ada: ${target}`;

        const stat = fs.statSync(file);
        if (stat.size > MAX_SIZE) {
          return `⚠️ File kegedean (${Math.round(stat.size / 1024)} KB). Max: 100 KB.`;
        }

        const content = fs.readFileSync(file, 'utf8');
        return `📄 **${target}** (${content.split('\n').length} baris)\n\n\`\`\`\n${content}\n\`\`\``;
      }

      // MODE: TREE — struktur proyek
      function buildTree(dir, prefix = '', depth = 0) {
        if (depth > 3) return '';
        let out = '';
        const entries = fs.readdirSync(dir, { withFileTypes: true })
          .filter(e => {
            const rel = path.relative(ROOT, path.join(dir, e.name));
            return !isBlocked(rel);
          })
          .sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
          });

        for (const e of entries) {
          const rel = path.relative(ROOT, path.join(dir, e.name));
          if (e.isDirectory()) {
            out += `${prefix}📁 ${e.name}/\n`;
            out += buildTree(path.join(dir, e.name), prefix + '   ', depth + 1);
          } else {
            out += `${prefix}📄 ${e.name}\n`;
          }
        }
        return out;
      }

      const tree = buildTree(ROOT);
      return `🌳 **Struktur Proyek Onyx**\n\n\`\`\`\n${tree}\n\`\`\``;

    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  }
};
