// ---- create/share ONE global socket for all chat scripts ----
window.socket = window.socket || io({
  path: "/socket.io/",
  // transports: ["websocket"], // optional
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

  // Prevent double-binding if this script is injected twice
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

  const join = () => {
    socket.emit("join_chat", { chat_id: chatId });
  };

  socket.off("connect.user").on("connect.user", () => {
    console.log("[chat] connected:", socket.id);
    join();
  });

  socket.off("reconnect.user").on("reconnect.user", () => {
    console.log("[chat] reconnected:", socket.id);
    join();
  });

  socket.off("connect_error.user").on("connect_error.user", (err) => {
    console.error("[chat] connect_error:", err?.message || err);
  });

  socket.off("error.user").on("error.user", (data) => {
    console.error("[chat] server error:", data?.error || data);
  });

  socket.off("info.user").on("info.user", (data) => {
    console.log("[chat] info:", data);
  });

  // --- De-dup incoming messages by server id (strong) or composite (fallback)
  const seen = new Set();
  const markSeen = (m) => {
    const key = m?.id ?? `${m?.chat_id}|${m?.timestamp}|${m?.sender}|${m?.message}`;
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    // Keep set from growing forever
    if (seen.size > 1000) {
      const it = seen.values(); it.next(); seen.delete(it.value);
    }
    return true;
  };

  // Receive and render new messages (single server emit)
  socket.off("receive_message.user").on("receive_message.user", (data) => {
    if (Number(data.chat_id) !== chatId) return;
    if (!markSeen(data)) return;

    const msg = document.createElement("div");
    const isMine = data.sender === "user"; // for user-facing chat, 'user' == me
    msg.className = `chat-message ${isMine ? "me" : "them"} ${data.sender}`;
    msg.innerHTML = `
      <strong>${data.sender.charAt(0).toUpperCase() + data.sender.slice(1)}:</strong>
      ${data.message}
      <br><small>${data.timestamp}</small>
    `;
    messagesContainer.appendChild(msg);
    scrollToBottom();

    // If you rely on ChatShared indicator without MutationObserver, you can notify:
    // window.__chatIndicator?.onNewMessage?.(isMine);
  });

  // Send message (do NOT append locally; wait for server event)
  if (!form.__userChatSubmitBound) {
    form.__userChatSubmitBound = true;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const message = textarea.value.trim();
      if (!message) return;

      socket.emit("send_message", {
        chat_id: chatId,
        // 'sender' no longer required; server derives it, but harmless if present
        sender: "user",
        message
      });

      textarea.value = "";
      textarea.focus();
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ user_chat_start.js loaded");
  const form = document.getElementById('start-chat-form');
  if (!form) return;

  if (form.__startChatBound) return;
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
