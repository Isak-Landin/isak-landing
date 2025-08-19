(function () {
  const CHECKOUT_URL = window.VPS_CHECKOUT_URL || '/vps/checkout';

  const isMobile = () =>
    /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.matchMedia('(max-width: 768px)').matches ||
    window.matchMedia('(pointer: coarse)').matches;

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

  async function startCheckout(planCode, interval, btn) {
    // Pre-open a popup on desktop to avoid blockers
    let popup = null;
    if (!isMobile()) {
      const w = 520, h = 760;
      const left = Math.max(0, (window.screenX || window.screenLeft || 0) + (window.outerWidth - w) / 2);
      const top  = Math.max(0, (window.screenY || window.screenTop  || 0) + (window.outerHeight - h) / 3);
      const features = [
        `width=${w}`, `height=${h}`, `left=${left}`, `top=${top}`,
        'resizable=yes','scrollbars=yes','toolbar=no','location=no',
        'status=no','menubar=no','noopener','noreferrer'
      ].join(',');
      popup = window.open('about:blank', 'stripe_checkout', features);
    }

    const res = await fetch(CHECKOUT_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ plan_code: planCode, interval })
    });

    // If server redirected directly (some setups do this)
    if (res.redirected && res.url) {
      navigateTo(res.url, popup);
      return;
    }

    // Otherwise expect JSON
    let data = null;
    try { data = await res.json(); } catch(e) {}
    if (!res.ok) {
      const msg = data?.error || data?.message || `Checkout failed (${res.status})`;
      throw new Error(msg);
    }

    const url = data?.checkout_url || data?.url;
    if (!url) throw new Error('Checkout URL missing from server response.');
    navigateTo(url, popup);
  }

  function navigateTo(url, popup) {
    if (isMobile()) {
      const tab = window.open(url, '_blank', 'noopener,noreferrer');
      if (!tab) window.location.href = url; // fallback
      return;
    }
    if (popup && !popup.closed) {
      popup.location = url;
      popup.focus();
      return;
    }
    const tab = window.open(url, '_blank', 'noopener,noreferrer');
    if (!tab) window.location.href = url; // final fallback
  }

  async function handleClick(e) {
    const btn = e.target.closest('.plan-btn[data-plan]');
    if (!btn) return;

    const planCode = btn.getAttribute('data-plan');
    const interval = btn.getAttribute('data-interval') || 'month';

    setLoading(btn, true);
    try {
      await startCheckout(planCode, interval, btn);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Could not start checkout');
      setLoading(btn, false);
    }
  }

  document.addEventListener('click', handleClick);
})();
