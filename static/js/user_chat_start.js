document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById('start-chat-form');
  if (!form) return;

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
