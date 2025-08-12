# apps/admin/routes/user_detail.py
"""
Admin: User detail & update routes
- GET  /admin/users/<id>          -> render detail view (extends admin_dashboard_base.html)
- POST /admin/users/<id>/update   -> JSON update for profile fields (email change guarded)
- POST /admin/users/<id>/start-chat -> (stub) start a chat with user, 501 until integrated
"""

from typing import Any, Dict, Optional

from flask import render_template, request, jsonify, abort
from flask_login import login_required
from sqlalchemy import and_
from extensions import db

# Reuse existing admin blueprint & decorators (no new blueprints)
from apps.admin.admin import admin_blueprint
from decorators import admin_required, admin_2fa_required

# Models
from apps.Users.models import User

# Optional/defensive imports for related data; tolerate differences in model naming.
try:
    from apps.VPS.models import VpsSubscription  # preferred name in your plan
except Exception:  # pragma: no cover
    VpsSubscription = None  # type: ignore

try:
    from apps.VPS.models import VpsInstance as VPS  # sometimes named VpsInstance
except Exception:  # pragma: no cover
    try:
        from apps.VPS.models import VPS  # fallback
    except Exception:  # pragma: no cover
        VPS = None  # type: ignore


def _booly(val: Any) -> Optional[bool]:
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        s = val.strip().lower()
        if s in ("1", "true", "yes", "y", "on"):
            return True
        if s in ("0", "false", "no", "n", "off"):
            return False
    return None


def _looks_like_email(s: str) -> bool:
    return "@" in s and "." in s.split("@")[-1]


@admin_blueprint.route("/users/<int:user_id>", methods=["GET"])
@login_required
@admin_required
@admin_2fa_required
def admin_users_detail(user_id: int):
    user: Optional[User] = User.query.get(user_id)
    if not user:
        abort(404)

    # Related subscriptions
    subs = []
    if VpsSubscription is not None:
        try:
            subs = (
                VpsSubscription.query.filter_by(user_id=user.id)
                .order_by(getattr(VpsSubscription, "created_at", VpsSubscription.id).desc())
                .all()
            )
        except Exception:
            subs = []

    # Related VPS instances
    vps_list = []
    if VPS is not None:
        try:
            vps_list = (
                VPS.query.filter_by(user_id=user.id)
                .order_by(getattr(VPS, "created_at", VPS.id).desc())
                .all()
            )
        except Exception:
            vps_list = []

    return render_template(
        "admin/user_detail.html",
        user=user,
        subs=subs,
        vps_list=vps_list,
        # Any additional context that template may want:
        can_edit_email=True,  # displayed with extra caution in UI
    )


@admin_blueprint.route("/users/<int:user_id>/update", methods=["POST"])
@login_required
@admin_required
@admin_2fa_required
def admin_users_update(user_id: int):
    """JSON update endpoint for admin user edits."""
    user: Optional[User] = User.query.get(user_id)
    if not user:
        return jsonify({"ok": False, "error": "User not found"}), 404

    data: Dict[str, Any] = request.get_json(silent=True) or {}
    # Accept both JSON and form as fallback
    if not data and request.form:
        data = request.form.to_dict(flat=True)

    # Editable fields
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    phone = data.get("phone")
    notes = data.get("notes")
    is_active_raw = data.get("is_active")
    new_email = data.get("email")

    # Update simple fields
    if first_name is not None:
        user.first_name = first_name.strip() or None
    if last_name is not None:
        user.last_name = last_name.strip() or None
    if phone is not None:
        user.phone = phone.strip() or None
    if notes is not None:
        user.notes = notes.strip() or None

    # Update status
    if is_active_raw is not None:
        parsed = _booly(is_active_raw)
        if parsed is None:
            return jsonify({"ok": False, "error": "Invalid value for is_active"}), 400
        user.is_active = parsed

    # Guarded email change
    if new_email is not None and new_email != user.email:
        if not _looks_like_email(new_email):
            return jsonify({"ok": False, "error": "Invalid email format"}), 400

        # Require explicit confirmation for this dangerous operation
        confirm_email_change = data.get("confirm_email_change") in (True, "true", "1", 1, "yes", "on")
        if not confirm_email_change:
            return (
                jsonify(
                    {
                        "ok": False,
                        "error": "Email change requires confirm_email_change=true to proceed",
                        "current_email": user.email,
                        "requested_email": new_email,
                    }
                ),
                400,
            )

        # Ensure email uniqueness
        conflict = User.query.filter(and_(User.email == new_email, User.id != user.id)).first()
        if conflict:
            return jsonify({"ok": False, "error": "Email already in use"}), 409

        user.email = new_email

    try:
        db.session.commit()
    except Exception as e:  # pragma: no cover
        db.session.rollback()
        return jsonify({"ok": False, "error": f"Database error: {e}"}), 500

    # Return a compact payload for UI to update without a full reload
    return jsonify(
        {
            "ok": True,
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone": user.phone,
                "notes": user.notes,
                "is_active": bool(user.is_active),
                "stripe_customer_id": user.stripe_customer_id,
            }
        }
    )


@admin_blueprint.route("/users/<int:user_id>/start-chat", methods=["POST"])
@login_required
@admin_required
@admin_2fa_required
def admin_users_start_chat(user_id: int):
    """
    Placeholder to initiate a chat with the user from the admin detail page.
    Returns 501 until chat integration is wired (Phase 7).
    """
    # TODO: integrate with your chat app (create or fetch conversation and return its ID/URL)
    return jsonify({"ok": False, "error": "Not implemented yet"}), 501
