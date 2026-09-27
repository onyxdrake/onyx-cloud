const STATE_KEY = 'onyx_chats';
function loadChats() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY)) || []; }
  catch { return []; }
}
function saveChats(chats) {
  localStorage.setItem(STATE_KEY, JSON.stringify(chats));
}
