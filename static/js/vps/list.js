// vps/list.js — popup-or-tab Stripe checkout (defensive capture)
(function () {
  const CHECKOUT_URL = window.VPS_CHECKOUT_URL || '/vps/checkout';

  // Treat small screens/coarse pointers as mobile → open in new tab
  const isMobile = () =>
    /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(max-width: 768px)').matches;

  function setLoading(btn, on) {
    if (!btn) return;
    if (on) {
      btn.dataset._label = btn.textContent;
      btn.textContent = 'Processing…';
      btn.disabled = true;
      btn.classList.add('is-loading');
    } else {
      if (btn.dataset._label) btn.textContent = btn.dataset._label;
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  }

  async function createSession(planCode, interval) {
    const res = await fetch(CHECKOUT_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ plan_code: planCode, interval })
    });

    // Some setups respond with a 3xx; fetch exposes the final URL
    if (res.redirected && res.url) return res.url;

    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const msg = data?.error || data?.message || `Checkout failed (${res.status})`;
      throw new Error(msg);
    }
    const url = data?.checkout_url || data?.url;
    if (!url) throw new Error('Checkout URL missing from server response.');
    return url;
  }

  function openTarget(url, preOpenedPopup) {
    if (isMobile()) {
      const tab = window.open(url, '_blank', 'noopener,noreferrer');
      if (!tab) window.location.href = url; // final fallback
      return;
    }

    if (preOpenedPopup && !preOpenedPopup.closed) {
      preOpenedPopup.location = url;
      preOpenedPopup.focus();
      return;
    }

    const w = 520, h = 760;
    const left = Math.max(0, (window.screenX || window.screenLeft || 0) + (window.outerWidth - w) / 2);
    const top  = Math.max(0, (window.screenY || window.screenTop  || 0) + (window.outerHeight - h) / 3);
    const features = [
      `width=${w}`, `height=${h}`, `left=${left}`, `top=${top}`,
      'resizable=yes','scrollbars=yes','toolbar=no','location=no',
      'status=no','menubar=no','noopener','noreferrer'
    ].join(',');
    const pop = window.open(url, 'stripe_checkout', features);
    if (!pop) {
      const tab = window.open(url, '_blank', 'noopener,noreferrer');
      if (!tab) window.location.href = url; // last resort
    }
  }

  // CAPTURE-PHASE handler to kill default/other handlers early
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.plan-btn[data-plan]');
    if (!btn) return;

    // Stop *everything* else from handling this click
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

    // If a form ever wraps the button, this prevents submit
    btn.setAttribute('type', 'button');

    const planCode = btn.getAttribute('data-plan');
    const interval = btn.getAttribute('data-interval') || 'month';

    // Pre-open a blank popup (desktop) to dodge blockers
    let preOpened = null;
    if (!isMobile()) {
      const w = 520, h = 760;
      const left = Math.max(0, (window.screenX || window.screenLeft || 0) + (window.outerWidth - w) / 2);
      const top  = Math.max(0, (window.screenY || window.screenTop  || 0) + (window.outerHeight - h) / 3);
      const features = [
        `width=${w}`, `height=${h}`, `left=${left}`, `top=${top}`,
        'resizable=yes','scrollbars=yes','toolbar=no','location=no',
        'status=no','menubar=no','noopener','noreferrer'
      ].join(',');
      preOpened = window.open('about:blank', 'stripe_checkout', features);
    }

    setLoading(btn, true);
    try {
      const url = await createSession(planCode, interval);
      openTarget(url, preOpened);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Could not start checkout');
      if (preOpened && !preOpened.closed) preOpened.close();
      setLoading(btn, false);
    }
  }, /* capture */ true);
})();
