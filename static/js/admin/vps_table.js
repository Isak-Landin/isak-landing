// static/js/admin/vps_table.js
(function () {
  function fmt(x) { return (x === null || x === undefined) ? '' : String(x); }

  function renderVps(data) {
    const tbody = document.getElementById('vps-body');
    if (!tbody) return;
    const list = data.vps || [];
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

  window.AdminRender = window.AdminRender || {};
  window.AdminRender.vps = renderVps;
})();
