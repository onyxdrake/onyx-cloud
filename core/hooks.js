const memory = require('./memory');
const intent = require('./intent');

let globalChatRef = null;

// Set global chat reference (dari server.js)
function setGlobalChat(chat) {
  globalChatRef = chat;
}

const hooks = {
  onUserMessage: async (pesan, userId) => {
    try {
      // Auto-detect intent
      const cek = intent.cekNiat(pesan);
      if (!cek.ok) {
        return { block: true, error: cek.error, layer: cek.layer };
      }

      // Auto-save embedding (buat RAG)
      if (memory.simpanEmbedding) {
        memory.simpanEmbedding(pesan).catch(() => {});
      }

      return { block: false, category: cek.category };
    } catch (e) {
      console.error('[Hook] onUserMessage error:', e.message);
      return { block: false };
    }
  },

  onAIResponse: async (balasan, userId) => {
    try {
      // Auto-log response (buat audit)
      console.log(`[Hook] AI response to ${userId}: ${balasan.slice(0, 80)}...`);
    } catch (e) {
      console.error('[Hook] onAIResponse error:', e.message);
    }
  },

  onError: async (err, context) => {
    try {
      console.error('[Hook] Error:', err.message);
      // Notify global chat kalo ada
      if (globalChatRef && globalChatRef.broadcastNotification) {
        globalChatRef.broadcastNotification('System Error', err.message);
      }
    } catch (e) {}
  }
};

module.exports = { hooks, setGlobalChat };
