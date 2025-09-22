// static/js/users/reset.js
(function () {
  // Prevent double-initialization (extensions, hot-reloads, etc.)
  if (window.__resetInitDone) return;
  window.__resetInitDone = true;

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("reset-form");
    if (!form) return;

    const pw = /** @type {HTMLInputElement|null} */ (document.getElementById("password"));
    const confirmPw = /** @type {HTMLInputElement|null} */ (document.getElementById("confirm_password"));
    const errorBox = document.getElementById("reset-error");
    const submitBtn = /** @type {HTMLButtonElement|null} */ (form.querySelector('button[type="submit"]'));

    const MIN_LEN = 12;
    const PASS_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;

    const show = (el, msg) => {
      if (!el) return;
      el.textContent = msg || "";
      el.style.display = msg ? "block" : "none";
    };

    const getCsrfToken = () => {
      const meta = document.querySelector('meta[name="csrf-token"]');
      if (meta && meta.content) return meta.content;
      // fallback: cookie (may be HttpOnly and thus not readable)
      const name = "csrf_token=";
      const parts = document.cookie ? document.cookie.split(";") : [];
      for (let c of parts) {
        c = c.trim();
        if (c.indexOf(name) === 0) return c.substring(name.length);
      }
      return null;
    };

    // Validate password strength & match; return "" if OK, otherwise a message
    const validate = () => {
      if (!pw || !confirmPw) return "";
      const v1 = pw.value || "";
      const v2 = confirmPw.value || "";

      if (v1.length < MIN_LEN) {
        return `Password must be at least ${MIN_LEN} characters.`;
      }
      if (!PASS_RE.test(v1)) {
        return "Password must include uppercase, lowercase, a number, and a symbol.";
      }
      if (v2 && v1 !== v2) {
        return "Passwords don’t match.";
      }
      return "";
    };

    // Live feedback
    const onInput = () => {
      const msg = validate();
      show(errorBox, msg);
    };
    pw && pw.addEventListener("input", onInput);
    confirmPw && confirmPw.addEventListener("input", onInput);

    // Submit handler (AJAX + CSRF)
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const msg = validate();
      if (msg) {
        show(errorBox, msg);
        (pw && pw.focus());
        return;
      }

      // Build form data
      const fd = new FormData(form);

      // Visual loading state
      submitBtn && (submitBtn.disabled = true);
      form.classList.add("is-loading");

      try {
        const headers = { "Accept": "application/json" };

        // Prefer global csrfFetch() if your app provides it
        const token = getCsrfToken();
        if (typeof window.csrfFetch === "function") {
          const res = await window.csrfFetch(form.action, { method: "POST", body: fd, headers });
          await handleResponse(res);
        } else {
          if (token) headers["X-CSRF-Token"] = token;
          const res = await fetch(form.action, { method: "POST", body: fd, headers, credentials: "same-origin" });
          await handleResponse(res);
        }
      } catch (err) {
        console.error("Reset submit error:", err);
        show(errorBox, "Unable to reset password. Please try again.");
      } finally {
        submitBtn && (submitBtn.disabled = false);
        form.classList.remove("is-loading");
      }
    });

    async function handleResponse(res) {
      const ctype = (res.headers.get("content-type") || "").toLowerCase();
      let data = null;

      if (ctype.includes("application/json")) {
        data = await res.json();
      } else {
        // Fallback: non-JSON (shouldn't happen with Accept: application/json)
        const text = await res.text();
        data = { success: res.ok, error: text };
      }

      if (res.ok && data && (data.redirect || data.success)) {
        const dest = data.redirect || "/dashboard";
        window.location.href = dest;
        return;
      }

      const msg =
        (data && (data.error || data.message)) ||
        `Failed to reset password (HTTP ${res.status}).`;

      show(errorBox, msg);
    }
  });
})();
