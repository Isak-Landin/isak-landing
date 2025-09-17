// static/js/public/nav-toggle.js
(function () {
  function init() {
    const toggle = document.querySelector('[data-js="nav-toggle"]');
    const links  = document.querySelector('[data-js="nav-links"]');
    if (!toggle || !links) return;

    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();