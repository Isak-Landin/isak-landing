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

    otp_uri = totp.provisioning_uri(name=current_user.email, issuer_name="Isaklandin Admin")
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


@admin_blueprint.route('/api/dashboard-data')
@login_required
@admin_required
def get_admin_dashboard_data():
    users = User.query.all()
    vps_list = VPS.query.all()

    user_data = [{
        "email": user.email,
        "vps_count": len(user.vps)
    } for user in users]

    vps_data = [{
        "hostname": vps.hostname,
        "ip_address": vps.ip_address,
        "os": vps.os,
        "cpu_cores": vps.cpu_cores,
        "ram_mb": vps.ram_mb,
        "owner_email": vps.user.email if vps.user else "Unknown"
    } for vps in vps_list]

    return jsonify({"users": user_data, "vps": vps_data})


