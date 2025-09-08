// vps/cart.js — controls mini cart drawer and posts to /vps/checkout
(function () {
  const CHECKOUT_URL = window.VPS_CHECKOUT_URL || '/vps/checkout';

  const els = {
    drawer:   document.getElementById('vps-mini-cart'),
    backdrop: document.getElementById('vps-mini-cart-backdrop'),
    form:     document.getElementById('vps-mini-cart-form'),
    submit:   document.getElementById('vps-cart-submit'),
    error:    document.getElementById('vps-cart-error'),
    code:     document.getElementById('vps-cart-plan-code'),
    name:     document.getElementById('vps-cart-name'),
    vcpu:     document.getElementById('vps-cart-vcpu'),
    ram:      document.getElementById('vps-cart-ram'),
    ssd:      document.getElementById('vps-cart-ssd'),
    bw:       document.getElementById('vps-cart-bw'),
    priceAmt: document.getElementById('vps-cart-price-amount'),
    priceCur: document.getElementById('vps-cart-price-currency'),
    priceInt: document.getElementById('vps-cart-price-interval'),
    intervalInputs: null,

    // internal price state
    _priceMonth: null,
    _priceYear:  null,
    _currency:   'EUR'
  };

  function setLoading(on) {
    if (!els.submit) return;
    if (on) {
      els.submit.dataset._label = els.submit.textContent;
      els.submit.textContent = 'Processing…';
      els.submit.disabled = true;
    } else {
      if (els.submit.dataset._label) els.submit.textContent = els.submit.dataset._label;
      els.submit.disabled = false;
    }
  }

  function formatPrice(x) {
    if (x == null || x === '' || isNaN(Number(x))) return null;
    return Number(x).toFixed(2);
  }

  function drawPrice(interval) {
    if (!els.priceAmt || !els.priceCur || !els.priceInt) return;
    const val = interval === 'year' ? els._priceYear : els._priceMonth;
    const fmt = formatPrice(val);
    els.priceAmt.textContent = fmt ?? '—';
    els.priceCur.textContent = fmt ? ` ${els._currency}` : '';
    els.priceInt.textContent = fmt ? ` / ${interval}` : '';
  }

  function openDrawer(plan) {
    if (!els.drawer || !els.backdrop) return;

    // Fill specs
    els.code.value = plan.code || '';
    els.name.textContent = plan.name || 'VPS';
    els.vcpu.textContent = plan.vcpu || '—';
    els.ram.textContent  = plan.ram  || '—';
    els.ssd.textContent  = plan.ssd  || '—';
    els.bw.textContent   = plan.bw   || '—';

    // Price state
    els._priceMonth = plan.priceMonth ?? plan.price_month ?? null;
    els._priceYear  = plan.priceYear  ?? plan.price_year  ?? null;
    els._currency   = (plan.currency || 'EUR').toUpperCase();
    drawPrice(plan.interval || 'month');

    // Interval radios
    els.intervalInputs = els.form.querySelectorAll('input[name="interval"]');
    els.intervalInputs.forEach(r => {
      r.checked = (r.value === (plan.interval || 'month'));
      r.addEventListener('change', () => drawPrice(r.value));
    });

    // Reset errors
    els.error.style.display = 'none';
    els.error.textContent = '';

    // Open
    els.drawer.removeAttribute('aria-hidden');
    els.backdrop.hidden = false;
    document.body.classList.add('vps-cart-open');

    // Focus first interactive element for a11y
    setTimeout(() => {
      const first = els.form.querySelector('input,button,select,textarea,[tabindex]:not([tabindex="-1"])');
      if (first) first.focus();
    }, 0);
  }

  function closeDrawer() {
    if (!els.drawer || !els.backdrop) return;
    els.drawer.setAttribute('aria-hidden', 'true');
    els.backdrop.hidden = true;
    document.body.classList.remove('vps-cart-open');
  }

  async function submitCheckout(e) {
    e.preventDefault();
    if (!els.form) return;

    const fd = new FormData(els.form);
    const plan_code = fd.get('plan_code');
    const interval  = (fd.get('interval') || 'month').toLowerCase();
    const accept    = !!document.getElementById('vps-cart-accept-legal')?.checked;

    if (!accept) {
      els.error.textContent = 'Please accept the Terms, Privacy, and AUP to continue.';
      els.error.style.display = 'block';
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(CHECKOUT_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ plan_code, interval, accept_legal: true })
      });

      let data = null;
      try { data = await res.json(); } catch (_) {}

      if (!res.ok || !data?.checkout_url) {
        const msg = data?.error || `Checkout failed (${res.status})`;
        els.error.textContent = msg;
        els.error.style.display = 'block';
        setLoading(false);
        return;
      }

      window.location.href = data.checkout_url;
    } catch (err) {
      console.error(err);
      els.error.textContent = err.message || 'Network error. Please try again.';
      els.error.style.display = 'block';
      setLoading(false);
    }
  }

  // Open from list.js
  document.addEventListener('vps:open-cart', (e) => openDrawer(e.detail || {}));

  // Close handlers
  document.addEventListener('click', (e) => {
    if (e.target.closest('.vps-cart-close') || e.target === els.backdrop) {
      e.preventDefault();
      closeDrawer();
    }
  });

  // Submit
  els.form && els.form.addEventListener('submit', submitCheckout);

  // Escape closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });
})();
