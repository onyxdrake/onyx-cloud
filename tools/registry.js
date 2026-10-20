const fs = require('fs');
const path = require('path');

const BUILTIN_DIR = path.join(__dirname, 'builtin');
const CUSTOM_FILE = path.join(__dirname, 'custom-tools.json');

let builtin = {};

function loadBuiltin() {
  builtin = {};
  const files = fs.readdirSync(BUILTIN_DIR).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const tool = require(path.join(BUILTIN_DIR, file));
    builtin[tool.name] = { ...tool, type: 'builtin' };
  }
}

function loadCustom() {
  if (!fs.existsSync(CUSTOM_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(CUSTOM_FILE, 'utf8')); }
  catch { return {}; }
}

function saveCustom(tools) {
  fs.writeFileSync(CUSTOM_FILE, JSON.stringify(tools, null, 2));
}

function getAll() {
  const custom = loadCustom();
  const all = { ...builtin };
  for (const [name, def] of Object.entries(custom)) {
    all[name] = { ...def, type: 'custom' };
  }
  return all;
}

function getToolList() {
  const all = getAll();
  return Object.entries(all).map(([name, def]) =>
    `- ${name}: ${def.description}`
  ).join('\n');
}

async function runTool(name, args) {
  const all = getAll();
  const tool = all[name];
  if (!tool) return `Error: tool "${name}" gak ada.`;
  try {
    if (tool.type === 'builtin') {
      return await tool.run(args);
    }
    if (tool.endpoint) {
      const res = await fetch(tool.endpoint, {
        method: tool.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...(tool.headers || {}) },
        body: JSON.stringify({ ...args, api_key: tool.api_key })
      });
      const data = await res.json();
      return JSON.stringify(data).slice(0, 2000);
    }
    return `Error: custom tool "${name}" gak punya endpoint.`;
  } catch (e) {
    return `Error: ${e.message}`;
  }
}

function addCustom(name, def) {
  const custom = loadCustom();
  custom[name] = def;
  saveCustom(custom);
}

function removeCustom(name) {
  const custom = loadCustom();
  delete custom[name];
  saveCustom(custom);
}

loadBuiltin();

module.exports = { getAll, getToolList, runTool, addCustom, removeCustom };
