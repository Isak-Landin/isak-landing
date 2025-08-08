// static/js/user_chat.js

// ---- create/share ONE global socket for all chat scripts ----
window.socket = window.socket || io({
  path: "/socket.io/",
  // transports: ["websocket"], // optional; enable if you want websocket-only
  withCredentials: true
});

document.addEventListener("DOMContentLoaded", () => {
  const socket = window.socket; // reuse the global

  const messagesContainer = document.getElementById("chat-messages");
  const form = document.querySelector(".chat-form");
  const textarea = form?.querySelector("textarea");

  if (!messagesContainer || !form || !textarea) {
    console.warn("[chat] Missing required DOM elements, aborting user_chat.js");
    return;
  }

  const chatIdRaw = messagesContainer.dataset.chatId;
  const chatId = Number.parseInt(chatIdRaw, 10);
  if (!Number.isInteger(chatId)) {
    console.error("[chat] Invalid chat id:", chatIdRaw);
    return;
  }

  // Auto-scroll to bottom on load
  const scrollToBottom = () => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };
  scrollToBottom();

  const join = () => {
    socket.emit("join_chat", { chat_id: chatId });
  };

  socket.on("connect", () => {
    console.log("[chat] connected:", socket.id);
    join();
  });

  socket.on("reconnect", () => {
    console.log("[chat] reconnected:", socket.id);
    join();
  });

  socket.on("connect_error", (err) => {
    console.error("[chat] connect_error:", err?.message || err);
  });

  socket.on("error", (data) => {
    console.error("[chat] server error:", data?.error || data);
  });

  socket.on("info", (data) => {
    console.log("[chat] info:", data);
  });

  // Receive and render new messages (from room emit + direct echo)
  socket.on("receive_message", (data) => {
    if (Number(data.chat_id) !== chatId) return;

    const msg = document.createElement("div");
    msg.className = `chat-message ${data.sender}`;
    msg.innerHTML = `
      <strong>${data.sender.charAt(0).toUpperCase() + data.sender.slice(1)}:</strong>
      ${data.message}
      <br><small>${data.timestamp}</small>
    `;
    messagesContainer.appendChild(msg);
    scrollToBottom();
  });

  // Send message
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = textarea.value.trim();
    if (!message) return;

    socket.emit("send_message", {
      chat_id: chatId,
      sender: "user",
      message
    });

    textarea.value = "";
    textarea.focus();
  });
});
