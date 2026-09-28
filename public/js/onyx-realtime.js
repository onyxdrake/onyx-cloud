// Realtime sync: WebSocket + Push + GitHub Config
const GITHUB_REPO = 'onyxdrake/onyx-cloud';
const GITHUB_RAW = `https://raw.githubusercontent.com/${GITHUB_REPO}/master`;

let ws = null;
let wsReconnectTimer = null;

async function fetchConfig() {
  try {
    const res = await fetch(`${GITHUB_RAW}/config.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Config not found');
    const config = await res.json();
    if (config.serverUrl) {
      localStorage.setItem('onyx_server_url', config.serverUrl);
    }
    return config;
  } catch (e) {
    return null;
  }
}

function getServerUrl() {
  return localStorage.getItem('onyx_server_url') || window.location.origin;
}

function connectWebSocket() {
  const serverUrl = getServerUrl();
  const wsUrl = serverUrl.replace('https://', 'wss://').replace('http://', 'ws://') + ':8082';
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('📡 WebSocket connected');
      clearTimeout(wsReconnectTimer);
      updateConnectionStatus('online');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'url') {
          localStorage.setItem('onyx_server_url', data.url);
        }
        if (data.type === 'notification') {
          showNotification(data.title || 'Onyx', data.body || '');
        }
      } catch (e) {}
    };
    
    ws.onclose = () => {
      updateConnectionStatus('offline');
      wsReconnectTimer = setTimeout(connectWebSocket, 5000);
    };
    
    ws.onerror = () => {};
  } catch (e) {
    wsReconnectTimer = setTimeout(connectWebSocket, 5000);
  }
}

async function requestPushPermission() {
  if (!('Notification' in window)) return false;
  const p = await Notification.requestPermission();
  return p === 'granted';
}

function showNotification(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon-192.png' });
  }
}

function updateConnectionStatus(status) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = status === 'online' ? '🟢' : '🔴';
  el.className = 'status ' + status;
}

async function initRealtime() {
  await fetchConfig();
  await requestPushPermission();
  connectWebSocket();
  setInterval(fetchConfig, 5 * 60 * 1000);
  setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) connectWebSocket();
  }, 30000);
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRealtime);
  } else {
    initRealtime();
  }
}

window.OnyxRealtime = { fetchConfig, getServerUrl, connectWebSocket, showNotification };
