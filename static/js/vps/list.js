(function () {
  async function handleClick(e) {
    const btn = e.target.closest('.plan-btn[data-plan]');
    if (!btn) return;

    const planCode = btn.getAttribute('data-plan');
    const interval = btn.getAttribute('data-interval') || 'month';

    btn.disabled = true;
    try {
      const res = await fetch(window.VPS_CHECKOUT_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ plan_code: planCode, interval })
      });
      const data = await res.json();
      if (!data.ok || !data.checkout_url) throw new Error(data.error || 'Checkout failed');
      window.location = data.checkout_url;
    } catch (err) {
      alert(err.message || 'Could not start checkout');
      btn.disabled = false;
    }
  }
  document.addEventListener('click', handleClick);
})();
