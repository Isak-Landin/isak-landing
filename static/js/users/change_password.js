// static/js/users/change_password.js
(function () {
  if (window.__changePwInitDone) return;
  window.__changePwInitDone = true;

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("change-password-form");
    if (!form) return;

    const cur = /** @type {HTMLInputElement|null} */ (document.getElementById("current_password"));
    const pw  = /** @type {HTMLInputElement|null} */ (document.getElementById("new_password"));
    const cfm = /** @type {HTMLInputElement|null} */ (document.getElementById("confirm_password"));
    const err = document.getElementById("change-password-error");
    const btn = /** @type {HTMLButtonElement|null} */ (form.querySelector('button[type="submit"]'));

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
      const name = "csrf_token=";
      const parts = document.cookie ? document.cookie.split(";") : [];
      for (let c of parts) {
        c = c.trim();
        if (c.indexOf(name) === 0) return c.substring(name.length);
      }
      return null;
    };

    const validate = () => {
      if (!cur || !pw || !cfm) return "Missing fields.";
      const c = cur.value || "";
      const p = pw.value || "";
      const f = cfm.value || "";

      if (!c) return "Current password is required.";
      if (p.length < MIN_LEN) return `Password must be at least ${MIN_LEN} characters.`;
      if (!PASS_RE.test(p)) return "Password must include uppercase, lowercase, a number, and a symbol.";
      if (p === c) return "New password must be different from the current password.";
      if (f && p !== f) return "Passwords don’t match.";
      return "";
    };

    const onInput = () => show(err, validate());
    cur && cur.addEventListener("input", onInput);
    pw && pw.addEventListener("input", onInput);
    cfm && cfm.addEventListener("input", onInput);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const msg = validate();
      if (msg) { show(err, msg); (pw && pw.focus()); return; }

      const fd = new FormData(form);
      btn && (btn.disabled = true);
      form.classList.add("is-loading");

      try {
        const headers = { "Accept": "application/json" };
        const token = getCsrfToken();

        if (typeof window.csrfFetch === "function") {
          const res = await window.csrfFetch(form.action, { method: "POST", body: fd, headers });
          await handleResponse(res);
        } else {
          if (token) headers["X-CSRF-Token"] = token;
          const res = await fetch(form.action, { method: "POST", body: fd, headers, credentials: "same-origin" });
          await handleResponse(res);
        }
      } catch (e) {
        console.error("Change password error:", e);
        show(err, "Unable to update password. Please try again.");
      } finally {
        btn && (btn.disabled = false);
        form.classList.remove("is-loading");
      }
    });

    async function handleResponse(res) {
      const ctype = (res.headers.get("content-type") || "").toLowerCase();
      let data = null;
      if (ctype.includes("application/json")) data = await res.json();
      else data = { success: res.ok, error: await res.text() };

      if (res.ok && data && data.success) {
        show(err, "");
        form.reset();
        alert("Password updated."); // replace with a nicer toast if you prefer
        return;
      }
      const msg = (data && (data.error || data.message)) || `Failed (HTTP ${res.status}).`;
      show(err, msg);
    }
  });
})();
