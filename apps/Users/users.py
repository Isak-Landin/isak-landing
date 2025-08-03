from flask import Blueprint, render_template, request, redirect, url_for
from flask_login import login_required, current_user
from apps.VPS.models import VPS


blueprint = Blueprint('users_blueprint', __name__, url_prefix='/users')


@blueprint.route('/dashboard', methods=['GET', 'POST'])
@login_required
def dashboard():
    vps_list = VPS.query.filter_by(user_id=current_user.id).all()
    return render_template('dashboard.html', user=current_user, vps=vps_list)
