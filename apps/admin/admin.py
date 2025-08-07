import pyotp
import qrcode
import io
import base64
from flask import Blueprint, render_template, request, session, redirect, url_for
from flask_login import current_user, login_required
from apps.admin.models import AdminUser
from apps.Users.models import User
from apps.VPS.models import VPS
from extensions import db

from decorators import admin_2fa_required, admin_required

admin_blueprint = Blueprint("admin", __name__, url_prefix="/admin")


@admin_blueprint.route('/setup-2fa', methods=['GET', 'POST'])
@login_required
@admin_required
def setup_2fa():
    # Ensure the current user is actually an admin
    if not isinstance(current_user, AdminUser):
        return redirect(url_for('users_blueprint.dashboard'))

    # Generate a TOTP secret if it doesn't exist yet
    if not current_user.totp_secret:
        current_user.totp_secret = pyotp.random_base32()
        db.session.commit()

    totp = pyotp.TOTP(current_user.totp_secret)

    # Generate provisioning URI for Google/MS Authenticator
    otp_uri = totp.provisioning_uri(name=current_user.email, issuer_name="Isaklandin Admin")

    # Generate base64-encoded QR code
    img = qrcode.make(otp_uri)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    if request.method == 'POST':
        code = request.form.get('code', '').strip()
        if totp.verify(code):
            session['admin_2fa_passed'] = True
            return redirect(url_for('admin.dashboard'))
        else:
            return render_template('admin/setup_2fa.html', qr_code=qr_b64, error="Invalid code")

    return render_template('admin/setup_2fa.html', qr_code=qr_b64)


@admin_blueprint.route('/2fa', methods=['GET', 'POST'])
@login_required
@admin_required
def otp_verify():
    if not isinstance(current_user, AdminUser):
        return redirect(url_for('users_blueprint.dashboard'))

    if not current_user.totp_secret:
        return redirect(url_for('admin.setup_2fa'))

    totp = pyotp.TOTP(current_user.totp_secret)

    if request.method == 'POST':
        code = request.form.get('code', '').strip()
        if totp.verify(code):
            session['admin_2fa_passed'] = True
            return redirect(url_for('admin.dashboard'))
        return render_template('admin/verify_2fa.html', error="Invalid 2FA code.")

    return render_template('admin/verify_2fa.html')


@admin_blueprint.route('/dashboard')
@login_required
@admin_required
@admin_2fa_required
def dashboard():
    users = User.query.all()
    vps_list = VPS.query.all()  # Adjust if your model is named differently
    return render_template('admin/dashboard.html', users=users, vps_list=vps_list)

