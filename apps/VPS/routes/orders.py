from flask import render_template, request
from flask_login import login_required, current_user
from apps.VPS.vps import vps_blueprint
from apps.VPS.models import BillingRecord


@vps_blueprint.route('/orders', methods=['GET'])
@login_required
def orders_page():
    mode = request.args.get('mode', 'all')
    q = BillingRecord.query.filter_by(user_id=current_user.id)
    if mode == 'live':
        q = q.filter_by(livemode=True)
    elif mode == 'test':
        q = q.filter_by(livemode=False)
    records = q.order_by(BillingRecord.created_at.desc()).all()
    return render_template('order_history.html', records=records, mode=mode)
