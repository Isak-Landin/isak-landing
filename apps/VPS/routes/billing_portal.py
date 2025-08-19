# VPS/routes/billing_portal.py

import os
import stripe
from flask import redirect, url_for
from flask_login import login_required, current_user
from extensions import db
from apps.VPS.vps import vps_blueprint

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


@vps_blueprint.route("/billing-portal", methods=["GET"])
@login_required
def vps_billing_portal():
    """
    Redirect the logged-in user to Stripe's hosted Billing Portal.
    Ensures the user has a Stripe Customer ID; creates one if missing.
    """
    # Ensure the user has a Stripe Customer
    if not current_user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            metadata={"user_id": current_user.id}
        )
        current_user.stripe_customer_id = customer.id
        db.session.commit()

    # Where Stripe should send the user back after managing billing
    return_url = url_for("vps_blueprint.vps_list_page", _external=True)

    session = stripe.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url=return_url
    )
    return redirect(session.url, code=303)
