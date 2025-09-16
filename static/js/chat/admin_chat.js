// static/js/chat/admin_chat.js
// Mirrors user_chat.v2 structure, no optimistic render (prevents double-post).
// Renders bubbles identical to the server HTML so CSS applies 1:1.

console.info("[admin_chat] loaded from:", document.currentScript && document.currentScript.src);

// Reuse a single socket instance created elsewhere (chat-core or this file)
window.socket = window.socket || io({ path: "/socket.io/", withCredentials: true });

(function () {
  const socket = window.socket;

  document.addEventListener("DOMContentLoaded", () => {
    const messagesContainer = document.getElementById("chat-messages");
    if (!messagesContainer) return;

    // Prevent double-binding if hot-reloaded
    if (messagesContainer.__adminChatBound) return;
    messagesContainer.__adminChatBound = true;

    const chatId = Number.parseInt(messagesContainer.dataset.chatId, 10);
    if (!Number.isInteger(chatId)) return;

    // ---- Utilities ----
    const atBottom = () =>
      messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight <= 2;

    const scrollToBottom = (smooth = false) =>
      messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: smooth ? "smooth" : "auto" });

    // Format like dt_short filter on the page:
    // - Today: HH:mm
    // - Other day: YYYY-MM-DD HH:mm
    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    function formatDtShort(isoOrStr) {
      if (!isoOrStr) return "";
      const d = new Date(isoOrStr);
      if (isNaN(d.getTime())) return String(isoOrStr);

      const now = new Date();
      const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();

      if (sameDay) {
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // De-dup incoming events
    const seen = new Set();
    const markSeen = (m) => {
      const key = m?.id ?? `${m?.chat_id}|${m?.timestamp}|${m?.sender}|${m?.message}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      if (seen.size > 1000) { const it = seen.values(); seen.delete(it.next().value); }
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
      senderSpan.textContent = sender_label || (isMine ? "You" : "User");
      header.appendChild(senderSpan);

      const timeSpan = document.createElement("span");
      timeSpan.className = "timestamp";
      timeSpan.textContent = formatDtShort(timestamp);
      header.appendChild(timeSpan);

      const body = document.createElement("div");
      body.className = "msg-body";
      body.textContent = message ?? "";
      bubble.appendChild(body);

      return root;
    }

    // Clear any legacy listeners that might have been attached by older scripts
    socket.off("receive_message");
    socket.off("connect");
    socket.off("reconnect");

    // Join the room on connect/reconnect
    const join = () => socket.emit("join_chat", { chat_id: chatId });
    socket.on("connect", join);
    socket.on("reconnect", join);

    // static/js/chat/admin_chat.js  (near the bottom, after we join)
    window.addEventListener('beforeunload', () => {
      try { socket.emit('leave_chat', { chat_id: chatId }); } catch {}
    });

    window.addEventListener('pagehide', () => {
      try { socket.emit('leave_chat', { chat_id: chatId }); } catch {}
    });



    // Render incoming messages using the bubble structure
    socket.on("receive_message", (data) => {
      if (Number(data.chat_id) !== chatId) return;
      if (!markSeen(data)) return;

      // On the admin page, my messages are those from 'admin'
      const isMine = data.sender === "admin";
      const node = buildMessageNode({
        sender: data.sender,
        sender_label: data.sender_label,
        message: data.message,
        timestamp: data.timestamp,
        isMine
      });

      const wasAtBottom = atBottom();
      messagesContainer.appendChild(node);

      // If you have the “new messages” indicator wired globally, let it know
      window.__chatIndicator?.onNewMessage?.(isMine, { smooth: true });

      // Fall back to autoscroll if indicator not present or message is mine
      if (!window.__chatIndicator && (isMine || wasAtBottom)) {
        scrollToBottom(true);
      }
    });

    // Initial scroll
    scrollToBottom(false);
  });
})();
