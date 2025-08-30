// static/js/chat/user_chat.v2.js
// Force-refresh guard: shows *which* file actually loaded.
console.info("[user_chat v2] loaded from:", document.currentScript && document.currentScript.src);

// Reuse a single socket instance
window.socket = window.socket || io({ path: "/socket.io/", withCredentials: true });

(function () {
  const socket = window.socket;

  document.addEventListener("DOMContentLoaded", () => {
    const messagesContainer = document.getElementById("chat-messages");
    if (!messagesContainer) return;

    // Prevent double-binding
    if (messagesContainer.__userChatV2Bound) return;
    messagesContainer.__userChatV2Bound = true;

    const chatId = Number.parseInt(messagesContainer.dataset.chatId, 10);
    if (!Number.isInteger(chatId)) return;

    // Clear any legacy listeners that might have been attached by stale scripts
    socket.off("receive_message");
    socket.off("connect");
    socket.off("reconnect");

    // Join the room
    const join = () => socket.emit("join_chat", { chat_id: chatId });
    socket.on("connect", join);
    socket.on("reconnect", join);

    // Helpers
    const atBottom = () =>
      messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight <= 2;

    const scrollToBottom = (smooth = false) =>
      messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: smooth ? "smooth" : "auto" });

    try {
      // Initialize the sticky “new messages” indicator if available
      window.ChatShared?.initNewMessageIndicator?.(messagesContainer, { autoObserve: false });
    } catch (_) {}

    // De-dup incoming events
    const seen = new Set();
    const markSeen = (m) => {
      const key = m?.id ?? `${m?.chat_id}|${m?.timestamp}|${m?.sender}|${m?.message}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      if (seen.size > 1000) {
        const it = seen.values();
        seen.delete(it.next().value);
      }
      return true;
    };

    // Build DOM exactly like the server-rendered template
    function buildMessageNode({ sender, sender_label, message, timestamp, isMine }) {
      const root = document.createElement("div");
      root.className = `chat-message ${isMine ? "me" : "them"} ${sender || ""}`.trim();

      const bubble = document.createElement("div");
      bubble.className = "msg-bubble";
      root.appendChild(bubble);

      const header = document.createElement("div");
      header.className = "msg-header";
      bubble.appendChild(header);

      const senderSpan = document.createElement("span");
      senderSpan.className = "sender";
      senderSpan.textContent = sender_label || (isMine ? "You" : "Support");
      header.appendChild(senderSpan);

      const timeSpan = document.createElement("span");
      timeSpan.className = "timestamp";
      timeSpan.textContent = timestamp || "";
      header.appendChild(timeSpan);

      const body = document.createElement("div");
      body.className = "msg-body";
      body.textContent = message ?? "";
      bubble.appendChild(body);

      return root;
    }

    socket.on("receive_message", (data) => {
      if (Number(data.chat_id) !== chatId) return;
      if (!markSeen(data)) return;

      const isMine = data.sender === "user"; // on the user page, 'user' means me
      const node = buildMessageNode({
        sender: data.sender,
        sender_label: data.sender_label,
        message: data.message,
        timestamp: data.timestamp,
        isMine
      });

      const wasAtBottom = atBottom();
      messagesContainer.appendChild(node);

      // Cooperate with sticky indicator if present
      if (window.__chatIndicator?.onNewMessage) {
        window.__chatIndicator.onNewMessage(isMine, { smooth: true });
      } else if (isMine || wasAtBottom) {
        // Fallback
        scrollToBottom(true);
      }
    });

    // Initial scroll for server-rendered history
    scrollToBottom(false);
  });
})();
