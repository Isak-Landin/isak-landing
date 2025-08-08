// static/js/chat_shared.js
(function () {
  function initNewMessageIndicator(chatEl, { autoObserve = true } = {}) {
    if (!chatEl) return null;

    // Ensure the scroll container is positioned
    if (getComputedStyle(chatEl).position === 'static') {
      chatEl.style.position = 'relative';
    }

    // Create the floating chip
    const indicator = document.createElement('button');
    indicator.type = 'button';
    indicator.className = 'new-messages-indicator';
    indicator.setAttribute('aria-label', 'Jump to latest messages');
    indicator.innerHTML = `<span>New messages</span> <span class="count"></span> ↓`;
    chatEl.appendChild(indicator);

    let unseen = 0;
    const THRESHOLD_PX = 8; // treat within 8px of bottom as "at bottom"
    const countSpan = indicator.querySelector('.count');

    const atBottom = () =>
      chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight <= THRESHOLD_PX;

    const showIndicator = () => {
      countSpan.textContent = unseen > 1 ? `(${unseen})` : '';
      indicator.classList.add('show');
    };

    const hideIndicator = () => {
      indicator.classList.remove('show');
    };

    const updateIndicator = () => {
      if (unseen > 0 && !atBottom()) showIndicator();
      else hideIndicator();
    };

    const scrollToBottom = (smooth = true) => {
      chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    };

    // Hide chip when user scrolls back to bottom
    chatEl.addEventListener('scroll', () => {
      if (atBottom()) {
        unseen = 0;
        updateIndicator();
      }
    });

    indicator.addEventListener('click', () => {
      unseen = 0;
      scrollToBottom(true);
      updateIndicator();
    });

    // Public API for manual calls (optional)
    const onNewMessage = (isMine = false) => {
      if (isMine || atBottom()) {
        scrollToBottom(true);
        unseen = 0;
        updateIndicator();
      } else {
        unseen += 1;
        updateIndicator();
      }
    };

    // Auto observe DOM insertions (zero integration work)
    let observer = null;
    if (autoObserve) {
      observer = new MutationObserver((mutations) => {
        let sawNew = false;
        mutations.forEach((m) => {
          m.addedNodes.forEach((n) => {
            if (!(n instanceof HTMLElement)) return;
            // Support both direct .chat-message and wrappers
            const msg = n.matches?.('.chat-message') ? n : n.querySelector?.('.chat-message');
            if (msg) {
              const isMine = msg.classList.contains('me');
              onNewMessage(isMine);
              sawNew = true;
            }
          });
        });
        // If messages were removed or other changes, no-op
        if (sawNew === false) updateIndicator();
      });
      observer.observe(chatEl, { childList: true, subtree: true });
    }

    // Jump to bottom once on load
    scrollToBottom(false);

    return { onNewMessage, scrollToBottom, disconnect: () => observer?.disconnect() };
  }

  // Expose for manual usage
  window.ChatShared = { initNewMessageIndicator };

  // Auto-init on DOM ready if an element exists
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('chat-messages');
    if (el) {
      // Keep a handle in case you want it later (debugging etc.)
      window.__chatIndicator = initNewMessageIndicator(el, { autoObserve: true });
    }
  });
})();
