// static/js/chat/chat-typing.js
(function () {
  // tiny debounce
  function debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function autoInit() {
    const socket = window.socket;
    if (!socket || !socket.emit) return;                 // require shared global socket

    const chatEl = document.getElementById('chat-messages');
    if (!chatEl) return;
    const chatId = Number(chatEl.dataset.chatId);
    if (!Number.isInteger(chatId)) return;

    const form =
      document.getElementById('chat-form') ||
      document.getElementById('admin-chat-form');
    if (!form) return;

    const textarea = form.querySelector('textarea');
    if (!textarea) return;

    // Create or find the indicator row (placed just above the form)
    let typingRow = form.parentElement.querySelector('.typing-indicator');
    if (!typingRow) {
      typingRow = document.createElement('div');
      typingRow.className = 'typing-indicator';
      typingRow.style.display = 'none';
      // Label differs by page: show the *other side* is typing
      const isAdminPage = form.id === 'admin-chat-form';
      typingRow.textContent = isAdminPage ? 'User is typing…' : 'Support is typing…';
      form.parentElement.insertBefore(typingRow, form);
    }

    // Emit local typing state (debounced start/stop)
    const sendTyping = (isTyping) => {
      socket.emit('typing', { chat_id: chatId, isTyping });
    };
    const debouncedStart = debounce(() => sendTyping(true), 150);
    const debouncedStop  = debounce(() => sendTyping(false), 350);

    let isFocused = false;
    textarea.addEventListener('input', () => {
      if (!isFocused) return;
      debouncedStart();
      // schedule a stop a bit after last keystroke
      debouncedStop();
    });
    textarea.addEventListener('focus', () => { isFocused = true; });
    textarea.addEventListener('blur',  () => { isFocused = false; sendTyping(false); });

    // Receive remote typing (server should NOT echo to sender)
    socket.on('typing', (payload) => {
      if (!payload) return;
      if (Number(payload.chat_id) !== chatId) return;

      const show = !!payload.isTyping;
      typingRow.style.display = show ? 'block' : 'none';
    });
  }

  // run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
