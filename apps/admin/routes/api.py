# apps/admin/routes/api.py

from flask import request, jsonify
from apps.admin.admin import admin_blueprint
from apps.admin.models import AdminUser
from extensions import db, limiter
from decorators import admin_required, admin_2fa_required
from email_validator import validate_email, EmailNotValidError
import re

# Password policy — same spirit as user auth
EMAIL_MAX_LEN = 254
PASS_MIN = 12
PASS_MAX = 128
PASS_RE = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{%d,%d}$' % (PASS_MIN, PASS_MAX))

def _normalize_email(email: str) -> str:
    if not email or len(email) > EMAIL_MAX_LEN:
        raise ValueError("Invalid email.")
    try:
        info = validate_email(email, allow_smtputf8=True)
        return (info.normalized or "").lower()
    except EmailNotValidError as e:
        raise ValueError(str(e))

def _validate_password(pw: str, email_hint: str = ""):
    if not pw:
        raise ValueError("Password is required.")
    if len(pw) < PASS_MIN:
        raise ValueError(f"Password must be at least {PASS_MIN} characters.")
    if len(pw) > PASS_MAX:
        raise ValueError("Password too long.")
    if email_hint and email_hint in pw.lower():
        raise ValueError("Password must not contain the email.")
    if not PASS_RE.match(pw):
        raise ValueError("Password must include uppercase, lowercase, a number, and a symbol.")

@admin_blueprint.route("/api/admins", methods=["POST"])
@limiter.limit("10/hour")
@admin_required
@admin_2fa_required
def api_create_admin():
    """
    Create a new admin user.
    Expects form or JSON fields: email, password, confirm_password
    Returns JSON: { success: bool, error?: str, admin_id?: int }
    """
    # Accept either form-encoded or JSON
    payload = request.get_json(silent=True) or request.form

    raw_email = (payload.get("email") or "").strip()
    password = (payload.get("password") or "").strip()
    confirm  = (payload.get("confirm_password") or "").strip()

    if not raw_email or not password or not confirm:
        return jsonify(success=False, error="Missing required fields."), 400

    if password != confirm:
        return jsonify(success=False, error="Passwords do not match."), 400

    try:
        email = _normalize_email(raw_email)
        _validate_password(password, email_hint=email)
    except ValueError as ve:
        return jsonify(success=False, error=str(ve)), 400

    # Uniqueness
    if AdminUser.query.filter_by(email=email).first():
        return jsonify(success=False, error="Email is already registered as admin."), 409

    # Create admin
    admin = AdminUser(email=email)
    admin.set_password(password)

    try:
        db.session.add(admin)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify(success=False, error="Database error while creating admin."), 500

    return jsonify(success=True, admin_id=admin.id), 201
