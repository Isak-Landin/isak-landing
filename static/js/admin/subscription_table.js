// static/js/admin/subscription_table.js
(function () {
  const PROVISION = '/admin/api/provision-vps';

  function fmt(x) { return (x === null || x === undefined) ? '' : String(x); }
  function canProvision(status) { return status === 'active' || status === 'trialing'; }

  function renderSubs(data) {
    const tbody = document.getElementById('subs-body');
    if (!tbody) return;
    const list = data.subscriptions || [];
    tbody.innerHTML = '';
    list.forEach(s => {
      const provisioning = s.provisioning || (s.has_vps ? 'provisioned' : 'pending'); // supports both API shapes
      const disabled = (provisioning === 'provisioned' || !canProvision(s.status)) ? 'disabled' : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmt(s.owner_email)}</td>
        <td>${fmt(s.plan)}</td>
        <td>${fmt(s.interval)}</td>
        <td>${fmt(s.status)}</td>
        <td>${fmt(provisioning)}</td>
        <td>${fmt(s.price || '')}</td>
        <td>
          <button class="sub-provision" data-id="${fmt(s.id)}" ${disabled}>Provision</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    const count = document.getElementById('sub-count');
    if (count) count.textContent = list.length;
  }

  // Provision click (kept here; uses current cached table selection)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.sub-provision');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const hostname = prompt('Hostname (e.g., nebula-001):');
    if (!hostname) return;

    btn.disabled = true;
    try {
      const res = await fetch(PROVISION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ subscription_id: id, hostname, os: 'Ubuntu 24.04' })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || `HTTP ${res.status}`);
      alert('Provisioned VPS ID: ' + body.vps_id);
      // Trigger a global refresh to update all counts/tables
      const refreshBtn = document.getElementById('admin-refresh');
      if (refreshBtn) refreshBtn.click();
    } catch (err) {
      console.error(err);
      alert('Provision failed: ' + err.message);
      btn.disabled = false;
    }
  });

  window.AdminRender = window.AdminRender || {};
  window.AdminRender.subs = renderSubs;
})();
