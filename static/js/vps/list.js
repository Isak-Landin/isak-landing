(function () {
  const CHECKOUT_URL = window.VPS_CHECKOUT_URL || '/vps/checkout';

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

  function openTarget(url, preOpenedPopup) {
    // Mobile → new tab
    if (isMobile()) {
      const tab = window.open(url, '_blank', 'noopener,noreferrer');
      if (!tab) window.location.href = url; // final fallback
      return;
    }

    // Desktop → centered popup (use pre-opened if available)
    const w = 520, h = 760;
    const left = Math.max(0, (window.screenX || window.screenLeft || 0) + (window.outerWidth - w) / 2);
    const top  = Math.max(0, (window.screenY || window.screenTop  || 0) + (window.outerHeight - h) / 3);

    if (preOpenedPopup && !preOpenedPopup.closed) {
      preOpenedPopup.location = url;
      preOpenedPopup.focus();
      return;
    }

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

  async function startCheckout(planCode, interval) {
    const res = await fetch(CHECKOUT_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ plan_code: planCode, interval })
    });

    // Some backends respond with a redirect; fetch follows it and exposes the final URL
    if (res.redirected && res.url) {
      return res.url;
    }

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

  async function handleClick(e) {
    const btn = e.target.closest('.plan-btn[data-plan]');
    if (!btn) return;

    // Safety: stop any default navigation or bubbled handlers
    e.preventDefault();
    e.stopPropagation();

    const planCode = btn.getAttribute('data-plan');
    const interval = btn.getAttribute('data-interval') || 'month';

    // Pre-open a blank popup on desktop to dodge blockers
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
      const url = await startCheckout(planCode, interval);
      openTarget(url, preOpened);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Could not start checkout');
      if (preOpened && !preOpened.closed) preOpened.close();
      setLoading(btn, false);
    }
  }

  // Delegate clicks (works for future cards too)
  document.addEventListener('click', handleClick);
})();
