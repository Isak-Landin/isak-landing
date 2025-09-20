// static/js/admin/tabs_controller.js

// Guard: if helpers didn't load for any reason, don't crash
if (!window.csrfFetch) {
  console.warn("csrfFetch missing — falling back to fetch (GETs will still work).");
  window.csrfFetch = window.fetch.bind(window);
}

(function () {
  const DASHBOARD_ENDPOINT = '/admin/api/dashboard-data';
  const BILLING_SUBS_ENDPOINT = '/admin/api/billing/subscriptions';

  // Render registry (renderers set these)
  window.AdminRender = window.AdminRender || { users: null, subs: null, vps: null, billingSubs: null };

  let cache = null;
  let loading = false;

  // Independent cache for billing subs (separate endpoint)
  let billingCache = null;
  let billingLoading = false;

  const tabUsers   = document.getElementById('tab-users');
  const tabSubs    = document.getElementById('tab-subs');
  const tabVps     = document.getElementById('tab-vps');
  const tabBillSub = document.getElementById('tab-billsubs');   // NEW

  const usersTable = document.getElementById('users-table');
  const subsTable  = document.getElementById('subs-table');
  const vpsTable   = document.getElementById('vps-table');
  const billSubTbl = document.getElementById('billing-subs-table'); // NEW

  const btnRefresh = document.getElementById('admin-refresh');

  function setActive(name) {
    tabUsers?.classList.toggle('active', name === 'users');
    tabSubs ?.classList.toggle('active', name === 'subs');
    tabVps  ?.classList.toggle('active', name === 'vps');
    tabBillSub?.classList.toggle('active', name === 'billingSubs');

    usersTable?.classList.toggle('hidden', name !== 'users');
    subsTable ?.classList.toggle('hidden', name !== 'subs');
    vpsTable  ?.classList.toggle('hidden', name !== 'vps');
    billSubTbl?.classList.toggle('hidden', name !== 'billingSubs');
  }

  function activate(name) {
    setActive(name);
    if (name === 'billingSubs') {
      fetchBillingSubs().then(data => render('billingSubs', data)).catch(showError);
    } else {
      if (cache) render(name, cache);
      else fetchDashboard().then(data => render(name, data)).catch(showError);
    }
  }

  async function fetchDashboard(force = false) {
    if (cache && !force) return cache;
    if (loading) return cache;
    loading = true;

    // visual feedback
    if (btnRefresh) { btnRefresh.classList.add('is-loading'); btnRefresh.disabled = true; }

    try {
      const res = await csrfFetch(DASHBOARD_ENDPOINT, { credentials: 'same-origin' });
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
      if (btnRefresh) { btnRefresh.classList.remove('is-loading'); btnRefresh.disabled = false; }
    }
  }

  async function fetchBillingSubs(force = false) {
    if (billingCache && !force) return billingCache;
    if (billingLoading) return billingCache;
    billingLoading = true;

    if (btnRefresh) { btnRefresh.classList.add('is-loading'); btnRefresh.disabled = true; }

    try {
      const res = await csrfFetch(BILLING_SUBS_ENDPOINT, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      billingCache = await res.json();
      return billingCache;
    } finally {
      billingLoading = false;
      if (btnRefresh) { btnRefresh.classList.remove('is-loading'); btnRefresh.disabled = false; }
    }
  }

  function render(name, data) {
    if (name === 'users'       && typeof AdminRender.users       === 'function') return AdminRender.users(data);
    if (name === 'subs'        && typeof AdminRender.subs        === 'function') return AdminRender.subs(data);
    if (name === 'vps'         && typeof AdminRender.vps         === 'function') return AdminRender.vps(data);
    if (name === 'billingSubs' && typeof AdminRender.billingSubs === 'function') return AdminRender.billingSubs(data);
  }

  function showError(err) {
    console.error('Admin dashboard load failed:', err);
    alert('Failed to load admin data.\n' + (err?.message || err));
  }

  // Tabs
  tabUsers  ?.addEventListener('click', () => activate('users'));
  tabSubs   ?.addEventListener('click', () => activate('subs'));
  tabVps    ?.addEventListener('click', () => activate('vps'));
  tabBillSub?.addEventListener('click', () => activate('billingSubs')); // NEW

  // Refresh
  btnRefresh?.addEventListener('click', async () => {
    try {
      if (tabBillSub?.classList.contains('active')) {
        await fetchBillingSubs(true);
        render('billingSubs', billingCache);
      } else {
        await fetchDashboard(true);
        if (tabUsers?.classList.contains('active')) render('users', cache);
        else if (tabSubs?.classList.contains('active')) render('subs', cache);
        else render('vps', cache);
      }
    } catch (e) { showError(e); }
  });

  // Default
  activate('users');
})();
