// vps/list.js — now only opens the mini cart with the selected plan
(function () {
  function handleClick(e) {
    const btn = e.target.closest('.plan-btn[data-plan]');
    if (!btn) return;
    e.preventDefault();

    const plan = {
      code: btn.getAttribute('data-plan'),
      name: btn.getAttribute('data-name') || 'VPS',
      vcpu: btn.getAttribute('data-vcpu') || '',
      ram: btn.getAttribute('data-ram') || '',
      ssd: btn.getAttribute('data-ssd') || '',
      bw: btn.getAttribute('data-bandwidth') || '',
      interval: btn.getAttribute('data-interval') || 'month',
    };

    document.dispatchEvent(new CustomEvent('vps:open-cart', { detail: plan }));
  }

  document.addEventListener('click', handleClick);
})();
