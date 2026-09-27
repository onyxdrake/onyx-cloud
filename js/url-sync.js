// Sync URL dari server via WebSocket
const WS_URL = 'ws://localhost:8082';

function connectUrlSync() {
  try {
    const ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log('📡 URL sync connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'url' && data.url) {
          console.log('📡 New URL:', data.url);
          localStorage.setItem('onyx_server_url', data.url);
          // Update link di halaman
          document.querySelectorAll('[data-server-url]').forEach(el => {
            el.href = data.url;
          });
        }
      } catch (e) {
        console.error('URL sync error:', e);
      }
    };
    
    ws.onclose = () => {
      console.log('📡 URL sync disconnected. Reconnecting...');
      setTimeout(connectUrlSync, 5000);
    };
    
    ws.onerror = (e) => {
      console.error('URL sync error:', e);
    };
  } catch (e) {
    console.error('Failed to connect URL sync:', e);
    setTimeout(connectUrlSync, 5000);
  }
}

// Auto-connect
if (typeof window !== 'undefined') {
  connectUrlSync();
}
