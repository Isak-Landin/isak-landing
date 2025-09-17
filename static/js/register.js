// static/js/register.js
(function () {
  function $(id) { return document.getElementById(id); }

  function show(el, msg) {
    if (!el) return;
    el.textContent = msg || '';
    if (msg) el.classList.add('is-visible');
    else el.classList.remove('is-visible');
  }

  function init() {
    const form        = $('register-form');
    if (!form) return;

    const email       = $('email');
    const pw          = $('password');
    const confirmPw   = $('confirm_password');
    const acceptLegal = $('accept_legal');

    const pwError     = $('password-error');
    const errorBox    = $('register-error');
    const submitBtn   = $('register-submit');

    // Clear errors while typing/checking boxes
    [email, pw, confirmPw].forEach(el => {
      if (el) el.addEventListener('input', () => {
        if (el === pw || el === confirmPw) show(pwError, '');
        show(errorBox, '');
      });
    });

    if (acceptLegal) {
      // Nice native validation message for the legal checkbox
      acceptLegal.addEventListener('invalid', () => {
        acceptLegal.setCustomValidity('You must accept the Terms, Privacy Policy, and AUP to continue.');
      });
      acceptLegal.addEventListener('change', () => acceptLegal.setCustomValidity(''));
    }

    // Live password mismatch hint
    const syncPwHint = () => {
      if (pw && confirmPw && pw.value && confirmPw.value && pw.value !== confirmPw.value) {
        show(pwError, "Passwords don’t match.");
      } else {
        show(pwError, '');
      }
    };
    if (pw) pw.addEventListener('input', syncPwHint);
    if (confirmPw) confirmPw.addEventListener('input', syncPwHint);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      show(pwError, '');
      show(errorBox, '');

      // Client-side validations (since form has novalidate)
      if (!pw || !confirmPw || pw.value !== confirmPw.value) {
        show(pwError, "Passwords don’t match.");
        (confirmPw || pw)?.focus();
        return;
      }

      if (acceptLegal && !acceptLegal.checked) {
        show(errorBox, "You must agree to the Terms, Privacy Policy, and AUP to create an account.");
        acceptLegal.focus();
        return;
      }

      if (email && !email.checkValidity()) {
        show(errorBox, "Please enter a valid email address.");
        email.focus();
        return;
      }

      // Submit via fetch (AJAX), expect JSON
      submitBtn && (submitBtn.disabled = true, submitBtn.classList.add('is-loading'));
      try {
        const action = form.getAttribute('action') || form.action || window.location.pathname;
        const formData = new FormData(form);

        const res = await fetch(action, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
          headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
        });

        let data = null;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          data = await res.json();
        } else {
          // Fallback: non-JSON error page
          if (!res.ok) throw new Error('Registration failed');
        }

        if (res.ok && data && (data.success || data.ok)) {
          window.location.href = data.redirect || '/dashboard';
        } else {
          const msg = (data && (data.error || data.message)) || 'Registration failed.';
          show(errorBox, msg);
        }
      } catch (err) {
        show(errorBox, 'Network error. Please try again.');
      } finally {
        submitBtn && (submitBtn.disabled = false, submitBtn.classList.remove('is-loading'));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
