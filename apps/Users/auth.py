# apps/Users/auth.py
import hashlib
from sqlalchemy import text

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, session, current_app, send_from_directory
from flask_login import login_user, current_user, login_required, logout_user
from apps.Users.models import User
from apps.admin.models import AdminUser
from extensions import db, limiter
import traceback
import re
from email_validator import validate_email, EmailNotValidError
from werkzeug.security import check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from jinja2 import TemplateNotFound
import os

auth_blueprint = Blueprint('auth_blueprint', __name__, url_prefix='/auth')

# ---- Validators (aligned to DB column length 120) ----
EMAIL_MAX_LEN = 120  # model uses db.String(120)
PASS_MIN = 12
PASS_MAX = 128
# at least one lower, upper, digit, symbol
PASS_RE = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{%d,%d}$' % (PASS_MIN, PASS_MAX))


# ---- Helpers ---- (Validators, Normalizers, etc.) ----
def norm(s: str) -> str:
    return (s or "").strip()


def parse_bool(val) -> bool:
    if val is True:
        return True
    v = str(val).strip().lower()
    return v in ("1", "true", "on", "yes")


def validate_email_safe(email: str) -> str:
    # initial basic length gate to avoid huge payloads
    if not email or len(email) > EMAIL_MAX_LEN:
        raise ValueError("Invalid email or too long.")
    try:
        info = validate_email(email, allow_smtputf8=True)
        normalized = info.normalized
        # enforce storage length after normalization too
        if len(normalized) > EMAIL_MAX_LEN:
            raise ValueError("Invalid email or too long.")
        return normalized
    except EmailNotValidError as e:
        raise ValueError(str(e))


def validate_password_rules(pw: str, email_hint: str = ""):
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

# ---- Helpers for reset tokens / JSON ----


def _serializer() -> URLSafeTimedSerializer:
    secret = current_app.config.get('SECRET_KEY') or ''
    return URLSafeTimedSerializer(secret_key=secret, salt='pw-reset-v1')


def _make_reset_token(user_id: int) -> str:
    return _serializer().dumps({'uid': user_id})


def _parse_reset_token(token: str, max_age_seconds: int = 86400) -> int | None:
    try:
        data = _serializer().loads(token, max_age=max_age_seconds)
        return int(data.get('uid'))
    except (BadSignature, SignatureExpired, ValueError, TypeError):
        return None


def _wants_json() -> bool:
    if request.is_json:
        return True
    acc = request.headers.get('Accept', '')
    if 'application/json' in acc and 'text/html' not in acc:
        return True
    if request.headers.get('X-Requested-With', '').lower() == 'xmlhttprequest':
        return True
    return False

def _render_or_static(path_rel: str, **ctx):
    """
    Try Jinja template under static/templates/<path_rel> first.
    If not present, fall back to serving a static HTML from static/users/ for your current setup.
    """
    try:
        return render_template(path_rel, **ctx)
    except TemplateNotFound:
        # Fallback to static/users/ (you mentioned placing files there)
        static_users = os.path.join(current_app.static_folder, 'users')
        fname = os.path.basename(path_rel)
        return send_from_directory(static_users, fname)


def _send_reset_email(to_email: str, link: str):
    """
    Minimal stub: prints to server logs. Replace with SMTP/Mailgun later.
    """
    current_app.logger.info(f"[password-reset] To: {to_email}  Link: {link}")


# ---- Blacklist for weak passwords ----
def is_password_in_blacklist_10m(pw: str) -> bool:
    """
    O(1) indexed check against weak_passwords_10m.
    We hash lowercase(pw) with SHA-256 to match seeded rows.
    """
    if not pw:
        return False
    h = hashlib.sha256(pw.lower().encode("utf-8")).hexdigest()
    sql = text("SELECT 1 FROM weak_passwords_10m WHERE hash = :h LIMIT 1")
    return db.session.execute(sql, {"h": h}).first() is not None


# ---- Routes ----
@auth_blueprint.route('/login', methods=['GET', 'POST'])
@limiter.limit("10/minute;20/hour")
def login():
    if request.method == 'GET':
        if current_user.is_authenticated:
            if session.get('login_type') == 'admin':
                return redirect(url_for('admin_blueprint.dashboard'))
            return redirect(url_for('users_blueprint.dashboard'))
        return render_template('login.html')

    try:
        email_raw = norm(request.form.get('email'))
        password = norm(request.form.get('password'))

        if not email_raw or not password:
            return jsonify(success=False, error="Invalid email or password."), 400

        # Normalize email (lowercased) for consistent lookups; keep generic errors
        try:
            email = validate_email_safe(email_raw).lower()
        except ValueError:
            return jsonify(success=False, error="Invalid email or password."), 400

        # Try admin first
        admin = AdminUser.query.filter_by(email=email).first()
        if admin and check_password_hash(admin.password, password):
            session['login_type'] = 'admin'
            login_user(admin)
            if admin.email == 'admin@admin.com':
                return jsonify(success=True, redirect=url_for('admin_blueprint.dashboard')), 200
            if getattr(admin, "totp_secret", None):
                return jsonify(success=True, redirect=url_for('admin_blueprint.otp_verify')), 200
            return jsonify(success=True, redirect=url_for('admin_blueprint.setup_2fa')), 200

        # Regular user
        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            return jsonify(success=False, error="Invalid email or password."), 401

        session['login_type'] = 'user'
        login_user(user)
        return jsonify(success=True, redirect=url_for('users_blueprint.dashboard')), 200

    except Exception as e:
        current_app.logger.exception("Login error")
        return jsonify(success=False, error="Internal server error. Please try again later."), 500


@auth_blueprint.route('/logout')
def logout():
    logout_user()
    session.clear()
    return redirect(url_for('auth_blueprint.login'))


@auth_blueprint.route('/register', methods=['GET', 'POST'])
@limiter.limit("5/minute;20/hour")
def register():
    if request.method == 'GET':
        if current_user.is_authenticated:
            return redirect(url_for('users_blueprint.dashboard'))
        return render_template('register.html')

    try:
        email_raw = request.form.get('email', '')
        password = norm(request.form.get('password'))
        confirm = norm(request.form.get('confirm_password'))
        accepted = parse_bool(request.form.get("accept_legal"))

        # Must accept legal
        if not accepted:
            return jsonify(success=False, error="You must agree to the Terms, Privacy Policy, and AUP."), 400

        # Normalize + lowercase email for storage and uniqueness checks
        email = validate_email_safe(norm(email_raw)).lower()

        # Password checks
        if password != confirm:
            return jsonify(success=False, error="Passwords do not match."), 400
        try:
            validate_password_rules(password, email_hint=email)
        except ValueError as ve:
            return jsonify(success=False, error=str(ve)), 400

        # Already registered?
        if User.query.filter_by(email=email).first():
            return jsonify(success=False, error="Email is already registered."), 409

        # Create user
        user = User(email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        login_user(user)

        return jsonify(success=True, redirect=url_for('users_blueprint.dashboard')), 200

    except ValueError as ve:
        return jsonify(success=False, error=str(ve)), 400
    except Exception:
        current_app.logger.exception("Register error")
        return jsonify(success=False, error="Internal server error. Please try again later."), 500


# ---------- Forgot / Reset password ----------

@auth_blueprint.route('/forgot', methods=['GET', 'POST'])
@limiter.limit("5/hour")
def forgot_password():
    if request.method == 'GET':
        if current_user.is_authenticated:
            return redirect(url_for('users_blueprint.dashboard'))
        # Prefer Jinja template path "users/forgot_password.html"
        return _render_or_static('users/forgot_password.html')

    # POST
    try:
        raw_email = norm(request.form.get('email'))
        # Always respond generically (no enumeration)
        generic_ok = {"success": True, "message": "If that email exists in our system, a reset link has been sent."}

        try:
            email = validate_email_safe(raw_email).lower()
        except Exception:
            # Still return generic success
            if _wants_json():
                return jsonify(**generic_ok), 200
            return redirect(url_for('auth_blueprint.login'))

        user = User.query.filter_by(email=email).first()
        if user:
            token = _make_reset_token(user.id)
            link = url_for('auth_blueprint.reset_password', token=token, _external=True)
            _send_reset_email(email, link)

        if _wants_json():
            return jsonify(**generic_ok), 200
        return redirect(url_for('auth_blueprint.login'))

    except Exception:
        current_app.logger.exception("Forgot password error")
        if _wants_json():
            return jsonify(success=True, message="If that email exists in our system, a reset link has been sent."), 200
        return redirect(url_for('auth_blueprint.login'))


@auth_blueprint.route('/reset', methods=['GET', 'POST'])
@limiter.limit("10/hour")
def reset_password():
    """
    GET  /auth/reset?token=...   -> show reset form (if token valid)
    POST /auth/reset             -> set new password (expects token, password, confirm_password)
    """
    if request.method == 'GET':
        if current_user.is_authenticated:
            return redirect(url_for('users_blueprint.dashboard'))
        token = norm(request.args.get('token'))
        uid = _parse_reset_token(token)
        if not uid:
            # invalid/expired
            return _render_or_static('users/reset_password.html', token="", error="This link is invalid or expired. Please request a new one.")
        return _render_or_static('users/reset_password.html', token=token, error="")

    # POST
    try:
        token = norm(request.form.get('token'))
        password = norm(request.form.get('password'))
        confirm = norm(request.form.get('confirm_password'))

        uid = _parse_reset_token(token)
        if not uid:
            msg = "The reset link is invalid or has expired."
            if _wants_json():
                return jsonify(success=False, error=msg), 400
            return _render_or_static('users/reset_password.html', token="", error=msg)

        user = User.query.get(uid)
        if not user:
            # Generic error to avoid enumeration
            msg = "The reset link is invalid or has expired."
            if _wants_json():
                return jsonify(success=False, error=msg), 400
            return _render_or_static('users/reset_password.html', token="", error=msg)

        if password != confirm:
            msg = "Passwords do not match."
            if _wants_json():
                return jsonify(success=False, error=msg), 400
            return _render_or_static('users/reset_password.html', token=token, error=msg)

        try:
            validate_password_rules(password, email_hint=user.email or "")
        except ValueError as ve:
            msg = str(ve)
            if _wants_json():
                return jsonify(success=False, error=msg), 400
            return _render_or_static('users/reset_password.html', token=token, error=msg)

        # All good — set new password
        user.set_password(password)
        db.session.commit()

        # Optionally auto-login after reset:
        session['login_type'] = 'user'
        login_user(user)

        if _wants_json():
            return jsonify(success=True, redirect=url_for('users_blueprint.dashboard')), 200
        return redirect(url_for('users_blueprint.dashboard'))

    except Exception:
        current_app.logger.exception("Reset password error")
        if _wants_json():
            return jsonify(success=False, error="Internal server error."), 500
        return _render_or_static('users/reset_password.html', token="", error="Something went wrong. Please try again.")
