# VPS/routes/cancel.py

from flask import render_template
from apps.VPS.vps import vps_blueprint

from extensions import csrf

@vps_blueprint.route("/cancel", methods=["GET"])
@csrf.exempt
def vps_cancel():
    return render_template("vps/cancel.html")
