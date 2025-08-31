// static/js/admin/subscription_table.js
(function () {
  const TAG = '[admin/subs]';
  const fmt = x => (x === null || x === undefined) ? '' : String(x);

  async function provisionAndOpen(subId) {
    const res = await fetch('/admin/api/provision-vps', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      credentials: 'same-origin',
      body: JSON.stringify({
        subscription_id: Number(subId),
        hostname: `vps-${subId}`,     // default; backend requires a hostname
        os: 'Ubuntu 24.04'
      })
    });

    let json;
    try { json = await res.json(); } catch { json = null; }
    if (!res.ok || !json || json.ok === false) {
      throw new Error((json && (json.error || json.message)) || `HTTP ${res.status}`);
    }

    // Both fresh + idempotent responses include vps_id in your API
    const vpsId = json.vps_id;
    if (!vpsId) throw new Error('No vps_id returned from provision API');

    // Go to the admin VPS detail page you created
    window.location.href = `/admin/vps/${vpsId}`;
  }

  function renderSubs(data) {
    const tbody = document.getElementById('subs-body');
    if (!tbody) {
      console.error(TAG, 'Missing #subs-body element');
      return;
    }

    const list = Array.isArray(data?.subscriptions) ? data.subscriptions : [];
    tbody.innerHTML = '';

    list.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmt(s.owner_email)}</td>
        <td>${fmt(s.plan)}</td>
        <td>${fmt(s.interval)}</td>
        <td>${fmt(s.status)}</td>
        <td>${fmt(s.price)}</td>
        <td>
          <button class="provision-open-btn" data-sub="${s.id}" type="button">
            Provision & Open
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // ONE delegated handler; prevents other legacy listeners from hijacking the click
    tbody.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('.provision-open-btn');
      if (!btn) return;

      ev.preventDefault();
      ev.stopPropagation();

      const subId = btn.getAttribute('data-sub');
      const old = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Provisioning…';

      try {
        await provisionAndOpen(subId);
      } catch (err) {
        console.error(TAG, 'Provision failed:', err);
        alert(`Provision failed: ${err.message || err}`);
        btn.disabled = false;
        btn.textContent = old;
      }
    }, { once: true }); // attach once per render; the handler handles all row clicks
  }

  // Register renderer for the tabs controller
  window.AdminRender = window.AdminRender || {};
  window.AdminRender.subs = renderSubs;
})();
