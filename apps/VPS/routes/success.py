# VPS/routes/success.py

from flask import request, render_template
from apps.VPS.vps import vps_blueprint

@vps_blueprint.route("/success", methods=["GET"])
def vps_success():
    session_id = request.args.get("session_id")
    return render_template("vps/success.html", session_id=session_id)
