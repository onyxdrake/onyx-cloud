// tools/builtin/coding-tools.js
// Coding tools untuk AI — multi-bahasa

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = {
  name: 'coding',
  description: 'Coding tools. Args: { action: "run"|"read"|"write"|"list"|"git"|"install", ... }',
  async run(args) {
    const { action, ...params } = args;

    if (action === 'run') {
      return await runCode(params);
    }
    if (action === 'read') {
      return await readFile(params);
    }
    if (action === 'write') {
      return await writeFile(params);
    }
    if (action === 'list') {
      return await listFiles(params);
    }
    if (action === 'git') {
      return await gitOp(params);
    }
    if (action === 'install') {
      return await installPackage(params);
    }

    return 'Unknown action. Use: run, read, write, list, git, install';
  }
};

async function runCode({ code, language = 'python', timeout = 10 }) {
  // Support: python, node, go, rust, java, php, ruby, bash
  const runners = {
    python: `python3 -c "${code.replace(/"/g, '\\"')}"`,
    node: `node -e "${code.replace(/"/g, '\\"')}"`,
    bash: `bash -c "${code.replace(/"/g, '\\"')}"`,
    go: null, // compile dulu
    rust: null,
    java: null
  };

  if (!runners[language]) {
    return `⚠️  Bahasa ${language} belum di-support. Support: python, node, bash`;
  }

  return new Promise((resolve) => {
    exec(runners[language], { timeout: timeout * 1000 }, (err, stdout, stderr) => {
      if (err) {
        resolve(`❌ Error:\n${stderr || err.message}`);
      } else {
        resolve(`✅ Output:\n${stdout || '(no output)'}`);
      }
    });
  });
}

async function readFile({ filePath }) {
  try {
    if (!fs.existsSync(filePath)) return `❌ File gak ada: ${filePath}`;
    const content = fs.readFileSync(filePath, 'utf8');
    return `📄 ${filePath}:\n\n\`\`\`\n${content}\n\`\`\``;
  } catch (e) {
    return `❌ Error: ${e.message}`;
  }
}

async function writeFile({ filePath, content }) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content);
    return `✅ File ditulis: ${filePath}`;
  } catch (e) {
    return `❌ Error: ${e.message}`;
  }
}

async function listFiles({ dirPath = '.' }) {
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    return files.map(f => `${f.isDirectory() ? '📁' : '📄'} ${f.name}`).join('\n');
  } catch (e) {
    return `❌ Error: ${e.message}`;
  }
}

async function gitOp({ command }) {
  return new Promise((resolve) => {
    exec(`git ${command}`, (err, stdout, stderr) => {
      resolve(err ? `❌ ${stderr}` : `✅ ${stdout}`);
    });
  });
}

async function installPackage({ manager, package: pkg }) {
  const cmds = {
    npm: `npm install ${pkg}`,
    pip: `pip install ${pkg}`,
    cargo: `cargo add ${pkg}`,
    go: `go get ${pkg}`
  };
  if (!cmds[manager]) return `⚠️  Manager ${manager} gak di-support`;
  return new Promise((resolve) => {
    exec(cmds[manager], { timeout: 60000 }, (err, stdout, stderr) => {
      resolve(err ? `❌ ${stderr}` : `✅ ${stdout}`);
    });
  });
}
