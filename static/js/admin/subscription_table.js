// static/js/admin/subscription_table.js
(function () {
  const TAG = '[admin/subs]';

  // Simple helpers
  const qs  = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = x => (x === null || x === undefined) ? '' : String(x);

  async function provision(subId, hostname, os) {
    const res = await fetch('/admin/api/provision-vps', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        subscription_id: Number(subId),
        hostname: hostname || `vps-${subId}`,
        os: os || 'Ubuntu 24.04'
      }),
      credentials: 'same-origin'
    });
    let json;
    try { json = await res.json(); } catch (_) {}
    if (!res.ok || !json || json.ok === false) {
      const msg = (json && (json.error || json.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json; // { ok: true, vps_id, idempotent? }
  }

  function renderSubs(data) {
    const tbody = document.getElementById('subs-body');
    if (!tbody) {
      console.error(TAG, 'Missing #subs-body');
      return;
    }

    const list = Array.isArray(data?.subscriptions) ? data.subscriptions : [];
    tbody.innerHTML = '';

    list.forEach(s => {
      const tr = document.createElement('tr');
      // Action cell: hostname input + button
      const defaultHost = `vps-${s.id}`;
      tr.innerHTML = `
        <td>${fmt(s.owner_email)}</td>
        <td>${fmt(s.plan)}</td>
        <td>${fmt(s.interval)}</td>
        <td>${fmt(s.status)}</td>
        <td>${fmt(s.price)}</td>
        <td>
          <div class="inline-provision">
            <input class="prov-host" type="text" value="${defaultHost}" aria-label="Hostname">
            <button class="prov-btn" data-sub="${s.id}" type="button">Provision</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Delegate click events for the table
    tbody.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('.prov-btn');
      if (!btn) return;

      const subId = btn.getAttribute('data-sub');
      const tr = btn.closest('tr');
      const hostInput = tr.querySelector('.prov-host');
      const hostname = (hostInput?.value || '').trim();

      btn.disabled = true;
      const oldTxt = btn.textContent;
      btn.textContent = 'Provisioning…';

      try {
        const result = await provision(subId, hostname, 'Ubuntu 24.04');
        console.log(TAG, 'Provisioned', result);

        // Refresh dataset (simulate pressing your existing refresh button)
        document.getElementById('admin-refresh')?.click();

        // Flip to VPS tab so you immediately see the new row
        document.getElementById('tab-vps')?.click();
      } catch (err) {
        console.error(TAG, 'Provision failed:', err);
        alert(`Provision failed: ${err.message || err}`);
      } finally {
        btn.disabled = false;
        btn.textContent = oldTxt;
      }
    });
  }

  // Expose renderer
  window.AdminRender = window.AdminRender || {};
  window.AdminRender.subs = renderSubs;
})();
