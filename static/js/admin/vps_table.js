// static/js/admin/vps_table.js
(function () {
  const TAG = '[admin/vps]';

  console.log(TAG, 'vps_table.js LOADED at', new Date().toISOString());
  window.__vpsLoadedStamp = Date.now();

  function fmt(x) { return (x === null || x === undefined) ? '' : String(x); }

  function td(text) {
    const cell = document.createElement('td');
    cell.textContent = fmt(text);
    return cell;
  }

  function tdLink(text, href) {
    const cell = document.createElement('td');
    const a = document.createElement('a');
    a.textContent = fmt(text);
    a.href = href;
    a.className = 'vps-link';
    a.title = `Open VPS ${text}`;
    cell.appendChild(a);
    return cell;
  }

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

        // Prefer hostname; if blank, fall back to "vps-<id>" so link has a label.
        const name = v.hostname && v.hostname.trim() ? v.hostname : (v.id != null ? `vps-${v.id}` : '(no name)');
        if (v.id != null) {
          tr.appendChild(tdLink(name, `/admin/vps/${v.id}`));
        } else {
          // no id returned — just show plain text
          tr.appendChild(td(name));
        }

        tr.appendChild(td(v.ip_address));
        tr.appendChild(td(v.os));
        tr.appendChild(td(v.cpu_cores != null ? `${v.cpu_cores} cores` : ''));
        tr.appendChild(td(v.ram_mb != null ? `${v.ram_mb} MB` : ''));
        tr.appendChild(td(v.owner_email));

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

  // Console helper to simulate rows without API/controller
  window.__debugRenderVps = function (n = 3) {
    const sample = {
      vps: Array.from({ length: n }, (_, i) => ({
        id: i + 1,
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
