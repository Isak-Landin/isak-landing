// static/js/http.js
(function () {
  function httpMethod(init) {
    return (init && init.method ? String(init.method) : 'GET').toUpperCase();
  }

  async function csrfFetch(input, init) {
    init = init || {};
    // always send session cookie
    init.credentials = init.credentials || 'same-origin';

    const headers = new Headers(init.headers || {});
    const m = httpMethod(init);

    // Only attach CSRF header for mutating requests
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
      const token =
        (typeof window.getCsrfToken === 'function' && window.getCsrfToken()) ||
        (typeof window.getCsrfTokenFromCookie === 'function' && window.getCsrfTokenFromCookie()) ||
        '';
      if (token) headers.set('X-CSRF-Token', token);
      // IMPORTANT: don't set Content-Type on FormData, let the browser handle it
    }

    init.headers = headers;
    return fetch(input, init);
  }

  window.csrfFetch = csrfFetch;
})();
