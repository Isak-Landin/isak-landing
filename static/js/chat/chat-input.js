// static/js/chat/chat-input.js
(function () {
  // ---- Promise-based ACK helper (optional) ----
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

  // ---- Wait for the existing window.socket to be connected ----
  async function waitForSocketReady(maxWaitMs = 8000) {
    if (window.socket && window.socket.connected) return window.socket;

    if (window.socket) {
      return new Promise((resolve, reject) => {
        const onConnect = () => { cleanup(); resolve(window.socket); };
        const onTimeout = () => { cleanup(); reject(new Error('socket_connect_timeout')); };
        const cleanup = () => {
          clearTimeout(timer);
          window.socket.off?.('connect', onConnect);
        };
        const timer = setTimeout(onTimeout, maxWaitMs);
        window.socket.on?.('connect', onConnect);
      });
    }

    throw new Error('socket_not_found');
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

    // Decide sender based on form id
    const sender = form.id === 'admin-chat-form' ? 'admin' : 'user';

    // Toggle this to true AFTER we add ack support on the server
    const USE_ACK = true;

    init(form, {
      onSubmit: async (text) => {
        const sock = await waitForSocketReady(8000);

        const payload = {
          chat_id: chatId,
          message: text,
          sender   // 'user' or 'admin' — matches your server
        };

        if (USE_ACK) {
          // Requires your Flask-SocketIO handler to return an ack dict
          await emitWithAck(sock, 'send_message', payload, 12000);
        } else {
          // Fire-and-forget with current server (no ack). If this throws, it’s a client-side problem.
          sock.emit('send_message', payload);
        }
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
