// vps/list.js — reverted: navigate in same window, no popup
(function () {
  const CHECKOUT_URL = window.VPS_CHECKOUT_URL || '/vps/checkout';

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

  async function startCheckout(planCode, interval) {
    const res = await fetch(CHECKOUT_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ plan_code: planCode, interval })
    });

    // Some setups return a redirect; fetch exposes the final URL
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

  async function handleClick(e) {
    const btn = e.target.closest('.plan-btn[data-plan]');
    if (!btn) return;

    // If your button ever sits in a form, this keeps it from submitting.
    e.preventDefault();

    const planCode = btn.getAttribute('data-plan');
    const interval = btn.getAttribute('data-interval') || 'month';
    if (!planCode) return;

    setLoading(btn, true);
    try {
      const url = await startCheckout(planCode, interval);
      // Revert to same-window navigation
      window.location.href = url;
    } catch (err) {
      console.error(err);
      alert(err.message || 'Could not start checkout');
      setLoading(btn, false);
    }
  }

  // Delegate to support future cards
  document.addEventListener('click', handleClick);
})();
