// Sync config dari GitHub
const GITHUB_REPO = 'onyxdrake/onyx-cloud';
const GITHUB_RAW = `https://raw.githubusercontent.com/${GITHUB_REPO}/main`;

async function syncConfig() {
  try {
    const res = await fetch(`${GITHUB_RAW}/config.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Config not found');
    const config = await res.json();
    
    if (config.serverUrl) {
      localStorage.setItem('onyx_server_url', config.serverUrl);
      console.log('📡 Server URL from GitHub:', config.serverUrl);
    }
    
    if (config.status) {
      localStorage.setItem('onyx_server_status', config.status);
    }
    
    return config;
  } catch (e) {
    console.error('Config sync error:', e.message);
    return null;
  }
}

// Auto-sync tiap 5 menit
if (typeof window !== 'undefined') {
  syncConfig();
  setInterval(syncConfig, 5 * 60 * 1000);
}
