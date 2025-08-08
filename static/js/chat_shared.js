(function () {
  function initNewMessageIndicator(
    chatEl,
    {
      autoObserve = true,
      showWhenNotAtBottom = true,    // show “Go to latest” when merely scrolled up
      autoscrollOwnMessages = true,  // auto-scroll when the message is mine
      labels = {
        latest: 'Go to latest',
        new: 'New messages'
      }
    } = {}
  ) {
    if (!chatEl) return null;

    if (getComputedStyle(chatEl).position === 'static') {
      chatEl.style.position = 'relative';
    }

    // Create the floating chip
    const indicator = document.createElement('button');
    indicator.type = 'button';
    indicator.className = 'new-messages-indicator';
    indicator.setAttribute('aria-label', 'Jump to latest messages');
    indicator.innerHTML = `<span class="text"></span> <span class="count"></span> ↓`;
    chatEl.appendChild(indicator);

    const textSpan  = indicator.querySelector('.text');
    const countSpan = indicator.querySelector('.count');

    let unseen = 0;
    const THRESHOLD_PX = 8;
    const atBottom = () =>
      chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight <= THRESHOLD_PX;

    const setLatestMode = () => {
      textSpan.textContent = labels.latest;
      countSpan.textContent = '';
      indicator.classList.add('show');
    };
    const setNewMode = () => {
      textSpan.textContent = labels.new;
      countSpan.textContent = unseen > 1 ? `(${unseen})` : '';
      indicator.classList.add('show');
    };
    const hideIndicator = () => indicator.classList.remove('show');

    const updateIndicator = () => {
      // If no scrollable area, hide (prevents weirdness on short lists)
      if (chatEl.scrollHeight <= chatEl.clientHeight) {
        hideIndicator();
        return;
      }
      if (atBottom()) {
        hideIndicator();
        return;
      }
      if (unseen > 0) setNewMode();
      else if (showWhenNotAtBottom) setLatestMode();
      else hideIndicator();
    };

    const scrollToBottom = (smooth = true) => {
      chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    };

    // Scroll handler: if user returns to bottom, clear unseen and hide
    chatEl.addEventListener('scroll', () => {
      if (atBottom()) {
        unseen = 0;
      }
      updateIndicator();
    });

    indicator.addEventListener('click', () => {
      unseen = 0;
      scrollToBottom(true);
      updateIndicator();
    });

    // Public API when a new message is appended
    const onNewMessage = (isMine = false) => {
      if ((isMine && autoscrollOwnMessages) || atBottom()) {
        // Stay “live” if you’re following the conversation or it’s your own message
        unseen = 0;
        scrollToBottom(true);
      } else {
        unseen += 1;
      }
      updateIndicator();
    };

    // Auto observe DOM insertions
    let observer = null;
    if (autoObserve) {
      observer = new MutationObserver((mutations) => {
        let sawMessage = false;
        for (const m of mutations) {
          for (const n of m.addedNodes) {
            if (!(n instanceof HTMLElement)) continue;
            const msg = n.matches?.('.chat-message') ? n : n.querySelector?.('.chat-message');
            if (msg) {
              const isMine = msg.classList.contains('me');
              onNewMessage(isMine);
              sawMessage = true;
            }
          }
        }
        if (!sawMessage) updateIndicator();
      });
      observer.observe(chatEl, { childList: true, subtree: true });
    }

    // On load: jump to bottom once (common chat behavior), then update UI
    scrollToBottom(false);
    updateIndicator();

    return { onNewMessage, scrollToBottom, disconnect: () => observer?.disconnect() };
  }

  window.ChatShared = { initNewMessageIndicator };

  // Auto-init using #chat-messages (works for both admin & user pages)
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('chat-messages');
    if (el) {
      window.__chatIndicator = initNewMessageIndicator(el, {
        autoObserve: true,
        showWhenNotAtBottom: true,   // shows “Go to latest” when you scroll up
        autoscrollOwnMessages: true  // your own messages still autoscroll
      });
    }
  });
})();
