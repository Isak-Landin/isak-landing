document.addEventListener("DOMContentLoaded", () => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

  const socket = io({ transports: ['websocket'] });

  const chatId = document.getElementById("chat-messages").dataset.chatId;
  const form = document.querySelector(".chat-form");
  const textarea = form.querySelector("textarea");
  const messagesContainer = document.getElementById("chat-messages");

  // Join the chat room
  socket.emit("join_chat", { chat_id: chatId });

  // Handle incoming messages
  socket.on("receive_message", data => {
    if (data.chat_id !== parseInt(chatId)) return;

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("chat-message", data.sender);
    msgDiv.innerHTML = `
      <strong>${data.sender.charAt(0).toUpperCase() + data.sender.slice(1)}:</strong> ${data.message}
      <br><small>${data.timestamp}</small>
    `;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  // Handle sending message
  form.addEventListener("submit", e => {
    e.preventDefault();
    const message = textarea.value.trim();
    if (!message) return;

    socket.emit("send_message", {
      chat_id: parseInt(chatId),
      sender: "user",
      message: message
    });

    textarea.value = "";
  });
});
