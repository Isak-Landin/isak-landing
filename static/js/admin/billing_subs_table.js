// static/js/admin/billing_subs_table.js
(function () {
  function fmt(x) { return (x === null || x === undefined) ? '' : String(x); }
  function modePill(live) { return live ? 'Live' : 'Test'; }

  function renderBillingSubs(payload) {
    const tbody = document.getElementById('billing-subs-body');
    if (!tbody) return;

    const list = payload && payload.items ? payload.items : [];
    tbody.innerHTML = '';

    list.forEach(r => {
      const tr = document.createElement('tr');
      const created = r.created_at ? new Date(r.created_at).toLocaleString() : '-';
      tr.innerHTML = `
        <td>${created}</td>
        <td>${fmt(r.user_email)}</td>
        <td>${fmt(r.subscription_id)}</td>
        <td>${fmt(r.description)}</td>
        <td >${fmt(r.amount || '-')}</td>
        <td>${fmt(r.status || '-')}</td>
        <td><span class="mode-pill">${modePill(!!r.livemode)}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // hook into the existing render registry
  window.AdminRender = window.AdminRender || {};
  window.AdminRender.billingSubs = renderBillingSubs;
})();
