(function () {
  const opts = (window.ADMIN_CHAT_OPTS || {});
  const log = (...a) => { if (opts.log) console.log('[admin-chat-debug]', ...a); };
  const error = (...a) => console.error('[admin-chat-debug]', ...a);

  // ---- DOM hooks (match your template) ----
  const wrap = document.getElementById('chat-messages');       // <div id="chat-messages" data-chat-id="...">
  const form = document.getElementById('admin-chat-form');      // <form id="admin-chat-form">...
  const ta = form ? form.querySelector('textarea[name="message"]') : null;
  const CHAT_ID = Number(opts.chatId || wrap?.dataset?.chatId || 0);

  if (!wrap) return error('Missing #chat-messages container');
  if (!CHAT_ID) log('No chatId detected on page (data-chat-id). History fetch will be skipped.');

  // ---- basic message templating (matches your server-side classes) ----
  function renderMessageList(list) {
    if (!Array.isArray(list)) return;
    // Expect list like: [{content, is_mine, sender_label, timestamp}]
    wrap.innerHTML = list.map(m => `
      <div class="chat-message ${m.is_mine ? 'me' : 'them'}">
        <div class="msg-header">
          <span class="sender">${m.sender_label || (m.is_mine ? 'Admin' : 'User')}</span>
          <span class="timestamp">${m.timestamp || ''}</span>
        </div>
        <div class="msg-body">${m.content || ''}</div>
      </div>
    `).join('');
    wrap.scrollTop = wrap.scrollHeight;
  }

  function appendMessage(m) {
    const tpl = document.createElement('div');
    tpl.className = `chat-message ${m.is_mine ? 'me' : 'them'}`;
    tpl.innerHTML = `
      <div class="msg-header">
        <span class="sender">${m.sender_label || (m.is_mine ? 'Admin' : 'User')}</span>
        <span class="timestamp">${m.timestamp || ''}</span>
      </div>
      <div class="msg-body">${m.content || ''}</div>
    `;
    wrap.appendChild(tpl);
    wrap.scrollTop = wrap.scrollHeight;
  }

  // ---- socket instrumentation (does not replace your existing handlers) ----
  let socket;
  try {
    if (window.io) {
      socket = window.io();
      log('Socket connected?', !!socket);
      socket.on('connect', () => log('socket connect', socket.id));
      socket.on('disconnect', (r) => error('socket disconnect', r));
      socket.on('connect_error', (e) => error('socket connect_error', e && e.message || e));
    } else {
      log('Socket.IO not present on window (ok if you rely on fetch only).');
    }
  } catch (e) {
    error('socket bootstrap failed', e);
  }

  // ---- safe history fetch (non-invasive; backend path is your call) ----
  // Provide ONE of these endpoints on the server if you want auto-history refresh:
  //   /chat/admin/api/chats/<id>/messages
  //   or the one you already expose for admin view.
  async function fetchHistory() {
    if (!CHAT_ID) return;
    const tryUrls = [
      `/chat/admin/api/chats/${CHAT_ID}/messages`,
      `/chat/admin/api/threads/${CHAT_ID}/messages`,
      `/admin/chat/${CHAT_ID}/messages.json`
    ];
    for (const url of tryUrls) {
      try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) { log('history not at', url, res.status); continue; }
        const data = await res.json();
        // Accept {messages:[...]} or [...]
        const list = Array.isArray(data) ? data : (data.messages || []);
        if (list.length) {
          log('history ok via', url, list.length);
          renderMessageList(list);
          return true;
        } else {
          log('history empty via', url);
          return true;
        }
      } catch (e) {
        log('history fetch failed at', url, e && e.message || e);
      }
    }
    return false;
  }

  // optional polling if sockets aren’t pushing
  let pollTimer = null;
  function startPolling() {
    if (!opts.pollMs) return;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(fetchHistory, opts.pollMs);
  }

  // ---- wire form send (non-invasive; lets your existing handler run) ----
  if (form && ta) {
    form.addEventListener('submit', (e) => {
      // Let your existing submit handler do its thing; we just log what would be sent.
      const txt = (ta.value || '').trim();
      if (!txt) return;
      log('submit (debug log only):', { chatId: CHAT_ID, body: txt });
      // If your existing code doesn’t actually send, you can temporarily uncomment:
      // e.preventDefault();
      // fetch(`/chat/admin/api/chats/${CHAT_ID}/send`, {
      //   method: 'POST', headers: { 'Content-Type':'application/json' },
      //   body: JSON.stringify({ body: txt })
      // }).then(r => r.json()).then(() => fetchHistory()).catch(error);
    }, { capture: true }); // capture so we log even if another handler stops propagation
  } else {
    log('No admin form/textarea found on this page (OK if read-only).');
  }

  (async () => {
    await fetchHistory(); // get something on screen even if sockets are quiet
    startPolling();
  })();
})();
