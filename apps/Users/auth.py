# apps/Users/auth.py

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, session
from flask_login import login_user, current_user, login_required, logout_user
from apps.Users.models import User
from apps.admin.models import AdminUser
from extensions import db
import traceback

from werkzeug.security import check_password_hash


auth_blueprint = Blueprint('auth_blueprint', __name__, url_prefix='/auth')


@auth_blueprint.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        if current_user.is_authenticated:
            if session.get('login_type') == 'admin':
                return redirect(url_for('admin_blueprint.dashboard'))
            return redirect(url_for('users_blueprint.dashboard'))
        return render_template('login.html')

    try:
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()

        if not email or not password:
            return jsonify(success=False, error="Email and password are required."), 400

        # 🔐 Admin check first
        admin = AdminUser.query.filter_by(email=email).first()
        if admin and check_password_hash(admin.password, password):
            session['login_type'] = 'admin'
            login_user(admin)

            # 🚨 Bypass for default admin
            if admin.email == 'admin@admin.com':
                return jsonify(success=True, redirect=url_for('admin_blueprint.dashboard')), 200

            # 🔐 2FA already setup → prompt for code
            if admin.totp_secret:
                return jsonify(success=True, redirect=url_for('admin_blueprint.otp_verify')), 200

            # ⚙️ No 2FA setup → redirect to setup flow
            return jsonify(success=True, redirect=url_for('admin_blueprint.setup_2fa')), 200

        # 👤 Fallback to regular user
        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            return jsonify(success=False, error="Invalid email or password."), 401

        session['login_type'] = 'user'
        login_user(user)
        return jsonify(success=True, redirect=url_for('users_blueprint.dashboard')), 200

    except Exception as e:
        print(f"Login error: {e}")
        traceback.print_exc()  # This prints the full traceback nicely
        return jsonify(success=False, error="Internal server error. Please try again later."), 500


@auth_blueprint.route('/logout')
def logout():
    logout_user()
    session.clear()
    return redirect(url_for('auth_blueprint.login'))  # or admin login depending on who is logging out


@auth_blueprint.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        if current_user.is_authenticated:
            return redirect(url_for('users_blueprint.dashboard'))
        return render_template('register.html')

    # POST: handle register via JS (expecting JSON)
    try:
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()
        confirm = request.form.get('confirm_password', '').strip()

        if not email or not password or not confirm:
            return jsonify(success=False, error="All fields are required."), 400

        if password != confirm:
            return jsonify(success=False, error="Passwords do not match."), 401

        if User.query.filter_by(email=email).first():
            return jsonify(success=False, error="Email is already registered."), 429

        user = User(email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        login_user(user)

        return jsonify(success=True, redirect=url_for('users_blueprint.dashboard')), 200

    except Exception:
        return jsonify(success=False, error="Internal server error. Please try again later."), 500
