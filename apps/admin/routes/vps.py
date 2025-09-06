# apps/admin/routes/vps.py
from __future__ import annotations

from flask import render_template, request, redirect, url_for, flash
from flask_login import login_required
from datetime import datetime

from extensions import db
from apps.VPS.models import VPS, VpsSubscription
from decorators import admin_required, admin_2fa_required
from apps.admin.admin import admin_blueprint


def _to_int(val):
    try:
        return int(val) if (val is not None and val != "") else None
    except Exception:
        return None


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

    # Read incoming (don’t wipe existing if blank)
    hostname = (request.form.get("hostname") or vps.hostname or "").strip()
    ip_addr  = (request.form.get("ip_address") or vps.ip_address or "").strip()
    location = (request.form.get("location") or vps.location or "").strip()
    region   = (request.form.get("region") or vps.region or "").strip()
    os_name  = (request.form.get("os") or vps.os or "").strip()

    vps.hostname = hostname or vps.hostname
    vps.ip_address = ip_addr or vps.ip_address
    vps.location = location or vps.location
    vps.region = region or vps.region
    vps.os = os_name or vps.os

    vps.cpu_cores = _to_int(request.form.get("cpu_cores"))
    vps.ram_mb    = _to_int(request.form.get("ram_mb"))
    vps.disk_gb   = _to_int(request.form.get("disk_gb"))

    vps.provider          = (request.form.get("provider") or vps.provider or "").strip() or vps.provider
    vps.provider_order_id = request.form.get("provider_order_id", vps.provider_order_id) or vps.provider_order_id
    vps.provider_vm_id    = request.form.get("provider_vm_id", vps.provider_vm_id) or vps.provider_vm_id
    vps.image             = request.form.get("image", vps.image) or vps.image
    vps.ssh_key_id        = request.form.get("ssh_key_id", vps.ssh_key_id) or vps.ssh_key_id

    vps.status = request.form.get("status", vps.status) or vps.status
    vps.provisioning_status = request.form.get("provisioning_status", vps.provisioning_status) or vps.provisioning_status
    vps.is_ready = (request.form.get("is_ready") == "on")
    vps.notes = request.form.get("notes", vps.notes)

    # NEW: access defaults (required)
    vps.default_username = (request.form.get("default_username") or vps.default_username or "").strip()
    vps.default_password = (request.form.get("default_password") or vps.default_password or "").strip()

    # Validate required before saving
    errors = []
    if not vps.hostname:
        errors.append("Hostname is required.")
    if not vps.ip_address or vps.ip_address.lower() == "pending":
        errors.append("IP address is required.")
    if not vps.default_username:
        errors.append("Default username is required.")
    if not vps.default_password:
        errors.append("Default password is required.")

    if errors:
        for e in errors:
            flash(e, "error")
        return redirect(url_for("admin_blueprint.admin_vps_detail", vps_id=vps.id))

    db.session.commit()
    flash("VPS changes saved.", "success")
    return redirect(url_for("admin_blueprint.admin_vps_detail", vps_id=vps.id))


@admin_blueprint.route("/vps/<int:vps_id>/provision", methods=["POST"])
@login_required
@admin_required
@admin_2fa_required
def admin_vps_provision(vps_id):
    vps = VPS.query.get_or_404(vps_id)

    # Accept same editable fields (optional one-shot)
    for key, val in request.form.items():
        if key in {
            "hostname", "ip_address", "location", "region", "os",
            "provider", "provider_order_id", "provider_vm_id", "image", "ssh_key_id", "notes",
            "default_username", "default_password",
            "cpu_cores", "ram_mb", "disk_gb"
        }:
            if key in ("cpu_cores", "ram_mb", "disk_gb"):
                setattr(vps, key, _to_int(val))
            else:
                setattr(vps, key, (val or "").strip())

    # Validate required before provisioning
    errors = []
    if not vps.hostname:
        errors.append("Hostname is required to provision.")
    if not vps.ip_address or vps.ip_address.lower() == "pending":
        errors.append("IP address is required to provision.")
    if not vps.default_username:
        errors.append("Default username is required to provision.")
    if not vps.default_password:
        errors.append("Default password is required to provision.")

    if errors:
        for e in errors:
            flash(e, "error")
        return redirect(url_for("admin_blueprint.admin_vps_detail", vps_id=vps.id))

    # Flip to active/ready
    vps.status = "active"
    vps.provisioning_status = "ready"
    vps.is_ready = True
    vps.updated_at = datetime.utcnow()

    db.session.commit()
    flash("VPS provisioned and set to active.", "success")
    return redirect(url_for("admin_blueprint.admin_vps_detail", vps_id=vps.id))
