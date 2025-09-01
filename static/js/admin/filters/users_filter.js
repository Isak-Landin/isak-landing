// static/js/admin/filters/users_filter.js
(function () {
  const NS = 'users';

  const DataCache = (function () {
    const store = (window.__AdminDataCache = window.__AdminDataCache || {});
    return {
      get() { return store[NS]; },
      set(data) { store[NS] = data; },
    };
  })();

  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function shortDateISO(d) {
    if (!d) return null;
    const dt = new Date(d);
    if (isNaN(dt)) return null;
    return dt.toISOString();
  }

  function buildToolbar() {
    const host = document.querySelector('#users-table');
    if (!host) return null;
    let bar = host.querySelector('.admin-filter-bar');
    if (bar) return bar;

    bar = el('div', 'admin-filter-bar');
    bar.innerHTML = `
      <div class="filter-row">
        <input type="search" id="uf-q" placeholder="Search name/email…" />
        <select id="uf-active">
          <option value="">Active: Any</option>
          <option value="1">Active: Yes</option>
          <option value="0">Active: No</option>
        </select>
        <input type="date" id="uf-created-from" />
        <input type="date" id="uf-created-to" />
        <input type="number" id="uf-min-vps" min="0" step="1" placeholder="Min VPS" />
        <button type="button" id="uf-clear">Clear</button>
      </div>
    `;
    host.prepend(bar);

    const clear = bar.querySelector('#uf-clear');
    clear.addEventListener('click', () => {
      ['#uf-q', '#uf-active', '#uf-created-from', '#uf-created-to', '#uf-min-vps']
        .forEach(sel => { const n = bar.querySelector(sel); if (n) n.value = ''; });
      requestRender();
    });

    bar.addEventListener('input', (e) => {
      if (['uf-q','uf-created-from','uf-created-to','uf-min-vps'].includes(e.target.id)) requestRender();
    });
    bar.addEventListener('change', (e) => {
      if (['uf-active'].includes(e.target.id)) requestRender();
    });

    return bar;
  }

  function criteriaFromUI() {
    const bar = buildToolbar();
    if (!bar) return {};
    const q   = (bar.querySelector('#uf-q')?.value || '').toLowerCase().trim();
    const act = bar.querySelector('#uf-active')?.value || '';
    const df  = bar.querySelector('#uf-created-from')?.value || '';
    const dt  = bar.querySelector('#uf-created-to')?.value || '';
    const mv  = parseInt(bar.querySelector('#uf-min-vps')?.value || '', 10);
    return {
      q,
      active: act === '' ? null : act === '1',
      created_from: df ? new Date(df + 'T00:00:00Z') : null,
      created_to: dt ? new Date(dt + 'T23:59:59Z') : null,
      min_vps: Number.isFinite(mv) ? mv : null,
    };
  }

  function matches(u, c) {
    // text search
    if (c.q) {
      const hay = [
        u.email || '',
        u.full_name || '',
        (u.first_name || '') + ' ' + (u.last_name || '')
      ].join(' ').toLowerCase();
      if (!hay.includes(c.q)) return false;
    }
    // active
    if (c.active !== null && !!u.is_active !== c.active) return false;
    // created range
    if (c.created_from) {
      const cd = u.created_at ? new Date(u.created_at) : null;
      if (!cd || cd < c.created_from) return false;
    }
    if (c.created_to) {
      const cd = u.created_at ? new Date(u.created_at) : null;
      if (!cd || cd > c.created_to) return false;
    }
    // min vps
    if (c.min_vps !== null && Number(u.vps_count || 0) < c.min_vps) return false;

    return true;
  }

  function filterData(data) {
    const crit = criteriaFromUI();
    const src = Array.isArray(data?.users) ? data.users : [];
    const filtered = src.filter(u => matches(u, crit));
    const out = Object.assign({}, data, { users: filtered });
    return out;
  }

  function requestRender() {
    const base = window.__AdminBaseRender?.[NS];
    const allData = DataCache.get();
    if (typeof base === 'function' && allData) {
      base(filterData(allData));
    }
  }

  function wrapRenderer() {
    window.__AdminBaseRender = window.__AdminBaseRender || {};
    const tryWrap = () => {
      const base = window.AdminRender && window.AdminRender[NS];
      if (typeof base === 'function') {
        window.__AdminBaseRender[NS] = base;
        window.AdminRender[NS] = (data) => {
          DataCache.set(data);
          buildToolbar();
          base(filterData(data));
        };
      } else {
        setTimeout(tryWrap, 50);
      }
    };
    tryWrap();
  }

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wrapRenderer);
  } else {
    wrapRenderer();
  }
})();
