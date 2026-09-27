// ===== ONYX REALTIME =====
// Gabungin WebSocket + Push Notification + GitHub Config

const GITHUB_REPO = 'onyxdrake/onyx-cloud';
const GITHUB_RAW = `https://raw.githubusercontent.com/${GITHUB_REPO}/master`;
const WS_PORT = 8082;

let ws = null;
let wsReconnectTimer = null;
let configCache = null;
let pushPermission = null;

// ===== 1. FETCH CONFIG DARI GITHUB =====
async function fetchConfig() {
  try {
    const res = await fetch(`${GITHUB_RAW}/config.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Config not found');
    const config = await res.json();
    configCache = config;
    if (config.serverUrl) {
      localStorage.setItem('onyx_server_url', config.serverUrl);
    }
    if (config.status) {
      localStorage.setItem('onyx_server_status', config.status);
    }
    console.log('📡 Config loaded:', config);
    return config;
  } catch (e) {
    console.error('❌ Config fetch error:', e.message);
    return null;
  }
}

function getServerUrl() {
  return localStorage.getItem('onyx_server_url') || window.location.origin;
}

// ===== 2. WEBSOCKET CONNECTION =====
function connectWebSocket() {
  const serverUrl = getServerUrl();
  const wsUrl = serverUrl.replace('https://', 'wss://').replace('http://', 'ws://') + ':' + WS_PORT;
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('📡 WebSocket connected:', wsUrl);
      clearTimeout(wsReconnectTimer);
      updateConnectionStatus('online');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 WebSocket message:', data);
        
        // Handle tipe pesan
        if (data.type === 'url') {
          // Server kirim URL baru
          localStorage.setItem('onyx_server_url', data.url);
          console.log('📡 Server URL updated:', data.url);
        }
        if (data.type === 'notification') {
          // Server kirim notifikasi
          showNotification(data.title || 'Onyx', data.body || '');
        }
        if (data.type === 'update') {
          // Server kirim update
          showNotification('Onyx Update', data.message || 'New version available');
        }
      } catch (e) {
        console.error('WS message error:', e);
      }
    };
    
    ws.onclose = () => {
      console.log('📡 WebSocket closed. Reconnecting in 5s...');
      updateConnectionStatus('offline');
      wsReconnectTimer = setTimeout(connectWebSocket, 5000);
    };
    
    ws.onerror = (e) => {
      console.error('WebSocket error:', e);
    };
  } catch (e) {
    console.error('WebSocket connect error:', e);
    wsReconnectTimer = setTimeout(connectWebSocket, 5000);
  }
}

function disconnectWebSocket() {
  if (ws) {
    ws.close();
    ws = null;
  }
  clearTimeout(wsReconnectTimer);
}

// ===== 3. PUSH NOTIFICATION =====
async function requestPushPermission() {
  if (!('Notification' in window)) {
    console.log('❌ Push not supported');
    return false;
  }
  
  pushPermission = await Notification.requestPermission();
  console.log('📡 Push permission:', pushPermission);
  return pushPermission === 'granted';
}

function showNotification(title, body) {
  if (pushPermission !== 'granted') {
    console.log('📡 Push not granted');
    return;
  }
  
  try {
    new Notification(title, {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png'
    });
  } catch (e) {
    console.error('Notification error:', e);
  }
}

// ===== 4. CONNECTION STATUS =====
function updateConnectionStatus(status) {
  const el = document.getElementById('status');
  if (!el) return;
  
  if (status === 'online') {
    el.textContent = '🟢';
    el.className = 'status online';
  } else {
    el.textContent = '🔴';
    el.className = 'status offline';
  }
}

// ===== 5. INIT =====
async function initRealtime() {
  console.log('🚀 Init Onyx Realtime...');
  
  // 1. Fetch config
  await fetchConfig();
  
  // 2. Request push permission
  await requestPushPermission();
  
  // 3. Connect WebSocket
  connectWebSocket();
  
  // 4. Auto-refresh config tiap 5 menit
  setInterval(fetchConfig, 5 * 60 * 1000);
  
  // 5. Reconnect WebSocket kalo config berubah
  setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    }
  }, 30000);
}

// Auto-init
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRealtime);
  } else {
    initRealtime();
  }
}

// Export
window.OnyxRealtime = {
  fetchConfig,
  getServerUrl,
  connectWebSocket,
  disconnectWebSocket,
  requestPushPermission,
  showNotification
};
