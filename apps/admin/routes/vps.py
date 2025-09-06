# Secure for python -3.9
from __future__ import annotations
# apps/admin/routes/vps.py

from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required
from datetime import datetime

from extensions import db
from apps.VPS.models import VPS, VpsSubscription
from decorators import admin_required, admin_2fa_required
from apps.admin.admin import admin_blueprint


@admin_blueprint.route("/vps/<int:vps_id>", methods=["GET"])
@login_required
@admin_required
def admin_vps_detail(vps_id):
    vps = VPS.query.get_or_404(vps_id)
    return render_template("admin/vps_detail.html", vps=vps)


@admin_blueprint.route("/vps/<int:vps_id>/save", methods=["POST"])
@login_required
@admin_required
@admin_2fa_required
def admin_vps_save(vps_id):
    vps = VPS.query.get_or_404(vps_id)

    def to_int(val):
        try:
            return int(val) if (val is not None and val != "") else None
        except Exception:
            return None

    vps.hostname = (request.form.get("hostname") or vps.hostname or "").strip() or vps.hostname
    vps.ip_address = (request.form.get("ip_address") or vps.ip_address or "").strip() or vps.ip_address
    vps.location = (request.form.get("location") or vps.location or "").strip() or vps.location
    vps.region = (request.form.get("region") or vps.region or "").strip() or vps.region
    vps.os = (request.form.get("os") or vps.os or "").strip() or vps.os

    vps.cpu_cores = to_int(request.form.get("cpu_cores"))
    vps.ram_mb    = to_int(request.form.get("ram_mb"))
    vps.disk_gb   = to_int(request.form.get("disk_gb"))

    vps.provider          = (request.form.get("provider") or vps.provider or "").strip() or vps.provider
    vps.provider_order_id = request.form.get("provider_order_id", vps.provider_order_id) or vps.provider_order_id
    vps.provider_vm_id    = request.form.get("provider_vm_id", vps.provider_vm_id) or vps.provider_vm_id
    vps.image             = request.form.get("image", vps.image) or vps.image
    vps.ssh_key_id        = request.form.get("ssh_key_id", vps.ssh_key_id) or vps.ssh_key_id

    vps.status = request.form.get("status", vps.status) or vps.status
    vps.provisioning_status = request.form.get("provisioning_status", vps.provisioning_status) or vps.provisioning_status
    vps.is_ready = (request.form.get("is_ready") == "on")

    vps.notes = request.form.get("notes", vps.notes)

    db.session.commit()
    flash("VPS changes saved.", "success")
    return redirect(url_for("admin_blueprint.admin_vps_detail", vps_id=vps.id))


# apps/admin/routes/vps.py  (only the route below is a replacement)
@admin_blueprint.route("/vps/<int:vps_id>/provision", methods=["POST"])
@login_required
@admin_required
@admin_2fa_required
def admin_vps_provision(vps_id):
    from sqlalchemy import exists
    vps = VPS.query.get_or_404(vps_id)

    # Accept same editable fields (optional)
    for key, val in request.form.items():
        if key in {
            "hostname", "ip_address", "location", "region", "os",
            "provider", "provider_order_id", "provider_vm_id", "image", "ssh_key_id", "notes"
        }:
            setattr(vps, key, (val or "").strip())

    def to_int(val):
        try:
            return int(val) if (val is not None and val != "") else None
        except Exception:
            return None

    if "cpu_cores" in request.form: vps.cpu_cores = to_int(request.form.get("cpu_cores"))
    if "ram_mb"    in request.form: vps.ram_mb    = to_int(request.form.get("ram_mb"))
    if "disk_gb"   in request.form: vps.disk_gb   = to_int(request.form.get("disk_gb"))

    # ---- ensure hostname exists + unique ------------------------------------
    import re, secrets
    def _slug(s: str) -> str:
        s = (s or "").lower().strip()
        s = re.sub(r"[^a-z0-9\-]+", "-", s)
        s = re.sub(r"-{2,}", "-", s).strip("-")
        return s or "vps"

    def _ensure_unique(name_base: str) -> str:
        base = name_base[:50]
        if not db.session.query(exists().where(VPS.hostname == base)).scalar():
            return base
        for i in range(2, 10):
            cand = f"{base}-{i}"
            if not db.session.query(exists().where(VPS.hostname == cand)).scalar():
                return cand
        for _ in range(10):
            cand = f"{base}-{secrets.token_hex(2)}"
            if not db.session.query(exists().where(VPS.hostname == cand)).scalar():
                return cand
        return f"{base}-{int(datetime.utcnow().timestamp())}"

    if not (vps.hostname or "").strip():
        gen = getattr(VPS, "generate_hostname", None) or getattr(VPS, "suggest_hostname", None)
        if callable(gen):
            try:
                base = gen(user=vps.user, plan=getattr(vps, "plan", None), session=db.session)
            except TypeError:
                base = gen(user=vps.user, plan=getattr(vps, "plan", None))
        else:
            email_local = (vps.user.email if vps.user and vps.user.email else "user").split("@", 1)[0]
            base = f"{email_local}-vps"
        vps.hostname = _ensure_unique(_slug(base))
    else:
        vps.hostname = _ensure_unique(_slug(vps.hostname))
    # -------------------------------------------------------------------------

    # Flip to active/ready
    vps.status = "active"
    vps.provisioning_status = "ready"
    vps.is_ready = True
    vps.updated_at = datetime.utcnow()

    db.session.commit()
    flash("VPS provisioned and set to active.", "success")
    return redirect(url_for("admin_blueprint.admin_vps_detail", vps_id=vps.id))

