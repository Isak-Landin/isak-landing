// static/js/admin/users_table.js
(function () {
  function fmt(x) { return (x === null || x === undefined) ? '' : String(x); }

  function renderUsers(data) {
    const tbody = document.getElementById('users-body');
    if (!tbody) return;
    const users = data.users || [];
    tbody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmt(u.email)}</td>
        <td>${Number(u.vps_count || 0)}</td>
      `;
      tbody.appendChild(tr);
    });
    // count is handled by controller, but it's fine to set again:
    const count = document.getElementById('user-count');
    if (count) count.textContent = users.length;
  }

  window.AdminRender = window.AdminRender || {};
  window.AdminRender.users = renderUsers;
})();
