// static/js/admin/filters/subscriptions_filter.js
(function () {
  const NS = 'subs';

  const DataCache = (function () {
    const store = (window.__AdminDataCache = window.__AdminDataCache || {});
    return { get(){return store[NS];}, set(d){store[NS]=d;} };
  })();

  function el(tag, cls, html) { const n=document.createElement(tag); if(cls)n.className=cls; if(html!=null)n.innerHTML=html; return n; }

  function buildToolbar() {
    const host = document.querySelector('#subs-table');
    if (!host) return null;
    let bar = host.querySelector('.admin-filter-bar');
    if (bar) return bar;

    bar = el('div', 'admin-filter-bar');
    bar.innerHTML = `
      <div class="filter-row">
        <input type="search" id="sf-q" placeholder="Search plan/owner…" />
        <select id="sf-status">
          <option value="">Status: Any</option>
          <option>active</option><option>trialing</option><option>past_due</option>
          <option>canceled</option><option>incomplete</option>
        </select>
        <select id="sf-interval">
          <option value="">Interval: Any</option>
          <option>month</option><option>year</option>
        </select>
        <select id="sf-has-vps">
          <option value="">Has VPS: Any</option>
          <option value="1">Has VPS</option>
          <option value="0">No VPS</option>
        </select>
        <select id="sf-vps-ready">
          <option value="">VPS Ready: Any</option>
          <option value="1">Ready</option>
          <option value="0">Not Ready</option>
        </select>
        <button type="button" id="sf-clear">Clear</button>
      </div>
    `;
    host.prepend(bar);

    bar.addEventListener('input', (e) => {
      if (['sf-q'].includes(e.target.id)) requestRender();
    });
    bar.addEventListener('change', (e) => {
      if (['sf-status','sf-interval','sf-has-vps','sf-vps-ready'].includes(e.target.id)) requestRender();
    });
    bar.querySelector('#sf-clear').addEventListener('click', () => {
      ['#sf-q','#sf-status','#sf-interval','#sf-has-vps','#sf-vps-ready'].forEach(sel=>{
        const n = bar.querySelector(sel); if (n) n.value='';
      });
      requestRender();
    });

    return bar;
  }

  function criteriaFromUI() {
    const bar = buildToolbar(); if (!bar) return {};
    const q   = (bar.querySelector('#sf-q')?.value || '').toLowerCase().trim();
    const st  = (bar.querySelector('#sf-status')?.value || '').toLowerCase();
    const iv  = (bar.querySelector('#sf-interval')?.value || '').toLowerCase();
    const hv  = bar.querySelector('#sf-has-vps')?.value || '';
    const vr  = bar.querySelector('#sf-vps-ready')?.value || '';
    return {
      q,
      status: st || null,
      interval: iv || null,
      has_vps: hv === '' ? null : hv === '1',
      vps_ready: vr === '' ? null : vr === '1',
    };
  }

  function matches(s, c) {
    if (c.q) {
      const hay = [
        s.plan || '',
        s.owner_email || '',
        s.stripe_subscription_id || ''
      ].join(' ').toLowerCase();
      if (!hay.includes(c.q)) return false;
    }
    if (c.status && String(s.status || '').toLowerCase() !== c.status) return false;
    if (c.interval && String(s.interval || '').toLowerCase() !== c.interval) return false;
    if (c.has_vps !== null) {
      const has = s.vps_id != null;
      if (has !== c.has_vps) return false;
    }
    if (c.vps_ready !== null) {
      const ready = !!s.vps_is_ready || String(s.vps_provisioning_status || '').toLowerCase() === 'ready';
      if (ready !== c.vps_ready) return false;
    }
    return true;
    }

  function filterData(data) {
    const crit = criteriaFromUI();
    const src = Array.isArray(data?.subscriptions) ? data.subscriptions : [];
    const filtered = src.filter(s => matches(s, crit));
    return Object.assign({}, data, { subscriptions: filtered });
  }

  function requestRender() {
    const base = window.__AdminBaseRender?.[NS];
    const allData = DataCache.get();
    if (typeof base === 'function' && allData) base(filterData(allData));
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
      } else setTimeout(tryWrap, 50);
    };
    tryWrap();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrapRenderer);
  else wrapRenderer();
})();
