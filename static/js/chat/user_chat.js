// static/js/chat/user_chat.js
// ---- create/share ONE global socket for all chat scripts ----
window.socket = window.socket || io({
  path: "/socket.io/",
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

  const atBottom = () =>
    messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight <= 2;

  const scrollToBottom = (smooth = false) => {
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // Ensure the indicator is initialized (chat-core.js will no-op if already bound)
  try {
    window.ChatShared?.initNewMessageIndicator?.(messagesContainer, {
      autoObserve: false // we'll manually notify on append below
    });
  } catch (_) {}

  // Join room on connect/reconnect
  const join = () => socket.emit("join_chat", { chat_id: chatId });

  socket.off("connect").on("connect", () => {
    join();
  });

  socket.off("reconnect").on("reconnect", () => {
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
    if (!key || seen.has(key)) return false;
    seen.add(key);
    if (seen.size > 1000) {
      const it = seen.values();
      seen.delete(it.next().value);
    }
    return true;
  };

  // Build DOM for one message using the same structure as the template
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
    // Use textContent so user-entered text is treated as text, not HTML.
    body.textContent = message ?? "";
    bubble.appendChild(body);

    return root;
  }

  // Render incoming messages (server emits once with include_self=True)
  socket.off("receive_message").on("receive_message", (data) => {
    if (Number(data.chat_id) !== chatId) return;
    if (!markSeen(data)) return;

    const isMine = data.sender === "user"; // user view: 'user' == me
    const node = buildMessageNode({
      sender: data.sender,
      sender_label: data.sender_label,            // optional, falls back to You/Support
      message: data.message,
      timestamp: data.timestamp,
      isMine
    });

    const wasAtBottom = atBottom();
    messagesContainer.appendChild(node);

    // Let the indicator handle autoscroll/new count
    window.__chatIndicator?.onNewMessage?.(isMine, { smooth: true });

    // Fallback autoscroll (in case indicator was not initialized)
    if (!window.__chatIndicator && (isMine || wasAtBottom)) {
      scrollToBottom(true);
    }
  });

  // Initial scroll to bottom for pre-rendered messages
  scrollToBottom(false);
});

// Keep the start-chat helper (used on the "start chat" page) intact
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("start-chat-form");
  if (!form || form.__startChatBound) return;
  form.__startChatBound = true;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    try {
      const response = await fetch(this.action, { method: "POST" });
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
