from flask import render_template, abort
from flask_login import login_required, current_user

from apps.VPS.vps import vps_blueprint
from apps.VPS.models import VPS


@vps_blueprint.get("/instance/<int:vps_id>")
@login_required
def vps_detail(vps_id: int):
    """User-facing VPS detail. Only owner can view."""
    vps = VPS.query.get_or_404(vps_id)
    if vps.user_id != current_user.id:
        # Hide existence from other users
        abort(404)
    return render_template("vps/detail.html", vps=vps)