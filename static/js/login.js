document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    errorBox.textContent = '';

    const formData = new FormData(form);

    try {
      const res = await csrfFetch('/auth/login', {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-Token': getCsrfTokenFromCookie()
          }
        });

      const data = await res.json();

      if (res.ok && data.success) {
        window.location.href = data.redirect;
      } else {
        errorBox.textContent = data.error || 'Unknown error';
        errorBox.style.display = 'block';
      }

    } catch (err) {
      errorBox.textContent = 'Network error. Please try again.';
      errorBox.style.display = 'block';
    }
  });
});
