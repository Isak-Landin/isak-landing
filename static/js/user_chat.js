document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".chat-form");
  const textarea = form?.querySelector("textarea");
  const messagesContainer = document.getElementById("chat-messages");
  const chatIdRaw = messagesContainer?.dataset.chatId;

  if (!form || !textarea || !messagesContainer || !chatIdRaw) {
    console.warn("Chat: missing required DOM elements / chatId", { form, textarea, messagesContainer, chatIdRaw });
    return;
  }

  const chatId = parseInt(chatIdRaw, 10);

  // IMPORTANT: let Socket.IO manage transports, and set the path to match Nginx
  const socket = io({
    path: '/socket.io/' // <- make sure this matches your Nginx location (see server fix below)
    // DO NOT force transports here; allow fallback while you confirm proxy
  });

  socket.on('connect', () => {
    console.log('Socket connected', socket.id);
    socket.emit('join_chat', { chat_id: chatId });
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connect_error', err);
  });

  socket.on('error', (err) => {
    console.error('Socket error event', err);
  });

  socket.on("receive_message", data => {
    console.log('receive_message', data);
    if (data.chat_id !== chatId) return;

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("chat-message", data.sender);
    msgDiv.innerHTML = `
      <strong>${data.sender.charAt(0).toUpperCase() + data.sender.slice(1)}:</strong> ${data.message}
      <br><small>${data.timestamp}</small>
    `;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const message = textarea.value.trim();
    if (!message) return;

    console.log('emit send_message', { chat_id: chatId, sender: 'user', message });
    socket.emit('send_message', {
      chat_id: chatId,
      sender: 'user',
      message
    });

    textarea.value = "";
  });
});
