// static/js/chat/chat-typing.js
(function () {
  function autoInit() {
    const socket = window.socket;
    if (!socket || !socket.emit) return;

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

    // --- Create/find UI row just above the form
    let typingRow = form.parentElement.querySelector('.typing-indicator');
    if (!typingRow) {
      typingRow = document.createElement('div');
      typingRow.className = 'typing-indicator';
      typingRow.style.display = 'none';
      const isAdminPage = form.id === 'admin-chat-form';
      typingRow.innerHTML = (isAdminPage ? 'User is typing' : 'Support is typing') + ' <span class="dots" aria-hidden="true"><span></span><span></span><span></span></span>';
      typingRow.setAttribute('aria-live', 'polite');
      typingRow.setAttribute('role', 'status');
      form.parentElement.insertBefore(typingRow, form);
    }

    // ====== LOCAL EMIT SMOOTHING ======
    const START_THROTTLE_MS = 1000;  // don't spam "true"
    const STOP_IDLE_MS      = 12000;  // emit "false" after idle
    let lastStartSent = 0;
    let stopTimer = null;
    let isFocused = false;

    const sendStart = () => {
      const now = Date.now();
      if (now - lastStartSent >= START_THROTTLE_MS) {
        socket.emit('typing', { chat_id: chatId, isTyping: true });
        lastStartSent = now;
      }
    };
    const scheduleStop = () => {
      if (stopTimer) clearTimeout(stopTimer);
      stopTimer = setTimeout(() => {
        socket.emit('typing', { chat_id: chatId, isTyping: false });
      }, STOP_IDLE_MS);
    };

    textarea.addEventListener('focus', () => { isFocused = true; });
    textarea.addEventListener('blur',  () => {
      isFocused = false;
      if (stopTimer) clearTimeout(stopTimer);
      socket.emit('typing', { chat_id: chatId, isTyping: false });
    });

    textarea.addEventListener('input', () => {
      if (!isFocused) return;
      sendStart();     // immediate (throttled) start
      scheduleStop();  // restart idle-stop timer
    });

    // ====== REMOTE DISPLAY SMOOTHING ======
    const REMOTE_HIDE_DELAY_MS = 12000; // keep visible for a bit after last TRUE
    let remoteHideTimer = null;

    function showTyping() {
      typingRow.style.display = 'block';
      if (remoteHideTimer) clearTimeout(remoteHideTimer);
      remoteHideTimer = setTimeout(() => {
        typingRow.style.display = 'none';
      }, REMOTE_HIDE_DELAY_MS);
    }

    socket.on('typing', (payload) => {
      if (!payload || Number(payload.chat_id) !== chatId) return;
      // Only react to TRUE to prevent flicker; the timer will hide it.
      if (payload.isTyping) showTyping();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
