// static/js/chat/user_chat.js  (legacy drop-in replacement)
// Makes live messages match the template bubble structure.

window.socket = window.socket || io({
  path: "/socket.io/",
  withCredentials: true
});

document.addEventListener("DOMContentLoaded", () => {
  const socket = window.socket;

  const messagesContainer = document.getElementById("chat-messages");
  if (!messagesContainer) return;

  // prevent double-binding
  if (messagesContainer.__userChatBoundLegacy) return;
  messagesContainer.__userChatBoundLegacy = true;

  const chatIdRaw = messagesContainer.dataset.chatId;
  const chatId = Number.parseInt(chatIdRaw, 10);
  if (!Number.isInteger(chatId)) return;

  // helper: are we near the bottom?
  const atBottom = () =>
    messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight <= 2;

  const scrollToBottom = (smooth = false) =>
    messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: smooth ? "smooth" : "auto" });

  // initialize indicator if not already
  try {
    window.ChatShared?.initNewMessageIndicator?.(messagesContainer, { autoObserve: false });
  } catch (_) {}

  const join = () => socket.emit("join_chat", { chat_id: chatId });
  socket.off("connect").on("connect", join);
  socket.off("reconnect").on("reconnect", join);

  socket.off("connect_error").on("connect_error", (err) =>
    console.error("[chat] connect_error:", err?.message || err)
  );
  socket.off("error").on("error", (data) =>
    console.error("[chat] server error:", data?.error || data)
  );

  // de-dup
  const seen = new Set();
  const markSeen = (m) => {
    const key = m?.id ?? `${m?.chat_id}|${m?.timestamp}|${m?.sender}|${m?.message}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    if (seen.size > 1000) { const it = seen.values(); seen.delete(it.next().value); }
    return true;
  };

  // Build the same DOM your template renders
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

  // Render incoming messages using the bubble structure
  socket.off("receive_message").on("receive_message", (data) => {
    if (Number(data.chat_id) !== chatId) return;
    if (!markSeen(data)) return;

    const isMine = data.sender === "user"; // user view
    const node = buildMessageNode({
      sender: data.sender,
      sender_label: data.sender_label,
      message: data.message,
      timestamp: data.timestamp,
      isMine
    });

    const wasAtBottom = atBottom();
    messagesContainer.appendChild(node);

    // cooperate with indicator if present
    window.__chatIndicator?.onNewMessage?.(isMine, { smooth: true });

    // fallback autoscroll
    if (!window.__chatIndicator && (isMine || wasAtBottom)) {
      scrollToBottom(true);
    }
  });

  // initial scroll
  scrollToBottom(false);
});

// (If this file also lives on the "start chat" page, keep the form helper intact)
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("start-chat-form");
  if (!form || form.__startChatBound) return;
  form.__startChatBound = true;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    try {
      const response = await csrfFetch(this.action, { method: "POST" });
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
