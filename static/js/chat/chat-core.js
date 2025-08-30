// static/js/chat/chat-core.js

(function () {
  function initNewMessageIndicator(
    chatEl,
    {
      autoObserve = true,
      showWhenNotAtBottom = true,
      autoscrollOwnMessages = true,
      labels = { latest: 'Go to latest', new: 'New messages' },
      bottomThresholdPx = 2,
      scrollCooldownMs = 300
    } = {}
  ) {
    if (!chatEl) return null;
    if (chatEl.__indicatorBound) return chatEl.__indicatorAPI; // prevent double init
    if (getComputedStyle(chatEl).position === 'static') chatEl.style.position = 'relative';

    // --- Sticky overlay ---
    let overlay = chatEl.querySelector('.chat-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'chat-overlay';
      chatEl.appendChild(overlay);
    }

    // --- Single indicator button ---
    let indicator = overlay.querySelector('.new-messages-indicator');
    if (!indicator) {
      indicator = document.createElement('button');
      indicator.type = 'button';
      indicator.className = 'new-messages-indicator';
      indicator.setAttribute('aria-label', 'Jump to latest messages');
      indicator.innerHTML = `<span class="text"></span> <span class="count"></span> ↓`;
      overlay.appendChild(indicator);
    }
    const textSpan = indicator.querySelector('.text');
    const countSpan = indicator.querySelector('.count');

    let unseen = 0;
    let userScrolling = false;
    let userScrollTimer = null;

    const atBottom = () =>
      chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight <= bottomThresholdPx;

    const setLatestMode = () => { textSpan.textContent = labels.latest; countSpan.textContent = ''; indicator.classList.add('show'); };
    const setNewMode    = () => { textSpan.textContent = labels.new;    countSpan.textContent = unseen > 1 ? `(${unseen})` : ''; indicator.classList.add('show'); };
    const hideIndicator = () => indicator.classList.remove('show');

    const updateIndicator = () => {
      if (chatEl.scrollHeight <= chatEl.clientHeight) { hideIndicator(); return; }
      if (atBottom()) { hideIndicator(); return; }
      if (unseen > 0) setNewMode();
      else if (showWhenNotAtBottom) setLatestMode();
      else hideIndicator();
    };

    const scrollToBottom = (smooth = true) => {
      chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    };

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

    // Called when a new message node is appended
    const onNewMessage = (isMine = false, opts = { smooth: true }) => {
      const wasAtBottom = atBottom();
      if ((isMine && autoscrollOwnMessages) || (wasAtBottom && !userScrolling)) {
        unseen = 0;
        scrollToBottom(opts.smooth);
      } else {
        unseen += 1;
      }
      updateIndicator();
    };

    let observer = null;
    if (autoObserve) {
      observer = new MutationObserver((mutations) => {
        let sawMessage = false;
        for (const m of mutations) {
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

    const api = { onNewMessage, scrollToBottom, disconnect: () => observer?.disconnect() };
    chatEl.__indicatorBound = true;
    chatEl.__indicatorAPI = api;
    return api;
  }

  // Create namespace once
  window.ChatShared = window.ChatShared || {};
  window.ChatShared.initNewMessageIndicator = window.ChatShared.initNewMessageIndicator || initNewMessageIndicator;

  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('chat-messages');
    if (el && !el.__indicatorBound) {
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
