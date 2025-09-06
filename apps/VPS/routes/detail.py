# apps/VPS/routes/detail.py
from flask import render_template, abort
from flask_login import login_required, current_user

from apps.VPS.models import VPS
from apps.VPS.vps import vps_blueprint


@vps_blueprint.route("/vps/<int:vps_id>", methods=["GET"])
@login_required
def vps_detail(vps_id: int):
    """
    User-facing VPS detail page.
    Guard: user can only view their own VPS.
    """
    vps = VPS.query.get_or_404(vps_id)
    if vps.user_id != current_user.id:
        # Hide existence of others' VPS
        abort(404)

    return render_template("vps/detail.html", vps=vps)
