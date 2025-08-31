// static/js/admin/vps_table.js
(function () {
  const TAG = '[admin/vps]';

  // SCREAM on load so we know this file actually executed.
  // Also leave a global flag we can probe immediately after the <script>.
  console.log(TAG, 'vps_table.js LOADED at', new Date().toISOString());
  window.__vpsLoadedStamp = Date.now();

  function fmt(x) { return (x === null || x === undefined) ? '' : String(x); }

  function renderVps(data) {
    console.groupCollapsed(TAG, 'renderVps()');
    try {
      console.log(TAG, 'payload keys:', data ? Object.keys(data) : 'null/undefined');

      const tbody = document.getElementById('vps-body');
      if (!tbody) {
        console.error(TAG, 'Missing #vps-body element. Check the template IDs.');
        return;
      }

      const list = Array.isArray(data?.vps) ? data.vps : [];
      console.log(TAG, `rows: ${list.length}`);
      if (list.length) console.table(list.slice(0, Math.min(10, list.length)));

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
      console.log(TAG, 'render complete.');
    } catch (err) {
      console.error(TAG, 'render error:', err);
    } finally {
      console.groupEnd();
    }
  }

  // Register renderer
  window.AdminRender = window.AdminRender || {};
  window.AdminRender.vps = renderVps;

  // Expose a console helper to simulate rows without API/controller
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
