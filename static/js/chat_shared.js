(function () {
  function initNewMessageIndicator(
    chatEl,
    {
      autoObserve = true,
      showWhenNotAtBottom = true,
      autoscrollOwnMessages = true,
      labels = { latest: 'Go to latest', new: 'New messages' },
      bottomThresholdPx = 2,          // tighter threshold to avoid false “bottom”
      scrollCooldownMs = 300          // ignore autoscroll briefly after user scrolls
    } = {}
  ) {
    if (!chatEl) return null;
    if (getComputedStyle(chatEl).position === 'static') chatEl.style.position = 'relative';

    // Create the floating chip
    const indicator = document.createElement('button');
    indicator.type = 'button';
    indicator.className = 'new-messages-indicator';
    indicator.setAttribute('aria-label', 'Jump to latest messages');
    indicator.innerHTML = `<span class="text"></span> <span class="count"></span> ↓`;
    chatEl.appendChild(indicator);

    const textSpan = indicator.querySelector('.text');
    const countSpan = indicator.querySelector('.count');

    let unseen = 0;
    let userScrolling = false;        // true right after user scrolls
    let userScrollTimer = null;

    const atBottom = () =>
      chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight <= bottomThresholdPx;

    const setLatestMode = () => { textSpan.textContent = labels.latest; countSpan.textContent = ''; indicator.classList.add('show'); };
    const setNewMode    = () => { textSpan.textContent = labels.new;    countSpan.textContent = unseen > 1 ? `(${unseen})` : ''; indicator.classList.add('show'); };
    const hideIndicator = () => indicator.classList.remove('show');

    const updateIndicator = () => {
      // If no scrollable area, hide
      if (chatEl.scrollHeight <= chatEl.clientHeight) { hideIndicator(); return; }
      if (atBottom()) { hideIndicator(); return; }
      if (unseen > 0) setNewMode();
      else if (showWhenNotAtBottom) setLatestMode();
      else hideIndicator();
    };

    const scrollToBottom = (smooth = true) => {
      chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    };

    // Mark that the user is actively scrolling; pause any auto snapping
    const handleUserScroll = () => {
      userScrolling = true;
      if (userScrollTimer) clearTimeout(userScrollTimer);
      userScrollTimer = setTimeout(() => { userScrolling = false; }, scrollCooldownMs);

      if (atBottom()) unseen = 0;
      updateIndicator();
    };
    chatEl.addEventListener('scroll', handleUserScroll, { passive: true });

    indicator.addEventListener('click', () => {
      unseen = 0;
      scrollToBottom(true);
      updateIndicator();
    });

    // Call this when a new message node is appended
    const onNewMessage = (isMine = false, opts = { smooth: true }) => {
      const wasAtBottom = atBottom();        // capture BEFORE any layout changes
      if ((isMine && autoscrollOwnMessages) || (wasAtBottom && !userScrolling)) {
        unseen = 0;
        scrollToBottom(opts.smooth);
      } else {
        unseen += 1;
      }
      updateIndicator();
    };

    // Observe only direct children; avoid subtree churn during scroll
    let observer = null;
    if (autoObserve) {
      observer = new MutationObserver((mutations) => {
        let sawMessage = false;
        for (const m of mutations) {
          // Only watch direct children being added
          for (const n of m.addedNodes) {
            if (!(n instanceof HTMLElement)) continue;
            if (n.classList?.contains('chat-message')) {
              const isMine = n.classList.contains('me');
              onNewMessage(isMine);
              sawMessage = true;
            }
          }
        }
        if (!sawMessage) updateIndicator();
      });
      observer.observe(chatEl, { childList: true, subtree: false });
    }

    // Initial state
    scrollToBottom(false);
    updateIndicator();

    return {
      onNewMessage, scrollToBottom,
      disconnect: () => observer?.disconnect()
    };
  }

  window.ChatShared = { initNewMessageIndicator };

  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('chat-messages');
    if (el) {
      window.__chatIndicator = initNewMessageIndicator(el, {
        autoObserve: true,
        showWhenNotAtBottom: true,
        autoscrollOwnMessages: true,
        bottomThresholdPx: 2,
        scrollCooldownMs: 300
      });
    }
  });
})();
