  (function () {
    const btn = document.getElementById('copy-ref');
    const val = document.getElementById('ref-val');
    if (!btn || !val) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const text = val.textContent.trim();
      if (!text) return;
      navigator.clipboard?.writeText(text).then(() => {
        btn.textContent = 'Copied';
        setTimeout(() => btn.textContent = 'Copy', 1400);
      });
    });
  })();