(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);

  const form = $("#user-form");
  if (!form) return;

  const userId = form.dataset.userId;
  const flash = $("#flash");
  const emailInput = $("#email");
  const toggleEmail = $("#toggle-email-edit");
  const emailWarn = $("#email-warning");
  const confirmEmail = $("#confirm-email-change");
  const saveBtn = $("#save-btn");

  // Utilities
  const showFlash = (msg, type = "info") => {
    if (!flash) return;
    flash.textContent = msg;
    flash.className = `flash ${type}`;
    flash.style.display = "block";
    setTimeout(() => (flash.style.display = "none"), 4000);
  };

  const setSaving = (saving) => {
    saveBtn.disabled = !!saving;
    saveBtn.textContent = saving ? "Saving…" : "Save changes";
  };

  // Email toggle behavior
  if (toggleEmail && emailInput) {
    toggleEmail.addEventListener("change", () => {
      const enabled = toggleEmail.checked;
      emailInput.disabled = !enabled;
      emailWarn.style.display = enabled ? "block" : "none";
      if (!enabled) {
        // reset to original if they bail out
        emailInput.value = emailInput.dataset.originalEmail || emailInput.value;
        if (confirmEmail) confirmEmail.checked = false;
      }
    });
  }

  // Collect payload and save
  const gatherPayload = () => {
    const first_name = $("#first_name")?.value?.trim() || null;
    const last_name  = $("#last_name")?.value?.trim() || null;
    const phone      = $("#phone")?.value?.trim() || null;
    const notes      = $("#notes")?.value?.trim() || null;
    const is_active  = $("#is_active")?.checked ?? null;

    const payload = { first_name, last_name, phone, notes, is_active };

    if (toggleEmail?.checked && emailInput) {
      const original = emailInput.dataset.originalEmail || "";
      const next = (emailInput.value || "").trim();
      if (next && next !== original) {
        payload.email = next;
        payload.confirm_email_change = !!confirmEmail?.checked;
      }
    }
    return payload;
  };

  const save = async () => {
    const url = `/admin/users/${userId}/update`;
    const body = gatherPayload();

    // Guard dangerous email change if enabled
    if ("email" in body && !body.confirm_email_change) {
      showFlash("Email change requires confirmation checkbox.", "warn");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "fetch"
        },
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) {
        const msg = (json && json.error) ? json.error : `Save failed (${res.status})`;
        showFlash(msg, "error");
        return;
      }

      // Success: reflect changes locally
      const u = json.user || {};
      if (emailInput && u.email) {
        emailInput.value = u.email;
        emailInput.dataset.originalEmail = u.email;
      }
      if ($("#first_name") && u.first_name !== undefined) $("#first_name").value = u.first_name || "";
      if ($("#last_name") && u.last_name !== undefined) $("#last_name").value = u.last_name || "";
      if ($("#phone") && u.phone !== undefined) $("#phone").value = u.phone || "";
      if ($("#notes") && u.notes !== undefined) $("#notes").value = u.notes || "";
      if ($("#is_active") && u.is_active !== undefined) $("#is_active").checked = !!u.is_active;

      // Reset email danger toggle after save
      if (toggleEmail?.checked) {
        toggleEmail.checked = false;
        emailInput.disabled = true;
        emailWarn.style.display = "none";
        if (confirmEmail) confirmEmail.checked = false;
      }

      showFlash("Saved successfully.", "success");
    } catch (err) {
      showFlash("Network error while saving.", "error");
    } finally {
      setSaving(false);
    }
  };

  saveBtn?.addEventListener("click", save);
})();
