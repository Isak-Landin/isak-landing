// static/js/register.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  if (!form) return;

  const email = document.getElementById('email');
  const pw = document.getElementById('password');
  const confirmPw = document.getElementById('confirm_password');
  const acceptLegal = document.getElementById('accept_legal');

  const pwError = document.getElementById('password-error');
  const errorBox = document.getElementById('register-error');
  const submitBtn = document.getElementById('register-submit');

  const showError = (el, msg) => {
    el.textContent = msg;
    el.style.display = 'block';
  };
  const hideError = (el) => { el.textContent = ''; el.style.display = 'none'; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(pwError);
    hideError(errorBox);

    // Client-side validations
    if (!pw.value || !confirmPw.value || pw.value !== confirmPw.value) {
      showError(pwError, "Passwords don’t match.");
      return;
    }

    if (!acceptLegal.checked) {
      showError(errorBox, "You must agree to the Terms, Privacy Policy, and AUP to create an account.");
      return;
    }

    // Optional: simple email validity gate (browser already validates 'type=email')
    if (!email.checkValidity()) {
      showError(errorBox, "Please enter a valid email address.");
      return;
    }

    // Submit
    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');

    try {
      const formData = new FormData(form);

      const res = await fetch('/auth/register', {
        method: 'POST',
        body: formData
      });

      // Expecting your API to reply like: { success: true, redirect: "/dashboard" }
      const data = await res.json();

      if (res.ok && data && data.success) {
        window.location.href = data.redirect || '/';
      } else {
        showError(errorBox, (data && data.error) || 'Registration failed.');
      }
    } catch (err) {
      showError(errorBox, 'Network error. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('is-loading');
    }
  });

  // Quality-of-life: live password mismatch hint
  const syncPwHint = () => {
    if (pw.value && confirmPw.value && pw.value !== confirmPw.value) {
      showError(pwError, "Passwords don’t match.");
    } else {
      hideError(pwError);
    }
  };
  pw.addEventListener('input', syncPwHint);
  confirmPw.addEventListener('input', syncPwHint);
});
