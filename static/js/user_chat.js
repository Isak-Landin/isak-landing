document.addEventListener("DOMContentLoaded", () => {
  const socket = io({ transports: ['websocket'] });

  const form = document.querySelector(".chat-form");
  const textarea = form?.querySelector("textarea");
  const messagesContainer = document.getElementById("chat-messages");
  const chatId = messagesContainer?.dataset.chatId;

  if (!form || !textarea || !messagesContainer || !chatId) {
    console.warn("Missing elements for chat. Aborting chat JS.");
    return;
  }

  const parsedChatId = parseInt(chatId);

  // Scroll to bottom on load
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Join the chat room
  socket.emit("join_chat", { chat_id: parsedChatId });

  // Handle incoming messages
  socket.on("receive_message", data => {
    if (data.chat_id !== parsedChatId) return;

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("chat-message", data.sender);
    msgDiv.innerHTML = `
      <strong>${data.sender.charAt(0).toUpperCase() + data.sender.slice(1)}:</strong> ${data.message}
      <br><small>${data.timestamp}</small>
    `;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });

  // Optional: Handle error messages from socket
  socket.on("error", data => {
    console.error("Socket error:", data?.error || "Unknown error");
    alert(data?.error || "An unknown error occurred in the chat.");
  });

  // Handle sending message
  form.addEventListener("submit", e => {
    e.preventDefault();
    const message = textarea.value.trim();
    if (!message) return;

    socket.emit("send_message", {
      chat_id: parsedChatId,
      sender: "user",
      message: message
    });

    textarea.value = "";
  });
});
