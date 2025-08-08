// ---- create/share ONE global socket for all chat scripts ----
window.socket = window.socket || io({ transports: ["websocket"] });

document.addEventListener("DOMContentLoaded", () => {
  const socket = window.socket; // reuse the global

  const messagesContainer = document.getElementById("chat-messages");
  if (!messagesContainer) return;

  const chatId = messagesContainer.dataset.chatId;
  const form = document.getElementById("admin-chat-form");
  const textarea = form?.querySelector("textarea");

  // Join the chat room once the DOM is ready
  if (chatId) socket.emit("join_chat", { chat_id: parseInt(chatId, 10) });

  // Scroll to bottom initially (chat-core will also manage this)
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Handle incoming messages
  socket.on("receive_message", (data) => {
    if (parseInt(chatId, 10) !== parseInt(data.chat_id, 10)) return;

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("chat-message", data.sender); // note: 'admin'/'user' classes
    msgDiv.innerHTML = `
      <strong>${data.sender.charAt(0).toUpperCase() + data.sender.slice(1)}:</strong> ${data.message}
      <br><small>${data.timestamp}</small>
    `;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  // Handle sending message
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = textarea.value.trim();
    if (!message) return;

    socket.emit("send_message", {
      chat_id: parseInt(chatId, 10),
      sender: "admin",
      message,
    });

    textarea.value = "";
  });
});
