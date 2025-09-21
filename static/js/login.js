// static/js/login.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  const email = document.getElementById('email');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errorBox) { errorBox.style.display = 'none'; errorBox.textContent = ''; }

    if (email && email.checkValidity && !email.checkValidity()) {
      errorBox.textContent = 'Please enter a valid email address.';
      errorBox.style.display = 'block';
      email.focus();
      return;
    }

    const formData = new FormData(form);

    try {
      const res = await csrfFetch('/auth/login', {
        method: 'POST',
        body: formData
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data && data.success) {
        window.location.href = data.redirect || '/dashboard';
      } else {
        const msg = (data && (data.error || data.message)) || 'Unknown error';
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
      }
    } catch (err) {
      errorBox.textContent = 'Network error. Please try again.';
      errorBox.style.display = 'block';
    }
  });
});
