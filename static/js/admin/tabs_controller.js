// static/js/admin/tabs_controller.js
(function () {
  const ENDPOINT = '/admin/api/dashboard-data';

  // Global render registry: other scripts will set these.
  // They must be idempotent and accept the full data object.
  window.AdminRender = window.AdminRender || {
    users: null,          // function (data) { ... }
    subs: null,           // function (data) { ... }
    vps: null             // function (data) { ... }
  };

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

    // Render from cache if we have it
    if (cache) render(name, cache);
    // If no cache yet, fetch once
    else fetchOnce().then(data => render(name, data)).catch(showError);
  }

  async function fetchOnce(force = false) {
    if (cache && !force) return cache;
    if (loading) return cache; // debounce; UI will render when cache fills
    loading = true;
    try {
      const res = await fetch(ENDPOINT, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cache = await res.json();

      // Update summary counts if present
      const u = document.getElementById('user-count');
      const s = document.getElementById('sub-count');
      const v = document.getElementById('vps-count');
      if (u) u.textContent = (cache.users || []).length;
      if (s) s.textContent = (cache.subscriptions || []).length;
      if (v) v.textContent = (cache.vps || []).length;

      return cache;
    } finally {
      loading = false;
    }
  }

  function render(name, data) {
    switch (name) {
      case 'users':
        if (typeof AdminRender.users === 'function') AdminRender.users(data);
        break;
      case 'subs':
        if (typeof AdminRender.subs === 'function') AdminRender.subs(data);
        break;
      case 'vps':
        if (typeof AdminRender.vps === 'function') AdminRender.vps(data);
        break;
    }
  }

  function showError(err) {
    console.error('Admin dashboard load failed:', err);
    alert('Failed to load admin data.\n' + (err && err.message ? err.message : err));
  }

  // Wire tabs
  tabUsers?.addEventListener('click', () => activate('users'));
  tabSubs ?.addEventListener('click', () => activate('subs'));
  tabVps  ?.addEventListener('click', () => activate('vps'));

  // Refresh button
  btnRefresh?.addEventListener('click', async () => {
    btnRefresh.disabled = true;
    try {
      await fetchOnce(true);
      // Re-render current visible tab
      if (tabUsers?.classList.contains('active')) render('users', cache);
      else if (tabSubs?.classList.contains('active')) render('subs', cache);
      else render('vps', cache);
    } catch (e) {
      showError(e);
    } finally {
      btnRefresh.disabled = false;
    }
  });

  // Default tab
  activate('users');
})();
