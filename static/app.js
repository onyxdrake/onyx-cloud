const chatEl = document.getElementById("chat");
const promptEl = document.getElementById("prompt");
const btnSend = document.getElementById("btn-send");
const providerEl = document.getElementById("provider");
const modelEl = document.getElementById("model");
const welcomeEl = document.getElementById("welcome");
const sidebar = document.getElementById("sidebar");
const historyList = document.getElementById("history-list");

let messages = [];
let chatId = crypto.randomUUID();
let isStreaming = false;
let authMode = "login"; // login | register

async function loadModels() {
  const res = await fetch(`/api/models?provider=${providerEl.value}`);
  const data = await res.json();
  modelEl.innerHTML = data.models.map((m,i) => `<option value="${m}" \( {i===0?"selected":""}> \){m}</option>`).join("");
}
providerEl.onchange = loadModels;
loadModels();

function addBubble(role, text, streaming=false) {
  welcomeEl?.remove();
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;
  const bubble = document.createElement("div");
  bubble.className = `bubble ${streaming?"streaming":""}`;
  bubble.textContent = text;
  row.appendChild(bubble);
  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
  return bubble;
}

async function sendMessage() {
  const text = promptEl.value.trim();
  if (!text || isStreaming) return;
  promptEl.value = "";
  autoResize();
  isStreaming = true;
  btnSend.disabled = true;
  messages.push({ role: "user", content: text });
  addBubble("user", text);
  const aiBubble = addBubble("ai", "", true);
  let full = "";
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: providerEl.value, model: modelEl.value, messages, chat_id: chatId }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") {
          aiBubble.classList.remove("streaming");
          messages.push({ role: "assistant", content: full });
          loadHistory();
          break;
        }
        if (data.startsWith("[ERROR]")) {
          full = data;
          aiBubble.textContent = full;
          aiBubble.classList.remove("streaming");
          break;
        }
        full += data;
        aiBubble.textContent = full;
        chatEl.scrollTop = chatEl.scrollHeight;
      }
    }
  } catch (e) {
    aiBubble.textContent = "Error: " + e.message;
    aiBubble.classList.remove("streaming");
  }
  isStreaming = false;
  btnSend.disabled = false;
  promptEl.focus();
}

btnSend.onclick = sendMessage;
promptEl.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
function autoResize() {
  promptEl.style.height = "auto";
  promptEl.style.height = Math.min(promptEl.scrollHeight, 140) + "px";
}
promptEl.oninput = autoResize;

// Sidebar
document.getElementById("btn-open-sidebar").onclick = () => sidebar.classList.remove("closed");
document.getElementById("btn-close-sidebar").onclick = () => sidebar.classList.add("closed");
if (window.innerWidth < 700) sidebar.classList.add("closed");

document.getElementById("btn-new-chat").onclick = () => {
  messages = [];
  chatId = crypto.randomUUID();
  chatEl.innerHTML = `<div class="welcome" id="welcome"><h1>Onyx</h1><p>Satu AI. Cepat. Lebih longgar.</p></div>`;
};

async function loadHistory() {
  const res = await fetch("/api/history");
  const data = await res.json();
  historyList.innerHTML = (data.chats || []).map(c =>
    `<div class="history-item" data-id="\( {c.id}"> \){c.preview || "Chat"}</div>`
  ).join("");
  historyList.querySelectorAll(".history-item").forEach(el => {
    el.onclick = async () => {
      const r = await fetch(`/api/history/get?id=${el.dataset.id}`);
      const d = await r.json();
      messages = d.messages || [];
      chatId = d.id;
      chatEl.innerHTML = "";
      messages.forEach(m => addBubble(m.role === "user" ? "user" : "ai", m.content));
      if (window.innerWidth < 700) sidebar.classList.add("closed");
    };
  });
}
loadHistory();

// Auth
const authModal = document.getElementById("auth-modal");
document.getElementById("btn-login")?.addEventListener("click", () => authModal.classList.remove("hidden"));
document.getElementById("btn-close-auth").onclick = () => authModal.classList.add("hidden");

document.getElementById("btn-do-register").onclick = async () => {
  authMode = "register";
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const msg = document.getElementById("auth-msg");
  msg.textContent = "Mengirim OTP...";
  const res = await fetch("/auth/register", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.ok) {
    document.getElementById("auth-form").classList.add("hidden");
    document.getElementById("auth-otp").classList.remove("hidden");
    msg.textContent = "OTP terkirim. Cek inbox/spam.";
    msg.className = "msg ok";
  } else {
    msg.textContent = data.error || "Gagal";
    msg.className = "msg error";
  }
};

document.getElementById("btn-do-login").onclick = async () => {
  authMode = "login";
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const msg = document.getElementById("auth-msg");
  msg.textContent = "Cek password & kirim OTP...";
  const res = await fetch("/auth/login", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.ok) {
    document.getElementById("auth-form").classList.add("hidden");
    document.getElementById("auth-otp").classList.remove("hidden");
    msg.textContent = "OTP terkirim.";
    msg.className = "msg ok";
  } else {
    msg.textContent = data.error || "Gagal";
    msg.className = "msg error";
  }
};

document.getElementById("btn-verify-otp").onclick = async () => {
  const email = document.getElementById("auth-email").value.trim();
  const otp = document.getElementById("auth-otp-input").value.trim();
  const url = authMode === "register" ? "/auth/verify-register" : "/auth/verify-login";
  const res = await fetch(url, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ email, otp })
  });
  const data = await res.json();
  if (res.ok) location.reload();
  else {
    document.getElementById("auth-msg").textContent = data.error || "OTP salah";
    document.getElementById("auth-msg").className = "msg error";
  }
};

document.getElementById("btn-logout")?.addEventListener("click", async () => {
  await fetch("/auth/logout", { method: "POST" });
  location.reload();
});

// Settings + Connect
document.getElementById("btn-settings").onclick = () => document.getElementById("settings-modal").classList.remove("hidden");
document.getElementById("btn-close-settings").onclick = () => document.getElementById("settings-modal").classList.add("hidden");

document.querySelectorAll(".btn.connect").forEach(btn => {
  btn.onclick = () => {
    const s = btn.dataset.service;
    alert(`Sandingkan ${s}:\n\nNanti kamu akan diarahkan ke halaman login ${s} dan diminta setujui akses.\n(Full OAuth butuh domain publik – bisa dilanjut nanti)`);
  };
});

document.getElementById("btn-apply-bg").onclick = () => {
  const url = document.getElementById("bg-url").value.trim();
  if (url) {
    document.body.style.backgroundImage = `url(${url})`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundAttachment = "fixed";
    localStorage.setItem("onyx_bg", url);
  }
};
if (localStorage.getItem("onyx_bg")) {
  document.body.style.backgroundImage = `url(${localStorage.getItem("onyx_bg")})`;
  document.body.style.backgroundSize = "cover";
}

// Image
document.getElementById("btn-image").onclick = () => document.getElementById("image-modal").classList.remove("hidden");
document.getElementById("btn-close-image").onclick = () => document.getElementById("image-modal").classList.add("hidden");
document.getElementById("btn-gen-image").onclick = async () => {
  const prompt = document.getElementById("image-prompt").value.trim();
  if (!prompt) return;
  const res = await fetch("/api/image", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ prompt })
  });
  const data = await res.json();
  if (data.ok) {
    document.getElementById("image-result").innerHTML = `<img src="${data.url}" alt="generated" />`;
  }
};

// Upload
document.getElementById("btn-attach").onclick = () => document.getElementById("file-input").click();
document.getElementById("file-input").onchange = async () => {
  const file = document.getElementById("file-input").files[0];
  if (!file) return;
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  if (data.ok) addBubble("user", `📎 \( {data.filename} ( \){(data.size/1024).toFixed(1)} KB)`);
  document.getElementById("file-input").value = "";
};
