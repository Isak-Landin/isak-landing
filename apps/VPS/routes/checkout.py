# VPS/routes/checkout.py

from flask import request, jsonify, url_for
import stripe
import os
from apps.VPS.vps import vps_blueprint
from apps.VPS.stripe.catalog import get_price_id
from apps.VPS.models import VPSPlan, VpsSubscription
from flask_login import current_user, login_required
from extensions import db

# Set Stripe API key from env
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


@vps_blueprint.route("/checkout", methods=["POST"])
@login_required
def vps_checkout():
    """
    Create a Stripe Checkout Session for the selected plan & interval.
    Expects JSON: {"plan_code": "...", "interval": "month"|"year"}
    """
    data = request.get_json(silent=True) or {}
    plan_code = data.get("plan_code")
    interval = (data.get("interval") or "").lower()

    if not plan_code or interval not in ("month", "year"):
        return jsonify({"ok": False, "error": "Missing or invalid plan_code/interval"}), 400

    # Ensure plan exists and is active
    plan = VPSPlan.query.filter_by(plan_code=plan_code, is_active=True).first()
    if not plan:
        return jsonify({"ok": False, "error": f"Plan '{plan_code}' not found"}), 404

    try:
        price_id = get_price_id(plan_code, interval)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

    # Ensure user has a Stripe customer
    if not current_user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            metadata={"user_id": current_user.id}
        )
        current_user.stripe_customer_id = customer.id
        db.session.commit()

    # Build success/cancel URLs
    success_url = url_for("vps_blueprint.vps_success", _external=True)
    cancel_url = url_for("vps_blueprint.vps_cancel", _external=True)

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card", "sepa_debit", "bancontact", "ideal", "sofort"],
            line_items=[{"price": price_id, "quantity": 1}],
            customer=current_user.stripe_customer_id,
            success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=cancel_url,
            subscription_data={
                "metadata": {
                    "user_id": current_user.id,
                    "plan_code": plan_code,
                    "interval": interval
                }
            }
        )
    except Exception as e:
        return jsonify({"ok": False, "error": f"Stripe error: {str(e)}"}), 500

    return jsonify({"ok": True, "checkout_url": session.url})
