// static/js/vps/cart.js — Mini Cart (Plan + OS + optional SSH key) → POST /vps/checkout
(function () {
  'use strict';

  const CHECKOUT_URL = window.VPS_CHECKOUT_URL || '/vps/checkout';

  const els = {
    drawer:   document.getElementById('vps-mini-cart'),
    backdrop: document.getElementById('vps-mini-cart-backdrop'),
    form:     document.getElementById('vps-mini-cart-form'),
    submit:   document.getElementById('vps-cart-submit'),
    error:    document.getElementById('vps-cart-error'),

    planCodeInput: document.getElementById('vps-cart-plan-code'),
    name:     document.getElementById('vps-cart-name'),
    vcpu:     document.getElementById('vps-cart-vcpu'),
    ram:      document.getElementById('vps-cart-ram'),
    ssd:      document.getElementById('vps-cart-ssd'),
    bw:       document.getElementById('vps-cart-bw'),

    priceAmount:   document.getElementById('vps-cart-price-amount'),
    priceCurrency: document.getElementById('vps-cart-price-currency'),
    priceInterval: document.getElementById('vps-cart-price-interval'),

    planSelect: document.getElementById('vps-cart-plan-select'),
    osSelect:   document.getElementById('vps-cart-os'),
    sshKey:     document.getElementById('vps-cart-ssh'),

    intervalRadios: document.querySelectorAll('input[name="interval"]'),
    acceptLegal:    document.getElementById('vps-cart-accept-legal'),

    closeBtns:  document.querySelectorAll('.vps-cart-close'),
    getButtons: document.querySelectorAll('.plan-btn[data-plan]'),

    catalogTag: document.getElementById('vps-catalog'),
  };

  const catalog = new Map();

  // ---------- UI helpers ----------
  function showDrawer() {
    document.body.classList.add('vps-cart-open');
    if (els.backdrop) els.backdrop.hidden = false;
    if (els.drawer)   els.drawer.setAttribute('aria-hidden', 'false');
  }
  function hideDrawer() {
    document.body.classList.remove('vps-cart-open');
    if (els.backdrop) els.backdrop.hidden = true;
    if (els.drawer)   els.drawer.setAttribute('aria-hidden', 'true');
    clearError();
  }
  function setError(msg) {
    if (!els.error) return;
    els.error.textContent = msg || '';
    els.error.style.display = msg ? 'block' : 'none';
  }
  function clearError() { setError(''); }
  function enableSubmit(enabled) {
    if (!els.submit) return;
    els.submit.disabled = !enabled;
    els.submit.setAttribute('aria-disabled', String(!enabled));
    els.submit.classList.toggle('loading', !enabled);
  }

  // IMPORTANT: must be 'month' | 'year' to match the Flask route
  function getSelectedInterval() {
    const r = document.querySelector('input[name="interval"]:checked');
    return r && r.value === 'year' ? 'year' : 'month';
  }

  function parseOsOptions(list) {
    if (!Array.isArray(list)) return [];
    return list.map(item => {
      if (typeof item !== 'string') return null;
      const s = item.trim();
      if (!s) return null;
      if (s.includes(':')) {
        const [key, label] = s.split(':');
        return { key: key.trim(), label: (label || key).trim() };
      }
      const key = s;
      const label = key.replace(/[-_]/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
      return { key, label };
    }).filter(Boolean);
  }

  function populateOsSelect(options) {
    if (!els.osSelect) return;
    els.osSelect.innerHTML = '<option value="">Select OS…</option>';
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.key;
      o.textContent = opt.label;
      els.osSelect.appendChild(o);
    });
  }

  function populatePlanSelect() {
    if (!els.planSelect) return;
    els.planSelect.innerHTML = '';
    for (const [, p] of catalog) {
      const o = document.createElement('option');
      o.value = p.code;
      o.textContent = p.name;
      els.planSelect.appendChild(o);
    }
  }

  function renderPrice(p) {
    if (!p) return;
    const interval = getSelectedInterval(); // 'month' | 'year'
    const amount = interval === 'year' ? p.priceYear : p.priceMonth;
    const currency = (p.currency || '').toUpperCase();
    if (els.priceAmount)   els.priceAmount.textContent = (amount != null ? amount : '—');
    if (els.priceCurrency) els.priceCurrency.textContent = currency ? ` ${currency}` : '';
    if (els.priceInterval) els.priceInterval.textContent = interval === 'year' ? ' / year' : ' / month';
  }

  function renderPlan(p) {
    if (!p) return;
    if (els.planCodeInput) els.planCodeInput.value = p.code;  // critical for backend
    if (els.name) els.name.textContent = p.name || '—';
    if (els.vcpu) els.vcpu.textContent = p.vcpu ?? '—';
    if (els.ram)  els.ram.textContent  = p.ram  ?? '—';
    if (els.ssd)  els.ssd.textContent  = p.ssd  ?? '—';
    if (els.bw)   els.bw.textContent   = p.bw   ?? '—';
    populateOsSelect(p.osOptions || []);
    if (els.planSelect) els.planSelect.value = p.code;
    renderPrice(p);
  }

  function sshLooksLikePublicKey(s) {
    if (!s) return true; // optional
    const line = s.trim().split(/\s+/).slice(0, 2).join(' ');
    return /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521))\s+[A-Za-z0-9+/=]+$/.test(line);
  }

  function validateForm() {
    const os = els.osSelect ? els.osSelect.value.trim() : '';
    const legal = els.acceptLegal ? els.acceptLegal.checked : true;
    const ssh = els.sshKey ? els.sshKey.value.trim() : '';

    if (!os) { enableSubmit(false); return setError('Please select an operating system.'); }
    if (!legal) { enableSubmit(false); return setError('Please accept the Terms, Privacy, and AUP to continue.'); }
    if (ssh && !sshLooksLikePublicKey(ssh)) {
      enableSubmit(false);
      return setError('SSH key format looks invalid. Paste a public key like "ssh-ed25519 AAAA... user@host".');
    }

    clearError();
    enableSubmit(true);
  }

  function currentPlan() {
    // prefer hidden input; fallback to selected option
    let code = els.planCodeInput ? els.planCodeInput.value.trim() : '';
    if (!code && els.planSelect) code = (els.planSelect.value || '').trim();
    if (!code) return null;
    return catalog.get(code) || null;
  }

  // Parse redirect; accept {checkout_url} from backend (primary)
  async function handleRedirect(res) {
    // JSON field
    let data = {};
    try { data = await res.clone().json(); } catch (_) { /* ignore */ }
    const redirect = data.checkout_url || data.redirect_url || data.url;
    if (redirect) { window.location.assign(redirect); return true; }
    // Location header fallback
    const loc = res.headers.get('Location') || res.headers.get('location');
    if (loc) { window.location.assign(loc); return true; }
    return false;
  }

  async function submitCart(evt) {
    evt.preventDefault();
    validateForm();
    if (els.submit?.disabled) return;

    // Ensure we have a plan
    let plan = currentPlan();
    if (!plan && catalog.size === 1) {
      plan = [...catalog.values()][0];
      renderPlan(plan);
    }
    if (!plan) return setError('Missing plan information. Please open the cart from a plan.');

    const payload = {
      plan_code: plan.code,
      interval:  getSelectedInterval(),       // 'month' | 'year'
      os_key:    els.osSelect ? els.osSelect.value.trim() : '',
      ssh_key:   els.sshKey ? els.sshKey.value.trim() : '',
      accept_legal: els.acceptLegal ? !!els.acceptLegal.checked : true
    };

    try {
      enableSubmit(false);
      const res = await fetch(CHECKOUT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Checkout failed (${res.status})`);
      }

      if (!(await handleRedirect(res))) {
        const txt = await res.text();
        if (txt && /^https?:\/\//i.test(txt.trim())) {
          window.location.assign(txt.trim());
        } else {
          setError('Checkout started, but no redirect URL was provided by the server.');
          enableSubmit(true);
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong while starting checkout.');
      enableSubmit(true);
    }
  }

  function handlePlanSelectChange() {
    if (!els.planSelect) return;
    const plan = catalog.get(els.planSelect.value);
    if (plan) {
      renderPlan(plan);
      validateForm();
    }
  }

  function handleIntervalChange() {
    const p = currentPlan();
    if (p) renderPrice(p);
  }

  function primeCatalogFromInlineJSON() {
    if (!els.catalogTag) return;
    try {
      const raw = els.catalogTag.textContent || '[]';
      const arr = JSON.parse(raw);
      arr.forEach(item => {
        const p = {
          code: item.plan_code,
          name: item.name,
          vcpu: item.vcpu,
          ram:  item.ram_gb,
          ssd:  item.ssd_gb,
          bw:   item.bandwidth_tb,
          priceMonth: item.price_month,
          priceYear:  item.price_year,
          currency:   item.currency,
          osOptions:  parseOsOptions(item.os_options || [])
        };
        if (p.code) catalog.set(p.code, p);
      });
    } catch (_) { /* ignore parse errors */ }
  }

  function openWithPlanCode(code) {
    const plan = catalog.get(code);
    if (plan) {
      renderPlan(plan);
      if (els.osSelect) els.osSelect.value = '';
      if (els.sshKey) els.sshKey.value = '';
      if (els.acceptLegal) els.acceptLegal.checked = false;
      clearError();
      validateForm();
      showDrawer();
      return true;
    }
    return false;
  }

  function wireEvents() {
    els.closeBtns.forEach(b => b.addEventListener('click', hideDrawer));
    els.backdrop?.addEventListener('click', hideDrawer);

    if (els.form) els.form.addEventListener('submit', submitCart);
    if (els.planSelect) els.planSelect.addEventListener('change', handlePlanSelectChange);
    if (els.osSelect)   els.osSelect.addEventListener('change', validateForm);
    if (els.acceptLegal) els.acceptLegal.addEventListener('change', validateForm);
    if (els.sshKey)     els.sshKey.addEventListener('input', validateForm);
    if (els.intervalRadios && els.intervalRadios.length) {
      els.intervalRadios.forEach(r => r.addEventListener('change', handleIntervalChange));
    }

    els.getButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const code = (btn.getAttribute('data-plan') || '').trim();
        if (!openWithPlanCode(code)) {
          const fallback = {
            code,
            name: (btn.getAttribute('data-name') || '').trim(),
            vcpu: (btn.getAttribute('data-vcpu') || '').trim(),
            ram:  (btn.getAttribute('data-ram')  || '').trim(),
            ssd:  (btn.getAttribute('data-ssd')  || '').trim(),
            bw:   (btn.getAttribute('data-bandwidth') || '').trim(),
            priceMonth: (btn.getAttribute('data-price-month') || '').trim(),
            priceYear:  (btn.getAttribute('data-price-year')  || '').trim(),
            currency:   (btn.getAttribute('data-currency')    || '').trim(),
            osOptions:  []
          };
          if (fallback.code) catalog.set(fallback.code, fallback);
          renderPlan(fallback);
          if (els.osSelect) els.osSelect.value = '';
          if (els.sshKey) els.sshKey.value = '';
          if (els.acceptLegal) els.acceptLegal.checked = false;
          clearError();
          validateForm();
          showDrawer();
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    primeCatalogFromInlineJSON();
    if (els.planSelect) populatePlanSelect();
    wireEvents();
  });
})();
