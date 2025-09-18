// Minimal helper, safe to load on every page
(function () {
  function getCsrfTokenFromCookie() {
    const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }
  // expose for other scripts
  window.getCsrfTokenFromCookie = getCsrfTokenFromCookie;
})();
