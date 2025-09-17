document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('refresh-inbox');
    if (btn) btn.addEventListener('click', () => {
      // Simple, reliable refresh. No dependency on other JS.
      window.location.reload();
    });
});