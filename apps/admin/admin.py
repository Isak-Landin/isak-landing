import pyotp
import qrcode
import io
import base64
from flask import Blueprint, render_template, request, session, redirect, url_for, jsonify
from flask_login import current_user, login_required
from apps.admin.models import AdminUser
from apps.Users.models import User
from apps.VPS.models import VPS
from extensions import db

from decorators import admin_2fa_required, admin_required

# To present purchased VPS:s in admin panel
from sqlalchemy import func
from apps.VPS.models import VPS, VpsSubscription, VPSPlan

# --- NEW: Billing subscriptions API ---
from apps.VPS.models import BillingRecord

admin_blueprint = Blueprint("admin_blueprint", __name__, url_prefix="/admin")


@admin_blueprint.route('/setup-2fa', methods=['GET', 'POST'])
@login_required
@admin_required
def setup_2fa():
    if not isinstance(current_user, AdminUser):
        return redirect(url_for('users_blueprint.dashboard'))

    if not current_user.totp_secret:
        # Only create the secret in session
        if 'pending_2fa_secret' not in session:
            session['pending_2fa_secret'] = pyotp.random_base32()
        totp = pyotp.TOTP(session['pending_2fa_secret'])
    else:
        # Already verified user
        totp = pyotp.TOTP(current_user.totp_secret)

    otp_uri = totp.provisioning_uri(name=current_user.email, issuer_name="HostNodex Admin")
    img = qrcode.make(otp_uri)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    if request.method == 'POST':
        code = request.form.get('code', '').strip()
        if totp.verify(code):
            # Save secret only after successful verification
            if not current_user.totp_secret:
                current_user.totp_secret = session['pending_2fa_secret']
                db.session.commit()
                session.pop('pending_2fa_secret', None)

            session['admin_2fa_passed'] = True
            return redirect(url_for('admin_blueprint.dashboard'))
        else:
            return render_template('setup_2fa.html', qr_code=qr_b64, error="Invalid code")

    return render_template('setup_2fa.html', qr_code=qr_b64)



@admin_blueprint.route('/2fa', methods=['GET', 'POST'])
@login_required
@admin_required
def otp_verify():
    if not isinstance(current_user, AdminUser):
        return redirect(url_for('users_blueprint.dashboard'))

    if not current_user.totp_secret:
        return redirect(url_for('admin_blueprint.setup_2fa'))

    totp = pyotp.TOTP(current_user.totp_secret)

    if request.method == 'POST':
        code = request.form.get('code', '').strip()
        if totp.verify(code):
            session['admin_2fa_passed'] = True
            return redirect(url_for('admin_blueprint.dashboard'))
        return render_template('verify_2fa.html', error="Invalid 2FA code.")

    return render_template('verify_2fa.html')


@admin_blueprint.route('/dashboard')
@login_required
@admin_required
@admin_2fa_required
def dashboard():
    users = User.query.all()
    vps_list = VPS.query.all()  # Adjust if your model is named differently
    return render_template('admin_dashboard.html', users=users, vps_list=vps_list)


@admin_blueprint.get("/api/dashboard-data")
@login_required
@admin_required
def get_admin_dashboard_data():
    # Users with VPS count
    rows = (
        db.session.query(User.id, User.email, func.count(VPS.id))
        .outerjoin(VPS, VPS.user_id == User.id)
        .group_by(User.id, User.email)
        .order_by(User.email.asc())
        .all()
    )
    users = [{"id": _id, "email": email, "vps_count": int(cnt)} for (_id, email, cnt) in rows]

    # VPS list
    vps_rows = (
        db.session.query(
            VPS.hostname, VPS.ip_address, VPS.os, VPS.cpu_cores, VPS.ram_mb,
            User.email.label("owner_email")
        )
        .join(User, User.id == VPS.user_id)
        .order_by(VPS.created_at.desc())
        .all()
    )
    vps_list = [{
        "hostname": h or "",
        "ip_address": ip or "",
        "os": os or "",
        "cpu_cores": int(cpu or 0),
        "ram_mb": int(ram or 0),
        "owner_email": owner or "",
    } for (h, ip, os, cpu, ram, owner) in vps_rows]

    # Subscriptions list (these are your “orders” to provision)
    subs = (
        db.session.query(
            VpsSubscription.id, VpsSubscription.status, VpsSubscription.interval,
            VpsSubscription.currency, VpsSubscription.unit_amount,
            VpsSubscription.stripe_subscription_id,
            User.email.label("owner_email"),
            VPSPlan.name.label("plan_name"),
        )
        .join(User, User.id == VpsSubscription.user_id)
        .join(VPSPlan, VPSPlan.id == VpsSubscription.plan_id)
        .order_by(VpsSubscription.created_at.desc())
        .all()
    )
    subscriptions = [{
        "id": sid,
        "owner_email": owner,
        "plan": plan,
        "interval": interval,
        "status": status,
        "price": f"{(amount or 0):.2f} {currency.upper()}",
        "stripe_subscription_id": ssub
    } for (sid, status, interval, currency, amount, ssub, owner, plan) in subs]

    return jsonify({"users": users, "vps": vps_list, "subscriptions": subscriptions})


@admin_blueprint.post("/api/provision-vps")
@login_required
@admin_required
@admin_2fa_required
def provision_vps_from_subscription():
    data = request.get_json(silent=True) or {}
    sub_id = data.get("subscription_id")
    hostname = data.get("hostname") or ""
    os_choice = data.get("os") or "Ubuntu 24.04"

    if not sub_id or not hostname:
        return jsonify({"ok": False, "error": "subscription_id and hostname are required"}), 400

    sub = VpsSubscription.query.filter_by(id=sub_id).first()
    if not sub:
        return jsonify({"ok": False, "error": "Subscription not found"}), 404

    # Idempotency: one VPS per subscription (your model has unique=True on subscription_id)
    if sub.vps:
        return jsonify({"ok": True, "idempotent": True, "vps_id": sub.vps.id})

    # Allow only good statuses
    if sub.status not in ("active", "trialing"):
        return jsonify({"ok": False, "error": f"Subscription status '{sub.status}' is not provisionable"}), 409

    plan = sub.plan
    user = sub.user
    if not plan or not user:
        return jsonify({"ok": False, "error": "Subscription missing user/plan link"}), 409

    vps = VPS(
        user_id=user.id,
        subscription_id=sub.id,
        hostname=hostname,
        ip_address="pending",
        os=os_choice,
        cpu_cores=plan.cpu_cores,
        ram_mb=plan.ram_mb,
        disk_gb=plan.disk_gb,
        provider="hostup",
        provisioning_status="pending",
        is_ready=False,
    )
    db.session.add(vps)
    db.session.commit()

    return jsonify({"ok": True, "vps_id": vps.id})


@admin_blueprint.get("/api/billing/subscriptions")
@login_required
@admin_required
def get_admin_billing_subscriptions():
    """
    JSON for the Billing (Subs) tab.
    Query params: q, mode=all|live|test, status, page, per
    """
    from sqlalchemy import or_

    q_text = (request.args.get("q") or "").strip()
    mode = (request.args.get("mode") or "all").lower()
    status = (request.args.get("status") or "").strip().lower()
    page = max(int(request.args.get("page", 1)), 1)
    per = min(max(int(request.args.get("per", 50)), 1), 200)

    q = (
        db.session.query(BillingRecord, User)
        .join(User, BillingRecord.user_id == User.id)
        .filter(BillingRecord.type == "subscription")
        .order_by(BillingRecord.created_at.desc())
    )

    if mode == "live":
        q = q.filter(BillingRecord.livemode.is_(True))
    elif mode == "test":
        q = q.filter(BillingRecord.livemode.is_(False))

    if status:
        q = q.filter(BillingRecord.status.ilike(status + "%"))

    if q_text:
        like = f"%{q_text}%"
        q = q.filter(
            or_(
                User.email.ilike(like),
                BillingRecord.subscription_id.ilike(like),
                BillingRecord.stripe_id.ilike(like),
                BillingRecord.description.ilike(like),
            )
        )

    # simple pagination (server-side)
    total = q.count()
    items = q.limit(per).offset((page - 1) * per).all()

    def _money(amount_cents, currency):
        if amount_cents is None or not currency:
            return None, None
        return amount_cents, f"{amount_cents/100:.2f} {currency.upper()}"

    data = []
    for rec, user in items:
        cents, amount_str = _money(rec.amount_cents, rec.currency)
        data.append({
            "created_at": rec.created_at.isoformat() if rec.created_at else None,
            "user_email": user.email,
            "user_id": user.id,
            "subscription_id": rec.subscription_id or rec.stripe_id,
            "description": rec.description,
            "amount_cents": cents,
            "amount": amount_str,               # convenience for UI
            "currency": (rec.currency or "").upper() if rec.currency else None,
            "status": rec.status,
            "livemode": bool(rec.livemode),
        })

    return jsonify({
        "items": data,
        "page": page,
        "per": per,
        "total": total,
        "pages": (total + per - 1) // per
    })


from .routes import users_detail as _admin_routes_users  # noqa: F401

import apps.admin.routes


