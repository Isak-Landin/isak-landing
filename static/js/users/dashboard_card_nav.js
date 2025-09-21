// static/js/user/dashboard_card_nav.js
(function () {
  function init() {
    const list = document.querySelector('.vps-list');
    if (!list) return;

    // Click anywhere on the card row to navigate (but let <a> clicks work)
    list.addEventListener('click', function (e) {
      const row = e.target.closest('.card-row');
      if (!row) return;
      if (e.target.closest('a')) return; // don't override native link clicks
      const href = row.getAttribute('data-href');
      if (href) window.location.href = href;
    });

    // Keyboard: Enter or Space on a focusable row
    list.addEventListener('keydown', function (e) {
      const row = e.target.closest('.card-row[tabindex]');
      if (!row) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const href = row.getAttribute('data-href');
        if (href) window.location.href = href;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
