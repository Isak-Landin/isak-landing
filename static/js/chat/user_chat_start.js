// static/js/user_chat_start.js
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ user_chat_start.js loaded");
  const form = document.getElementById('start-chat-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    try {
      // Collect form data (keeps existing fields intact)
      const formData = new FormData(form);

      // Use csrfFetch so X-CSRF-Token header is attached automatically
      const res = await csrfFetch(form.action || '/chat/start', {
        method: 'POST',
        body: formData
      });

      // Decide how to parse based on Content-Type
      const ctype = res.headers.get('content-type') || '';
      let data = null;
      if (ctype.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        // If server didn’t return JSON, wrap it so we can show a helpful message
        data = { success: res.ok, error: text };
      }

      // Success path
      if (res.ok && data && (data.chat_id || (data.success && data.chat_id))) {
        window.location.href = `/chat/view?chat_id=${data.chat_id}`;
        return;
      }
      if (res.ok && data && data.redirect) {
        window.location.href = data.redirect;
        return;
      }

      // Error path (handle common CSRF/validation issues)
      const msg =
        (data && (data.error || data.message)) ||
        `Failed to start chat (HTTP ${res.status}).`;

      console.error("Chat start failed:", { status: res.status, data });
      alert(msg);
    } catch (err) {
      console.error("Chat start error:", err);
      alert("Unable to start chat. Please try again later.");
    }
  });
});
