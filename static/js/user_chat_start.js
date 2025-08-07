document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById('start-chat-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const response = await fetch(this.action, { method: 'POST' });
    const result = await response.json();
    if (result.chat_id) {
      window.location.href = "/chat/view";
    } else {
      alert("Something went wrong starting your chat.");
    }
  });
});
