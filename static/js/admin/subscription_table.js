// static/js/admin/subscription_table.js
(function () {
  const fmt = x => (x === null || x === undefined) ? '' : String(x);

  const isVpsReady = (s) => {
    const provReady = (s.vps_provisioning_status || '').toLowerCase() === 'ready';
    const activeReady = (s.vps_status || '').toLowerCase() === 'active' && !!s.vps_is_ready;
    return provReady || activeReady;
  };

  async function provisionAndOpen(subId) {
    const res = await csrfFetch('/admin/api/provision-vps', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      credentials: 'same-origin',
      body: JSON.stringify({
        subscription_id: Number(subId),
        os: 'Ubuntu 24.04'
      })
    });
    let json;
    try { json = await res.json(); } catch { json = null; }
    if (!res.ok || !json || json.ok === false) {
      throw new Error((json && (json.error || json.message)) || `HTTP ${res.status}`);
    }
    const vpsId = json.vps_id;
    if (!vpsId) throw new Error('No vps_id returned from provision API');
    window.location.href = `/admin/vps/${vpsId}`;
  }

  function vpsCellHtml(s) {
    if (s.vps_id != null) {
      const status = fmt(s.vps_status) || '—';
      const prov   = fmt(s.vps_provisioning_status) || '';
      const ready  = s.vps_is_ready ? '✓' : '';
      const label  = prov ? `${status} (${prov}) ${ready}`.trim() : `${status} ${ready}`.trim();
      return `<a href="/admin/vps/${s.vps_id}" class="vps-status-link">${label}</a>`;
    }
    return `<span class="vps-status-missing">not provisioned</span>`;
  }

  function actionCellHtml(s) {
    // If VPS exists and is ready → show "Open"
    if (s.vps_id != null && isVpsReady(s)) {
      return `<button class="open-btn" data-vps="${s.vps_id}" type="button">Open</button>`;
    }
    // Otherwise keep "Provision & Open"
    return `<button class="provision-open-btn" data-sub="${s.id}" type="button">Provision & Open</button>`;
  }

  function renderSubs(data) {
    const tbody = document.getElementById('subs-body');
    if (!tbody) return;

    const list = Array.isArray(data?.subscriptions) ? data.subscriptions : [];
    tbody.innerHTML = '';

    list.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmt(s.owner_email)}</td>
        <td>${fmt(s.plan)}</td>
        <td>${fmt(s.interval)}</td>
        <td>${fmt(s.status)}</td>
        <td>${fmt(s.price)}</td>
        <td>${vpsCellHtml(s)}</td>
        <td>${actionCellHtml(s)}</td>
      `;
      tbody.appendChild(tr);
    });

    // Bind events once
    if (tbody.dataset.bound !== '1') {
      tbody.addEventListener('click', async (ev) => {
        const openBtn = ev.target.closest('.open-btn');
        if (openBtn) {
          const vpsId = openBtn.getAttribute('data-vps');
          if (vpsId) window.location.href = `/admin/vps/${vpsId}`;
          return;
        }

        const provBtn = ev.target.closest('.provision-open-btn');
        if (provBtn) {
          ev.preventDefault();
          ev.stopPropagation();
          const subId = provBtn.getAttribute('data-sub');
          const old = provBtn.textContent;
          provBtn.disabled = true;
          provBtn.textContent = 'Provisioning…';
          try {
            await provisionAndOpen(subId);
          } catch (err) {
            alert(`Provision failed: ${err.message || err}`);
            provBtn.disabled = false;
            provBtn.textContent = old;
          }
        }
      });
      tbody.dataset.bound = '1';
    }
  }

  window.AdminRender = window.AdminRender || {};
  window.AdminRender.subs = renderSubs;
})();
