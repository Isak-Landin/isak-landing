// static/js/chat/chat-input.js
(function () {
  function emitWithAck(socket, event, payload, timeout = 8000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const t = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('timeout')); }
      }, timeout);

      socket.emit(event, payload, (ack) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        if (ack && ack.ok) resolve(ack);
        else reject(new Error(ack?.error || 'send_failed'));
      });
    });
  }

  function init(formEl, {
    textareaSelector = 'textarea',
    buttonSelector = 'button[type="submit"]',
    onSubmit,                 // async (text) => { ... }
    submitGuardMs = 1000
  } = {}) {
    if (!formEl) return;
    if (formEl.dataset.chatInputBound === '1') return; // prevent double binding
    formEl.dataset.chatInputBound = '1';

    const textarea = formEl.querySelector(textareaSelector);
    const btn = formEl.querySelector(buttonSelector);
    if (!textarea || !btn) return;

    let lastSubmitAt = 0;

    // Enter sends, Shift+Enter adds newline
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        formEl.requestSubmit ? formEl.requestSubmit() : formEl.submit();
      }
    });

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastSubmitAt < submitGuardMs) return;
      lastSubmitAt = now;

      const text = textarea.value.trim();
      if (!text) return;

      const prevDisabled = btn.disabled;
      btn.disabled = true;

      try {
        await onSubmit?.(text);
        textarea.value = '';
      } catch (err) {
        console.warn('chat-input submit error:', err);
      } finally {
        btn.disabled = prevDisabled ? true : false;
        textarea.focus();
      }
    });
  }

  // Auto-init: no page wiring required
  function autoInit() {
    const chatEl = document.getElementById('chat-messages');
    if (!chatEl) return;
    const chatId = chatEl.dataset.chatId;
    if (!chatId) return;

    // Find either user or admin form
    const form =
      document.getElementById('chat-form') ||
      document.getElementById('admin-chat-form');
    if (!form) return;

    init(form, {
      onSubmit: async (text) => {
        // Use existing socket if present, else create a lean one
        let sock = window.socket;
        if (!sock && typeof io === 'function') {
          // cache so we don't open multiple
          sock = window.__chatInputSocket || (window.__chatInputSocket = io());
        }
        if (!sock) {
          throw new Error('Socket not available');
        }

        await emitWithAck(sock, 'chat:send', { chat_id: chatId, content: text });
      }
    });
  }

  window.ChatInput = { init }; // still available if you ever want manual init

  // Ensure we run after DOM is ready; also try again after load in case socket is late
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
  window.addEventListener('load', () => {
    // re-attempt if form existed but socket was late; init() guards duplicate bind
    autoInit();
  });
})();
