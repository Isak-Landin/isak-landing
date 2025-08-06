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
      const res = await fetch('/auth/login', {
        method: 'POST',
        body: formData
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
