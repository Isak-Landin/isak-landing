// static/js/vps/detail.js
(function () {
  function getTextFrom(el) {
    if (!el) return "";
    // Prefer data-secret if present (masked UI still keeps secret in dataset)
    const ds = el.dataset || {};
    return (ds.secret || el.textContent || "").trim();
  }

  function flashLabel(btn, tmpText, ms = 1200) {
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = tmpText;
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = prev;
      btn.disabled = false;
    }, ms);
  }

  function copySelector(selector, btn) {
    const el = document.querySelector(selector);
    const text = getTextFrom(el);
    if (!text) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => flashLabel(btn, "Copied"),
        () => flashLabel(btn, "Copy failed")
      );
    } else {
      // Fallback: execCommand (older browsers)
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "absolute";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        flashLabel(btn, "Copied");
      } catch (_) {
        flashLabel(btn, "Copy failed");
      }
      document.body.removeChild(ta);
    }
  }

  function init() {
    // Delegate copy buttons by [data-copy]
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-copy]");
      if (!btn) return;
      e.preventDefault();
      const sel = btn.getAttribute("data-copy");
      if (sel) copySelector(sel, btn);
    });

    // Toggle reveal/hide on the password
    const revealBtn = document.getElementById("reveal-pass");
    const passEl    = document.getElementById("cred-password");
    if (revealBtn && passEl) {
      revealBtn.addEventListener("click", () => {
        const masked = passEl.getAttribute("data-masked") === "true";
        if (masked) {
          passEl.textContent = passEl.getAttribute("data-secret") || "";
          passEl.setAttribute("data-masked", "false");
          revealBtn.textContent = "Hide";
          revealBtn.setAttribute("aria-pressed", "true");
        } else {
          passEl.textContent = "••••••••";
          passEl.setAttribute("data-masked", "true");
          revealBtn.textContent = "Reveal";
          revealBtn.setAttribute("aria-pressed", "false");
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
