// static/js/vps/list.js
(function () {
  function onClick(e) {
    const btn = e.target.closest('button[data-plan][data-interval]');
    if (!btn) return;

    const planCode = btn.getAttribute('data-plan');
    const interval = btn.getAttribute('data-interval');

    btn.disabled = true;

    fetch(window.VPS_CHECKOUT_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ plan_code: planCode, interval })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.ok || !data.checkout_url) {
        throw new Error(data.error || 'Checkout failed');
      }
      window.location = data.checkout_url;
    })
    .catch(err => {
      alert(err.message || 'Something went wrong starting checkout.');
      btn.disabled = false;
    });
  }

  document.addEventListener('click', onClick);
})();
