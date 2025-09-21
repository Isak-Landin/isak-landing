# apps/Users/auth.py

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, session
from flask_login import login_user, current_user, login_required, logout_user
from apps.Users.models import User
from apps.admin.models import AdminUser
from extensions import db, limiter
import traceback
import re
from email_validator import validate_email, EmailNotValidError
from werkzeug.security import check_password_hash

auth_blueprint = Blueprint('auth_blueprint', __name__, url_prefix='/auth')



EMAIL_MAX_LEN = 254
PASS_MIN = 12
PASS_MAX = 128
PASS_RE = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{%d,%d}$' % (PASS_MIN, PASS_MAX))

def normalize_email(email: str) -> str:
    if not email or len(email) > EMAIL_MAX_LEN:
        raise ValueError("Invalid email.")
    try:
        info = validate_email(email, allow_smtputf8=True)
        return info.normalized.lower()
    except EmailNotValidError as e:
        raise ValueError(str(e))

def validate_password_rules(pw: str, email_hint: str = ""):
    if not pw:
        raise ValueError("Password is required.")
    if len(pw) < PASS_MIN:
        raise ValueError(f"Password must be at least {PASS_MIN} characters.")
    if len(pw) > PASS_MAX:
        raise ValueError("Password too long.")
    if email_hint and email_hint.lower() in pw.lower():
        raise ValueError("Password must not contain your email.")
    if not PASS_RE.match(pw):
        raise ValueError("Password must include uppercase, lowercase, a number, and a symbol.")


def norm(s: str) -> str:
    return (s or "").strip()

def parse_bool(val) -> bool:
    if val is True:
        return True
    v = str(val).strip().lower()
    return v in ("1", "true", "on", "yes")

# ---- Routes ----

@auth_blueprint.route('/login', methods=['GET', 'POST'])
@limiter.limit("10/minute;100/hour")  # public fix #2 (rate limit)
def login():
    if request.method == 'GET':
        if current_user.is_authenticated:
            if session.get('login_type') == 'admin':
                return redirect(url_for('admin_blueprint.dashboard'))
            return redirect(url_for('users_blueprint.dashboard'))
        return render_template('login.html')

    try:
        email = norm(request.form.get('email'))
        password = norm(request.form.get('password'))

        if not email or not password:
            return jsonify(success=False, error="Invalid email or password."), 400

        # Try admin first (kept from your original flow)
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
            # Generic message to avoid user enumeration
            return jsonify(success=False, error="Invalid email or password."), 401

        session['login_type'] = 'user'
        login_user(user)
        return jsonify(success=True, redirect=url_for('users_blueprint.dashboard')), 200

    except Exception as e:
        print(f"Login error: {e}")
        traceback.print_exc()
        return jsonify(success=False, error="Internal server error. Please try again later."), 500


@auth_blueprint.route('/logout')
def logout():
    logout_user()
    session.clear()
    return redirect(url_for('auth_blueprint.login'))


@auth_blueprint.route('/register', methods=['GET', 'POST'])
@limiter.limit("5/minute;20/hour")  # public fix #2 (rate limit)
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

        # Must accept legal (kept)
        if not accepted:
            return jsonify(success=False, error="You must agree to the Terms, Privacy Policy, and AUP."), 400

        email = validate_email_safe(norm(email_raw))

        # Password checks (blocks “sql injection strings saved as a user” issue)
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
        # From our validators
        return jsonify(success=False, error=str(ve)), 400
    except Exception as e:
        print(f"Register error: {e}")
        traceback.print_exc()
        return jsonify(success=False, error="Internal server error. Please try again later."), 500
