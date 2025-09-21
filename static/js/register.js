// static/js/register.js
(function () {
  function $(id) { return document.getElementById(id); }

  function show(el, msg) {
    if (!el) return;
    el.textContent = msg || '';
    if (msg && el.classList) el.classList.add('is-visible');
    else if (el.classList) el.classList.remove('is-visible');
    if (el.style) el.style.display = msg ? 'block' : 'none';
  }

  // Mirror backend policy: min 12 and upper+lower+digit+symbol
  const MIN_LEN = 12;
  const PASS_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;

  function validatePasswordStrength(pw) {
    if (!pw || pw.length < MIN_LEN) {
      return `Password must be at least ${MIN_LEN} characters.`;
    }
    if (!PASS_RE.test(pw)) {
      return "Password must include uppercase, lowercase, a number, and a symbol.";
    }
    return "";
  }

  function init() {
    const form        = $('register-form');
    if (!form) return;

    const email       = $('email');
    const pw          = $('password');
    const confirmPw   = $('confirm_password');
    const legal       = $('accept_legal');      // checkbox
    const errorBox    = $('register-error') || document.querySelector('.auth-error');
    const pwError     = $('password-error') || errorBox;
    const submitBtn   = $('register-submit');

    // Live hint on password fields
    function syncPwHint() {
      if (!pw || !confirmPw) return;
      const strengthMsg = validatePasswordStrength(pw.value);
      if (strengthMsg) { show(pwError, strengthMsg); return; }
      if (pw.value && confirmPw.value && pw.value !== confirmPw.value) {
        show(pwError, "Passwords don’t match."); return;
      }
      show(pwError, "");
    }

    pw && pw.addEventListener('input', syncPwHint);
    confirmPw && confirmPw.addEventListener('input', syncPwHint);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      show(pwError, "");
      show(errorBox, "");

      // HTML email validity (UX only)
      if (email && !email.checkValidity && !email.value.includes('@')) {
        show(errorBox, 'Please enter a valid email address.');
        email.focus();
        return;
      }
      if (email && email.checkValidity && !email.checkValidity()) {
        show(errorBox, 'Please enter a valid email address.');
        email.focus();
        return;
      }

      // Password checks mirroring backend
      const strengthMsg = validatePasswordStrength(pw?.value);
      if (strengthMsg) {
        show(pwError, strengthMsg);
        (pw || confirmPw)?.focus();
        return;
      }
      if (!pw || !confirmPw || pw.value !== confirmPw.value) {
        show(pwError, "Passwords don’t match.");
        (confirmPw || pw)?.focus();
        return;
      }

      // Legal acceptance
      if (legal && !legal.checked) {
        show(errorBox, "You must agree to the Terms, Privacy Policy, and AUP.");
        legal.focus();
        return;
      }

      // Submit
      const formData = new FormData(form);
      try {
        submitBtn && (submitBtn.disabled = true, submitBtn.classList.add('is-loading'));

        const res = await csrfFetch('/auth/register', {
          method: 'POST',
          body: formData
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && (data.success || data.ok)) {
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
