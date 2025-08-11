// Fills the VPS table without touching users/subscriptions.
// Safe to include alongside other admin scripts.

(function () {
  const ENDPOINT = '/admin/api/dashboard-data';

  async function fetchDashboard() {
    const res = await fetch(ENDPOINT, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function fmt(x) { return (x === null || x === undefined) ? '' : String(x); }

  function renderVps(list = []) {
    const tbody = document.getElementById('vps-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    list.forEach(v => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmt(v.hostname)}</td>
        <td>${fmt(v.ip_address)}</td>
        <td>${fmt(v.os)}</td>
        <td>${fmt(v.cpu_cores)} cores</td>
        <td>${fmt(v.ram_mb)} MB</td>
        <td>${fmt(v.owner_email)}</td>
      `;
      tbody.appendChild(tr);
    });
    const count = document.getElementById('vps-count');
    if (count) count.textContent = list.length;
  }

  // Auto-run on load, but do nothing if table isn't present
  document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('vps-body');
    if (!tbody) return;
    try {
      const data = await fetchDashboard();
      renderVps(data.vps || []);
    } catch (e) {
      console.error('VPS load failed', e);
    }
  });
})();
