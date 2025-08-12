// static/js/admin/users_table.js
(function () {
  function fmt(x) { return (x === null || x === undefined) ? '' : String(x); }
  function goTo(url) { window.location.href = url; }

  function renderUsers(data) {
    const tbody = document.getElementById('users-body');
    if (!tbody) return;

    const users = data.users || [];
    tbody.innerHTML = '';

    users.forEach(u => {
      const tr = document.createElement('tr');

      // detail url requires u.id from the API
      const detailUrl = (u && u.id != null) ? `/admin/users/${u.id}` : null;

      // Email cell (as link if we have an id)
      const emailTd = document.createElement('td');
      if (detailUrl) {
        const a = document.createElement('a');
        a.href = detailUrl;
        a.textContent = fmt(u.email) || `User #${u.id}`;
        // avoid double navigation when clicking the link inside a clickable row
        a.addEventListener('click', (e) => e.stopPropagation());
        emailTd.appendChild(a);

        // make the whole row clickable/accessibile
        tr.dataset.href = detailUrl;
        tr.classList.add('clickable');
        tr.tabIndex = 0;
        tr.addEventListener('click', () => goTo(detailUrl));
        tr.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goTo(detailUrl);
          }
        });
      } else {
        // graceful fallback if id not present
        emailTd.textContent = fmt(u.email);
      }

      const vpsCountTd = document.createElement('td');
      vpsCountTd.textContent = Number(u.vps_count || 0);

      tr.appendChild(emailTd);
      tr.appendChild(vpsCountTd);
      tbody.appendChild(tr);
    });

    // count also updated by tabs controller; harmless to set again
    const count = document.getElementById('user-count');
    if (count) count.textContent = users.length;
  }

  // hook into the existing tabs controller render registry
  window.AdminRender = window.AdminRender || {};
  window.AdminRender.users = renderUsers;
})();
