// static/js/csrf.js
// Minimal helper, safe to load on every page
(function () {
  function getCsrfTokenFromMeta() {
    const m = document.querySelector('meta[name="csrf-token"]');
    return m ? m.getAttribute('content') : '';
  }
  function getCsrfTokenFromCookie() {
    // legacy fallback: will return '' once the cookie is HttpOnly
    const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }
  function getCsrfToken() {
    return getCsrfTokenFromMeta() || getCsrfTokenFromCookie() || '';
  }

  // expose for other scripts (keep old name for backwards compat)
  window.getCsrfToken = getCsrfToken;
  window.getCsrfTokenFromCookie = getCsrfTokenFromCookie;
})();
