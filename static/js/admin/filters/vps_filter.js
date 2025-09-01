// static/js/admin/filters/vps_filter.js
(function () {
  const NS = 'vps';

  const DataCache = (function () {
    const store = (window.__AdminDataCache = window.__AdminDataCache || {});
    return { get(){return store[NS];}, set(d){store[NS]=d;} };
  })();

  function el(tag, cls, html){ const n=document.createElement(tag); if(cls)n.className=cls; if(html!=null)n.innerHTML=html; return n; }

  function buildToolbar() {
    const host = document.querySelector('#vps-table');
    if (!host) return null;
    let bar = host.querySelector('.admin-filter-bar');
    if (bar) return bar;

    bar = el('div','admin-filter-bar', `
      <div class="filter-row">
        <input type="search" id="vf-q" placeholder="Search hostname/owner/os/ip…" />
        <select id="vf-status">
          <option value="">Status: Any</option>
          <option>pending</option><option>provisioning</option><option>active</option>
          <option>suspended</option><option>terminated</option><option>canceled</option><option>ended</option>
        </select>
        <select id="vf-prov">
          <option value="">Provisioning: Any</option>
          <option>pending</option><option>provisioning</option><option>ready</option>
        </select>
        <select id="vf-ready">
          <option value="">Ready: Any</option>
          <option value="1">Ready</option>
          <option value="0">Not Ready</option>
        </select>
        <button type="button" id="vf-clear">Clear</button>
      </div>
    `);
    host.prepend(bar);

    bar.addEventListener('input', (e) => {
      if (['vf-q'].includes(e.target.id)) requestRender();
    });
    bar.addEventListener('change', (e) => {
      if (['vf-status','vf-prov','vf-ready'].includes(e.target.id)) requestRender();
    });
    bar.querySelector('#vf-clear').addEventListener('click', () => {
      ['#vf-q','#vf-status','#vf-prov','#vf-ready'].forEach(sel=>{
        const n=bar.querySelector(sel); if(n) n.value='';
      });
      requestRender();
    });

    return bar;
  }

  function criteriaFromUI() {
    const bar = buildToolbar(); if(!bar) return {};
    const q  = (bar.querySelector('#vf-q')?.value || '').toLowerCase().trim();
    const st = (bar.querySelector('#vf-status')?.value || '').toLowerCase();
    const pv = (bar.querySelector('#vf-prov')?.value || '').toLowerCase();
    const rd = bar.querySelector('#vf-ready')?.value || '';
    return {
      q,
      status: st || null,
      provisioning: pv || null,
      ready: rd === '' ? null : rd === '1',
    };
  }

  function matches(v, c) {
    if (c.q) {
      const hay = [
        v.hostname || '',
        v.owner_email || '',
        v.os || '',
        v.ip_address || ''
      ].join(' ').toLowerCase();
      if (!hay.includes(c.q)) return false;
    }
    if (c.status && String(v.status || '').toLowerCase() !== c.status) return false;
    if (c.provisioning && String(v.provisioning_status || '').toLowerCase() !== c.provisioning) return false;
    if (c.ready !== null && (!!v.is_ready) !== c.ready) return false;
    return true;
  }

  function filterData(data) {
    const crit = criteriaFromUI();
    const src = Array.isArray(data?.vps) ? data.vps : [];
    const filtered = src.filter(v => matches(v, crit));
    return Object.assign({}, data, { vps: filtered });
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
