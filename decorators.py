from functools import wraps
from flask import session, redirect, url_for
from flask_login import current_user
from apps.admin.models import AdminUser


def admin_2fa_required(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if not isinstance(current_user, AdminUser):
            return redirect(url_for('users_blueprint.dashboard'))

        # No 2FA activated → allow access
        if not current_user.totp_secret:
            return view_func(*args, **kwargs)

        # 2FA activated → require validation
        if not session.get('admin_2fa_passed'):
            return redirect(url_for('admin.otp_verify'))

        return view_func(*args, **kwargs)
    return wrapper


def admin_required(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        if not isinstance(current_user, AdminUser):
            return redirect(url_for('users_blueprint.dashboard'))
        return view_func(*args, **kwargs)
    return wrapper
