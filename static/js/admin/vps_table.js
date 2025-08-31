// static/js/admin/vps_table.js
(function () {
  const TAG = '[admin/vps]';

  // Always log when the script is loaded (helps detect cache / wrong path)
  console.log(TAG, 'vps_table.js loaded');

  function fmt(x) { return (x === null || x === undefined) ? '' : String(x); }

  function renderVps(data) {
    try {
      console.groupCollapsed(TAG, 'renderVps() called');
      console.log(TAG, 'payload keys:', data ? Object.keys(data) : 'null/undefined');

      const tbody = document.getElementById('vps-body');
      if (!tbody) {
        console.error(TAG, 'Missing #vps-body element. Check admin_dashboard.html IDs.');
        console.groupEnd();
        return;
      }

      const list = Array.isArray(data?.vps) ? data.vps : [];
      console.log(TAG, `rows: ${list.length}`);
      if (list.length) console.table(list.slice(0, Math.min(10, list.length)));

      tbody.innerHTML = '';
      const t0 = performance.now();

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

      const t1 = performance.now();
      const count = document.getElementById('vps-count');
      if (count) count.textContent = list.length;
      console.log(TAG, `rendered ${list.length} rows in ${(t1 - t0).toFixed(1)}ms`);
    } catch (err) {
      console.error(TAG, 'render error:', err);
    } finally {
      console.groupEnd();
    }
  }

  // Register renderer
  window.AdminRender = window.AdminRender || {};
  window.AdminRender.vps = renderVps;

  // Handy console helper to test without the API/controller:
  window.__debugRenderVps = function (n = 3) {
    const sample = {
      vps: Array.from({ length: n }, (_, i) => ({
        hostname: `demo-${i + 1}`,
        ip_address: `10.0.0.${i + 10}`,
        os: 'Ubuntu 24.04',
        cpu_cores: 2,
        ram_mb: 2048,
        owner_email: 'demo@example.com'
      }))
    };
    renderVps(sample);
  };
})();
