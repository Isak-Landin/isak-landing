# apps/Users/users.py

from flask import Blueprint, render_template, jsonify, request
from flask_login import login_required, current_user
from sqlalchemy import or_, and_
import re
from extensions import limiter

from extensions import db
from apps.VPS.models import VPS, VpsSubscription

blueprint = Blueprint('users_blueprint', __name__, url_prefix='/users')


PASS_MIN = 12
PASS_MAX = 128
PASS_RE = re.compile(rf'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{{{PASS_MIN},{PASS_MAX}}}$')


def _validate_password_rules(pw: str, email_hint: str = ""):
    if not pw:
        raise ValueError("Password is required.")
    if len(pw) > PASS_MAX:
        raise ValueError("Password too long.")
    if len(pw) < PASS_MIN:
        raise ValueError(f"Password must be at least {PASS_MIN} characters.")
    if email_hint and email_hint.lower() in pw.lower():
        raise ValueError("Password must not contain your email.")
    if not PASS_RE.match(pw):
        raise ValueError("Password must include upper, lower, number, and symbol.")

def build_vps_dashboard_context(user_id: int):
    """
    Prepare the user's VPS data for three UI buckets:
      1) awaiting_provisioning  – subs that need a VPS OR VPSes still provisioning
      2) active_vps             – running/ready VPSes
      3) inactive_vps           – suspended/terminated/ended
    """
    # All subscriptions for this user (used to detect paid-but-no-VPS yet)
    subs = VpsSubscription.query.filter_by(user_id=user_id).all()
    # Subscriptions that are active-ish and should have a VPS, but don't yet
    subs_needing_vps = [
        s for s in subs
        if (s.status in ('active', 'trialing', 'past_due', 'incomplete')  # keep broad for MVP
            and not s.canceled_at
            and not s.ended_at
            and not s.cancel_at_period_end
            and (getattr(s, "vps", None) is None))
    ]

    # All VPS for the user
    user_vps_q = VPS.query.filter(VPS.user_id == user_id)

    # VPS that are provisioned/ready and active
    active_vps = user_vps_q.filter(
        and_(
            VPS.status == 'active',
            or_(VPS.is_ready.is_(True), VPS.provisioning_status == 'ready')
        )
    ).order_by(VPS.created_at.desc()).all()

    # VPS that are still provisioning (pending / in-progress / not ready yet)
    vps_still_provisioning = user_vps_q.filter(
        or_(
            VPS.provisioning_status.in_(['pending', 'provisioning']),
            VPS.is_ready.is_(False)
        )
    ).order_by(VPS.created_at.desc()).all()

    # VPS that are no longer active (suspended/terminated/etc.)
    inactive_vps = user_vps_q.filter(
        VPS.status.in_(['suspended', 'terminated', 'canceled', 'ended'])
    ).order_by(VPS.updated_at.desc()).all()

    # Awaiting provisioning bucket includes:
    #  - subs that need a VPS created
    #  - VPS rows that exist but are still provisioning/not ready
    awaiting_provisioning = {
        "subs_needing_vps": subs_needing_vps,
        "vps_in_progress": vps_still_provisioning,
        "count": len(subs_needing_vps) + len(vps_still_provisioning),
    }

    summary = {
        "total_vps": user_vps_q.count(),
        "active_count": len(active_vps),
        "awaiting_count": awaiting_provisioning["count"],
        "inactive_count": len(inactive_vps),
    }

    return {
        "awaiting_provisioning": awaiting_provisioning,
        "active_vps": active_vps,
        "inactive_vps": inactive_vps,
        "subscriptions": subs,   # optional, can be useful in the UI
        "summary": summary,
    }


@blueprint.route('/dashboard', methods=['GET'])
@login_required
def dashboard():
    ctx = build_vps_dashboard_context(current_user.id)
    # Keep old 'vps' for backward-compat with existing template bits
    vps_list = ctx["active_vps"]
    return render_template(
        'dashboard.html',
        user=current_user,
        vps=vps_list,  # legacy var if template references it
        vps_ctx=ctx    # new structured context for the 3 cases
    )


@blueprint.route("/change-password", methods=["POST"])
@limiter.limit("5/hour")
@login_required
def change_password():
    """
    Expects form (or JSON) fields:
      current_password, new_password, confirm_password
    Returns JSON: { success: bool, error?: str }
    """
    payload = request.get_json(silent=True) or request.form

    current_pw = (payload.get("current_password") or "").strip()
    new_pw     = (payload.get("new_password") or "").strip()
    confirm_pw = (payload.get("confirm_password") or "").strip()

    if not current_pw or not new_pw or not confirm_pw:
        return jsonify(success=False, error="All fields are required."), 400

    if not current_user.check_password(current_pw):
        # Don’t leak whether the account exists; here it’s the logged-in user, so be clear but generic
        return jsonify(success=False, error="Current password is incorrect."), 400

    if new_pw != confirm_pw:
        return jsonify(success=False, error="Passwords do not match."), 400

    try:
        _validate_password_rules(new_pw, email_hint=current_user.email or "")
    except ValueError as ve:
        return jsonify(success=False, error=str(ve)), 400

    # Reject reuse of the current password
    if current_pw == new_pw:
        return jsonify(success=False, error="New password must be different from the current password."), 400

    # Save
    current_user.set_password(new_pw)
    from extensions import db
    db.session.commit()

    return jsonify(success=True), 200
