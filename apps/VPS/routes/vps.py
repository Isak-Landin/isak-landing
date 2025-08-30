# at top with other imports
import os
from flask import jsonify, request, abort, Blueprint
from apps.VPS.stripe.catalog import get_price_map, bust_cache


vps_blueprint = Blueprint("vps_blueprint", __name__, url_prefix="/vps")


# DEV: resolve all plan lookup keys to Stripe Price IDs
@vps_blueprint.route("/dev/price-map", methods=["GET"])
def vps_dev_price_map():
    # Simple guard so this doesn’t run in production by mistake
    if os.getenv("FLASK_ENV") not in {"development", "docker"} and not os.getenv("DEBUG"):
        abort(404)

    if request.args.get("bust") == "1":
        bust_cache()

    try:
        price_map = get_price_map(ttl_seconds=60)  # resolves lookup keys → price_...
        return jsonify({"ok": True, "price_map": price_map})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


import apps.VPS.routes
