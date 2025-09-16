// static/js/chat/chat-input.js
(function () {
  // ---- Promise-based ACK helper ----
  function emitWithAck(socket, event, payload, timeout = 8000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('timeout')); }
      }, timeout);

      try {
        socket.emit(event, payload, (ack) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (ack && ack.ok) resolve(ack);
          else reject(new Error(ack?.error || 'send_failed'));
        });
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      }
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
    textareaSelector = 'textarea[name="message"]',
    buttonSelector   = 'button[type="submit"]',
    onSubmit,                 // async (text) => { ... }
    submitGuardMs = 1000      // minimal time between submits
  } = {}) {
    if (!formEl) return;
    if (formEl.dataset.chatInputBound === '1') return; // prevent double binding
    formEl.dataset.chatInputBound = '1';

    const textarea = formEl.querySelector(textareaSelector);
    const btn      = formEl.querySelector(buttonSelector);
    if (!textarea || !btn) return;

    let lastSubmitAt = 0;
    let pending = false; // hard lock while a send is in flight
    let lastEnterTs = 0;

    // Enter to send; Shift+Enter = newline
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const now = Date.now();
        // throttle Enter presses to avoid dupes from key repeat
        if (now - lastEnterTs < 450) { e.preventDefault(); return; }
        lastEnterTs = now;
        e.preventDefault();
        // trigger submit without causing duplicate listeners
        formEl.requestSubmit ? formEl.requestSubmit() : formEl.submit();
      }
    });

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();

      // guard: block rapid re-submits and in-flight sends
      const now = Date.now();
      if (pending || (now - lastSubmitAt < submitGuardMs)) return;
      lastSubmitAt = now;

      const text = (textarea.value || '').trim();
      if (!text) return;

      const prevDisabled = btn.disabled;
      pending = true;
      btn.disabled = true;

      try {
        await onSubmit?.(text);
        // Clear immediately; render comes from socket echo
        textarea.value = '';
      } catch (err) {
        console.warn('[chat-input] submit error:', err);
      } finally {
        // small delay to avoid bounce on flaky networks
        setTimeout(() => {
          btn.disabled = prevDisabled ? true : false;
          pending = false;
          textarea.focus();
        }, 400);
      }
    });
  }

  // Auto-init
  function autoInit() {
    const chatEl = document.getElementById('chat-messages');
    if (!chatEl) return;
    const chatIdRaw = chatEl.dataset.chatId;
    if (!chatIdRaw) return;

    const chatId = Number(chatIdRaw);
    if (!Number.isInteger(chatId)) return;

    // Find either user or admin form
    const form =
      document.getElementById('chat-form') ||
      document.getElementById('admin-chat-form');
    if (!form) return;

    const USE_ACK = true; // server returns {"ok": True, ...}

    init(form, {
      onSubmit: async (text) => {
        const sock = await waitForSocketReady(8000);
        const payload = {
          chat_id: chatId,   // number; server derives sender
          message: text
        };

        if (USE_ACK) {
          await emitWithAck(sock, 'send_message', payload, 12000);
        } else {
          sock.emit('send_message', payload);
        }
      }
    });
  }

  window.ChatInput = { init }; // available for manual init if needed

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
  // In case socket connects late
  window.addEventListener('load', autoInit);
})();
