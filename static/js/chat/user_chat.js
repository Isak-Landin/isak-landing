// ---- create/share ONE global socket for all chat scripts ----
// static/js/chat/user_chat.js
window.socket = window.socket || io({
  path: "/socket.io/",
  // transports: ["websocket"], // optional
  withCredentials: true
});

document.addEventListener("DOMContentLoaded", () => {
  const socket = window.socket;

  const messagesContainer = document.getElementById("chat-messages");
  if (!messagesContainer) {
    console.warn("[chat] Missing #chat-messages, aborting user_chat.js");
    return;
  }

  // Prevent double-binding if script runs twice
  if (messagesContainer.__userChatBound) return;
  messagesContainer.__userChatBound = true;

  const chatIdRaw = messagesContainer.dataset.chatId;
  const chatId = Number.parseInt(chatIdRaw, 10);
  if (!Number.isInteger(chatId)) {
    console.error("[chat] Invalid chat id:", chatIdRaw);
    return;
  }

  const scrollToBottom = () => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };
  scrollToBottom();

  const join = () => socket.emit("join_chat", { chat_id: chatId });

  socket.off("connect").on("connect", () => {
    console.log("[chat] connected:", socket.id);
    join();
  });

  socket.off("reconnect").on("reconnect", () => {
    console.log("[chat] reconnected:", socket.id);
    join();
  });

  socket.off("connect_error").on("connect_error", (err) => {
    console.error("[chat] connect_error:", err?.message || err);
  });

  socket.off("error").on("error", (data) => {
    console.error("[chat] server error:", data?.error || data);
  });

  socket.off("info").on("info", (data) => {
    console.log("[chat] info:", data);
  });

  // --- De-dup by server id (belt & suspenders)
  const seen = new Set();
  const markSeen = (m) => {
    const key = m?.id ?? `${m?.chat_id}|${m?.timestamp}|${m?.sender}|${m?.message}`;
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    if (seen.size > 1000) { const it = seen.values(); seen.delete(it.next().value); }
    return true;
  };

  // Receive and render new messages (server emits once with include_self=True)
  socket.off("receive_message").on("receive_message", (data) => {
    if (Number(data.chat_id) !== chatId) return;
    if (!markSeen(data)) return;

    const isMine = data.sender === "user"; // for user-facing chat, 'user' == me
    const msg = document.createElement("div");
    msg.className = `chat-message ${isMine ? "me" : "them"} ${data.sender}`;
    msg.innerHTML = `
      <strong>${data.sender.charAt(0).toUpperCase() + data.sender.slice(1)}:</strong>
      ${data.message}
      <br><small>${data.timestamp}</small>
    `;
    messagesContainer.appendChild(msg);
    scrollToBottom();

    // If you want to notify the indicator explicitly:
    // window.__chatIndicator?.onNewMessage?.(isMine);
  });

  // IMPORTANT: NO submit handler here.
  // chat-input.js owns sending (Enter/Shift+Enter, throttling, etc.)
});

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ user_chat_start.js loaded");
  const form = document.getElementById('start-chat-form');
  if (!form || form.__startChatBound) return;
  form.__startChatBound = true;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    try {
      const response = await fetch(this.action, { method: 'POST' });
      const result = await response.json();
      if (result.chat_id) {
        window.location.href = `/chat/view?chat_id=${result.chat_id}`;
      } else {
        alert("Something went wrong starting your chat.");
      }
    } catch (err) {
      console.error("Chat start error:", err);
      alert("Unable to start chat. Please try again later.");
    }
  });
});
