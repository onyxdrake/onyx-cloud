const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const TMP_DIR = path.join(__dirname, '..', '..', 'data', 'tmp');

module.exports = {
  name: 'run_code',
  description: 'Run Python or Node.js code in sandbox.',
  params: { code: 'string', language: 'string' },
  run: async ({ code, language = 'python' }) => {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
    
    const ext = language === 'python' ? 'py' : 'js';
    const filename = `script_${Date.now()}.${ext}`;
    const filepath = path.join(TMP_DIR, filename);
    
    fs.writeFileSync(filepath, code);
    
    const cmd = language === 'python' ? `python3 ${filepath}` : `node ${filepath}`;
    
    return new Promise((resolve) => {
      exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
        fs.unlinkSync(filepath);
        if (err && err.killed) return resolve('Error: Timeout (30s)');
        if (err) return resolve(`Error: ${stderr || err.message}`);
        resolve(stdout || 'OK');
      });
    });
  }
};
