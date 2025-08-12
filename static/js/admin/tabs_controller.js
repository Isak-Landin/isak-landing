// static/js/admin/tabs_controller.js
(function () {
  const ENDPOINT = '/admin/api/dashboard-data';

  // Render registry (renderers set these)
  window.AdminRender = window.AdminRender || { users: null, subs: null, vps: null };

  let cache = null;
  let loading = false;

  const tabUsers = document.getElementById('tab-users');
  const tabSubs  = document.getElementById('tab-subs');
  const tabVps   = document.getElementById('tab-vps');

  const usersTable = document.getElementById('users-table');
  const subsTable  = document.getElementById('subs-table');
  const vpsTable   = document.getElementById('vps-table');

  const btnRefresh = document.getElementById('admin-refresh');

  function activate(name) {
    tabUsers?.classList.toggle('active', name === 'users');
    tabSubs ?.classList.toggle('active',  name === 'subs');
    tabVps  ?.classList.toggle('active',   name === 'vps');

    usersTable?.classList.toggle('hidden', name !== 'users');
    subsTable ?.classList.toggle('hidden', name !== 'subs');
    vpsTable  ?.classList.toggle('hidden', name !== 'vps');

    if (cache) {
      render(name, cache);
    } else {
      fetchOnce().then(data => render(name, data)).catch(showError);
    }
  }

  async function fetchOnce(force = false) {
    if (cache && !force) return cache;
    if (loading) return cache; // debounce
    loading = true;

    // visual feedback
    if (btnRefresh) {
      btnRefresh.classList.add('is-loading');
      btnRefresh.disabled = true;
    }

    try {
      const res = await fetch(ENDPOINT, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cache = await res.json();

      // counts
      const u = document.getElementById('user-count');
      const s = document.getElementById('sub-count');
      const v = document.getElementById('vps-count');
      if (u) u.textContent = (cache.users || []).length;
      if (s) s.textContent = (cache.subscriptions || []).length;
      if (v) v.textContent = (cache.vps || []).length;

      return cache;
    } finally {
      loading = false;
      if (btnRefresh) {
        btnRefresh.classList.remove('is-loading');
        btnRefresh.disabled = false;
      }
    }
  }

  function render(name, data) {
    if (name === 'users' && typeof AdminRender.users === 'function') return AdminRender.users(data);
    if (name === 'subs'  && typeof AdminRender.subs  === 'function') return AdminRender.subs(data);
    if (name === 'vps'   && typeof AdminRender.vps   === 'function') return AdminRender.vps(data);
  }

  function showError(err) {
    console.error('Admin dashboard load failed:', err);
    alert('Failed to load admin data.\n' + (err?.message || err));
  }

  // Tabs
  tabUsers?.addEventListener('click', () => activate('users'));
  tabSubs ?.addEventListener('click', () => activate('subs'));
  tabVps  ?.addEventListener('click', () => activate('vps'));

  // Refresh
  btnRefresh?.addEventListener('click', async () => {
    try {
      await fetchOnce(true);
      if (tabUsers?.classList.contains('active')) render('users', cache);
      else if (tabSubs?.classList.contains('active')) render('subs', cache);
      else render('vps', cache);
    } catch (e) {
      showError(e);
    }
  });

  // Default
  activate('users');
})();
