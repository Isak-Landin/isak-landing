// static/js/admin/users_table.js
(function () {
  function fmt(x) { return (x === null || x === undefined) ? '' : String(x); }
  function goTo(url) { window.location.href = url; }
  function shortDate(iso) {
    // expects ISO string; returns "YYYY-MM-DD HH:MM" (local time) or '—'
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return fmt(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function renderUsers(data) {
    const tbody = document.getElementById('users-body');
    if (!tbody) return;

    const users = Array.isArray(data?.users) ? data.users : [];
    tbody.innerHTML = '';

    users.forEach(u => {
      const tr = document.createElement('tr');

      const detailUrl = (u && u.id != null) ? `/admin/users/${u.id}` : null;

      // Email (link)
      const emailTd = document.createElement('td');
      if (detailUrl) {
        const a = document.createElement('a');
        a.href = detailUrl;
        a.textContent = fmt(u.email) || `User #${u.id}`;
        a.addEventListener('click', (e) => e.stopPropagation());
        emailTd.appendChild(a);

        tr.dataset.href = detailUrl;
        tr.classList.add('clickable');
        tr.tabIndex = 0;
        tr.addEventListener('click', () => goTo(detailUrl));
        tr.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(detailUrl); }
        });
      } else {
        emailTd.textContent = fmt(u.email);
      }

      // Name, Created, Last Login, Active, VPS Count
      const nameTd = document.createElement('td');
      nameTd.textContent = u.full_name ? u.full_name : '—';

      const createdTd = document.createElement('td');
      createdTd.textContent = shortDate(u.created_at);

      const lastLoginTd = document.createElement('td');
      lastLoginTd.textContent = shortDate(u.last_login_at);

      const activeTd = document.createElement('td');
      activeTd.textContent = u.is_active ? 'Yes' : 'No';

      const vpsCountTd = document.createElement('td');
      vpsCountTd.textContent = Number(u.vps_count || 0);

      tr.appendChild(emailTd);
      tr.appendChild(nameTd);
      tr.appendChild(createdTd);
      tr.appendChild(lastLoginTd);
      tr.appendChild(activeTd);
      tr.appendChild(vpsCountTd);
      tbody.appendChild(tr);
    });

    const count = document.getElementById('user-count');
    if (count) count.textContent = users.length;
  }

  window.AdminRender = window.AdminRender || {};
  window.AdminRender.users = renderUsers;
})();
