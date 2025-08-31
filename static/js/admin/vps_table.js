// static/js/admin/vps_table.js
(function () {
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
    cell.appendChild(a);
    return cell;
  }

  function renderVps(data) {
    const tbody = document.getElementById('vps-body');
    if (!tbody) return;

    const list = Array.isArray(data && data.vps) ? data.vps : [];
    tbody.innerHTML = '';

    list.forEach(v => {
      const tr = document.createElement('tr');

      // Build hostname link (fallback label if missing)
      const name = (v.hostname && v.hostname.trim())
        ? v.hostname
        : (v.id != null ? `vps-${v.id}` : '(no name)');

      if (v.id != null) {
        const href = `/admin/vps/${v.id}`;
        tr.appendChild(tdLink(name, href));

        // Make whole row clickable + keyboard accessible
        tr.dataset.href = href;
        tr.tabIndex = 0;
        tr.addEventListener('click', (e) => {
          // If the click was directly on a link, let it work normally
          if (e.target.closest('a')) return;
          window.location.href = tr.dataset.href;
        });
        tr.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.location.href = tr.dataset.href;
          }
        });
      } else {
        // No ID—just plain text
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
  }

  // Register renderer
  window.AdminRender = window.AdminRender || {};
  window.AdminRender.vps = renderVps;
})();
