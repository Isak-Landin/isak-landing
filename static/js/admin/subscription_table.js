// Handles subscriptions list and simple actions without touching other tabs.
(function () {
  const DASHBOARD = '/admin/api/dashboard-data';
  const PROVISION = '/admin/api/provision-vps';  // optional if you implemented it

  function fmt(x) { return (x === null || x === undefined) ? '' : String(x); }
  function canProvision(status) { return status === 'active' || status === 'trialing'; }

  function computeProvisioning(sub) {
    // If your API includes a boolean like sub.has_vps, use that.
    // Otherwise, if an API returns vps list separately, we can't know here.
    // For now expect API to send sub.provisioning ("pending"|"provisioned")
    return sub.provisioning || 'pending';
  }

  function renderSubs(list = []) {
    const tbody = document.getElementById('subs-body');
    const count = document.getElementById('sub-count');
    if (!tbody) return;

    tbody.innerHTML = '';
    list.forEach(s => {
      const prov = computeProvisioning(s);
      const disableProvision = (prov === 'provisioned' || !canProvision(s.status)) ? 'disabled' : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmt(s.owner_email)}</td>
        <td>${fmt(s.plan)}</td>
        <td>${fmt(s.interval)}</td>
        <td>${fmt(s.status)}</td>
        <td>${fmt(prov)}</td>
        <td>${fmt(s.price || '')}</td>
        <td>
          <button class="sub-provision" data-id="${fmt(s.id)}" ${disableProvision}>Provision</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    if (count) count.textContent = list.length;
  }

  async function fetchDashboard() {
    const res = await fetch(DASHBOARD, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function loadSubs() {
    try {
      const data = await fetchDashboard();
      renderSubs(data.subscriptions || []);  // tolerate missing key
    } catch (e) {
      console.error('Subscriptions load failed', e);
    }
  }

  // Provision button (admin-only endpoint)
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      alert('Provisioned VPS ID: ' + data.vps_id);
      await loadSubs(); // refresh provisioning column
    } catch (err) {
      console.error(err);
      alert('Provision failed: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // Auto-run when subs table exists
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('subs-table')) loadSubs();
  });
})();
