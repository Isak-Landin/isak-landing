// vps/cart.js — Expanded Mini Cart (Plan + OS + optional SSH key) → POST /vps/checkout
// Assumptions: your plan "Get" buttons carry data-attributes (see notes below).

(function () {
  'use strict';

  const CHECKOUT_URL = window.VPS_CHECKOUT_URL || '/vps/checkout';

  const els = {
    // Drawer & form
    drawer:   document.getElementById('vps-mini-cart'),
    backdrop: document.getElementById('vps-mini-cart-backdrop'),
    form:     document.getElementById('vps-mini-cart-form'),
    submit:   document.getElementById('vps-cart-submit'),
    error:    document.getElementById('vps-cart-error'),

    // Static spec display (already present in your cart)
    code:     document.getElementById('vps-cart-plan-code'),
    name:     document.getElementById('vps-cart-name'),
    vcpu:     document.getElementById('vps-cart-vcpu'),
    ram:      document.getElementById('vps-cart-ram'),
    ssd:      document.getElementById('vps-cart-ssd'),
    bw:       document.getElementById('vps-cart-bw'),
    priceM:   document.getElementById('vps-cart-price-monthly'),
    priceY:   document.getElementById('vps-cart-price-yearly'),

    // New: configuration controls
    planSelect: document.getElementById('vps-cart-plan-select'), // optional (if you allow switching plan inside cart)
    osSelect:   document.getElementById('vps-cart-os-select'),
    sshKey:     document.getElementById('vps-cart-ssh-key'),
    sshHelp:    document.getElementById('vps-cart-ssh-help'),

    // Billing interval & legal (assumes these already exist from your previous cart)
    intervalToggle: document.querySelector('input[name="vps-interval"]:checked') ? null : null, // handled by radios below
    intervalRadios: document.querySelectorAll('input[name="vps-interval"]'),
    acceptTos:      document.getElementById('vps-accept-tos'),
    acceptAup:      document.getElementById('vps-accept-aup'),

    // Openers/closers
    closeBtns: document.querySelectorAll('[data-close-cart]'),
    getButtons: document.querySelectorAll('[data-vps-get]'),
  };

  // In-memory catalog for the cart (derived from data attributes on plan buttons)
  // Format per planCode:
  // { code, name, vcpu, ram, ssd, bw, priceMonthly, priceYearly, osOptions: [{key, label}] }
  const catalog = new Map();

  // ---------- Utils ----------
  function showDrawer() {
    els.drawer?.classList.add('open');
    els.backdrop?.classList.add('open');
    // Prevent body scroll
    document.documentElement.classList.add('no-scroll');
  }

  function hideDrawer() {
    els.drawer?.classList.remove('open');
    els.backdrop?.classList.remove('open');
    document.documentElement.classList.remove('no-scroll');
    clearError();
  }

  function setError(msg) {
    if (!els.error) return;
    els.error.textContent = msg || '';
    els.error.hidden = !msg;
  }

  function clearError() { setError(''); }

  function enableSubmit(enabled) {
    if (els.submit) {
      els.submit.disabled = !enabled;
      els.submit.setAttribute('aria-disabled', String(!enabled));
    }
  }

  function getSelectedInterval() {
    const r = document.querySelector('input[name="vps-interval"]:checked');
    return r ? r.value : 'monthly';
  }

  function parseOsOptions(osAttr) {
    // Accept formats:
    // "ubuntu-24.04:Ubuntu 24.04,debian-12:Debian 12,rocky-9:Rocky Linux 9"
    // or just keys (labels become Title Case of key) "ubuntu-24.04,debian-12"
    if (!osAttr) return [];
    return osAttr.split(',').map(s => s.trim()).filter(Boolean).map(pair => {
      if (pair.includes(':')) {
        const [key, label] = pair.split(':');
        return { key: key.trim(), label: label.trim() };
      }
      const key = pair.trim();
      const label = key.replace(/[-_]/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
      return { key, label };
    });
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

  function renderPlan(p) {
    if (!p) return;
    if (els.code) els.code.textContent = p.code;
    if (els.name) els.name.textContent = p.name;
    if (els.vcpu) els.vcpu.textContent = p.vcpu;
    if (els.ram)  els.ram.textContent  = p.ram;
    if (els.ssd)  els.ssd.textContent  = p.ssd;
    if (els.bw)   els.bw.textContent   = p.bw;
    if (els.priceM) els.priceM.textContent = p.priceMonthly || '';
    if (els.priceY) els.priceY.textContent = p.priceYearly  || '';
    populateOsSelect(p.osOptions || []);
    if (els.planSelect) els.planSelect.value = p.code;
  }

  function sshLooksLikePublicKey(s) {
    // Minimal client-side check; server must re-validate.
    // Accept common prefixes: ssh-ed25519, ssh-rsa, ecdsa-sha2-nistp256/384/521
    if (!s) return true; // empty means "no key provided" (allowed)
    const line = s.trim().split(/\s+/).slice(0, 2).join(' ');
    return /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521))\s+[A-Za-z0-9+/=]+$/.test(line);
  }

  function validateForm() {
    const os = els.osSelect ? els.osSelect.value.trim() : '';
    const tos = els.acceptTos ? els.acceptTos.checked : true;
    const aup = els.acceptAup ? els.acceptAup.checked : true;
    const ssh = els.sshKey ? els.sshKey.value.trim() : '';

    if (!os) { enableSubmit(false); return setError('Please select an operating system.'); }

    if (!tos || !aup) { enableSubmit(false); return setError('Please accept the Terms and the AUP to continue.'); }

    if (ssh && !sshLooksLikePublicKey(ssh)) {
      enableSubmit(false);
      return setError('SSH key format looks invalid. Paste a public key like "ssh-ed25519 AAAA... user@host".');
    }

    clearError();
    enableSubmit(true);
  }

  function currentPlan() {
    const code = els.code ? els.code.textContent.trim() : '';
    return catalog.get(code);
  }

  async function submitCart(evt) {
    evt.preventDefault();
    validateForm();
    if (els.submit?.disabled) return;

    const plan = currentPlan();
    if (!plan) {
      return setError('Missing plan information. Please re-open the cart from a plan.');
    }

    const payload = {
      plan_code: plan.code,
      interval:  getSelectedInterval(),
      os_key:    els.osSelect ? els.osSelect.value.trim() : '',
      ssh_key:   els.sshKey ? els.sshKey.value.trim() : '',
      accept_tos: els.acceptTos ? !!els.acceptTos.checked : true,
      accept_aup: els.acceptAup ? !!els.acceptAup.checked : true
    };

    try {
      enableSubmit(false);
      els.submit?.classList.add('loading');

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

      const data = await res.json().catch(() => ({}));
      // Expect { redirect_url: "https://checkout.stripe.com/..." } or do same-tab redirect
      const redirect = data.redirect_url || data.url;
      if (redirect) {
        window.location.assign(redirect);
      } else {
        // Fallback (server may already respond with 204 + Location header in real impl)
        hideDrawer();
      }
    } catch (err) {
      setError(err.message || 'Something went wrong while starting checkout.');
      enableSubmit(true);
      els.submit?.classList.remove('loading');
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

  function wireEvents() {
    els.closeBtns.forEach(b => b.addEventListener('click', hideDrawer));
    els.backdrop?.addEventListener('click', hideDrawer);

    if (els.form) els.form.addEventListener('submit', submitCart);

    if (els.planSelect) els.planSelect.addEventListener('change', handlePlanSelectChange);
    if (els.osSelect)   els.osSelect.addEventListener('change', validateForm);

    if (els.acceptTos)  els.acceptTos.addEventListener('change', validateForm);
    if (els.acceptAup)  els.acceptAup.addEventListener('change', validateForm);

    if (els.sshKey)     els.sshKey.addEventListener('input', validateForm);
    if (els.intervalRadios && els.intervalRadios.length) {
      els.intervalRadios.forEach(r => r.addEventListener('change', () => {
        // No validation impact except price display; prices already shown in spec block.
      }));
    }

    // Bind "Get" buttons on list page
    els.getButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();

        // Build plan from data attributes
        const plan = {
          code: (btn.getAttribute('data-plan-code') || '').trim(),
          name: (btn.getAttribute('data-plan-name') || '').trim(),
          vcpu: (btn.getAttribute('data-plan-vcpu') || '').trim(),
          ram:  (btn.getAttribute('data-plan-ram')  || '').trim(),
          ssd:  (btn.getAttribute('data-plan-ssd')  || '').trim(),
          bw:   (btn.getAttribute('data-plan-bw')   || '').trim(),
          priceMonthly: (btn.getAttribute('data-price-monthly') || '').trim(),
          priceYearly:  (btn.getAttribute('data-price-yearly')  || '').trim(),
          osOptions: parseOsOptions(btn.getAttribute('data-os-options') || '')
        };

        if (!plan.code) {
          return setError('Missing plan code on the clicked item.');
        }

        // Store/refresh catalog entry and render
        catalog.set(plan.code, plan);
        if (els.planSelect && !els.planSelect.options.length) populatePlanSelect();
        renderPlan(plan);

        // Reset inputs
        if (els.osSelect) els.osSelect.value = '';
        if (els.sshKey) els.sshKey.value = '';
        if (els.acceptTos) els.acceptTos.checked = false;
        if (els.acceptAup) els.acceptAup.checked = false;
        clearError();
        validateForm();

        showDrawer();
      });
    });
  }

  // Boot
  document.addEventListener('DOMContentLoaded', wireEvents);
})();
