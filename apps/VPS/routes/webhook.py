import os, json
import stripe
from flask import request, jsonify
from datetime import datetime
from extensions import db
from apps.VPS.vps import vps_blueprint
from apps.VPS.models import VpsSubscription, StripeEventLog, VPSPlan, VPS

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")  # set this in your env

def _log_event(event, valid_sig: bool):
    # Idempotent insert (ignore if already logged)
    existing = StripeEventLog.query.filter_by(event_id=event["id"]).first()
    if existing:
        return existing, False
    row = StripeEventLog(
        event_id=event["id"],
        type=event["type"],
        payload=event,          # SQLAlchemy will json-serialize
        valid_sig=valid_sig,
        processed=False,
        created_at=datetime.utcnow(),
    )
    db.session.add(row)
    db.session.commit()
    return row, True


def _upsert_subscription_from_stripe(stripe_sub):
    """
    Create/update VpsSubscription row from a stripe.Subscription object.
    We expect metadata {'user_id','plan_code','interval'} set during checkout.
    """
    sub_id = stripe_sub["id"]
    status = stripe_sub["status"]                          # trialing, active, past_due, canceled, unpaid, incomplete...
    customer_id = stripe_sub["customer"]
    price_obj = stripe_sub["items"]["data"][0]["price"]    # single-item MVP
    price_id = price_obj["id"]
    currency = price_obj["currency"].lower()
    unit_amount = (price_obj.get("unit_amount") or 0) / 100.0
    interval = price_obj["recurring"]["interval"]          # month|year

    md = stripe_sub.get("metadata") or {}
    user_id = md.get("user_id")
    plan_code = md.get("plan_code")
    # interval from price is source of truth, but keep metadata if present
    interval_meta = (md.get("interval") or interval).lower()

    # Resolve plan
    plan = VPSPlan.query.filter_by(plan_code=plan_code, is_active=True).first() if plan_code else None

    # Find existing row by stripe_subscription_id (preferred) or create
    row = VpsSubscription.query.filter_by(stripe_subscription_id=sub_id).first()
    if not row:
        row = VpsSubscription(
            user_id=int(user_id) if user_id else None,
            plan_id=plan.id if plan else None,
            stripe_customer_id=customer_id,
            stripe_subscription_id=sub_id,
            price_lookup_key=None,  # optional; we store for debugging during checkout
            interval=interval_meta,
            currency=currency,
            unit_amount=unit_amount,
            tax_inclusive=True,
            status=status,
            cancel_at_period_end=stripe_sub.get("cancel_at_period_end", False),
            billing_cycle_anchor=datetime.utcfromtimestamp(stripe_sub["billing_cycle_anchor"]) if stripe_sub.get("billing_cycle_anchor") else None,
            current_period_start=datetime.utcfromtimestamp(stripe_sub["current_period_start"]) if stripe_sub.get("current_period_start") else None,
            current_period_end=datetime.utcfromtimestamp(stripe_sub["current_period_end"]) if stripe_sub.get("current_period_end") else None,
            created_at=datetime.utcnow(),
        )
        db.session.add(row)

    # Update snapshot fields
    row.user_id = row.user_id or (int(user_id) if user_id else None)
    row.plan_id = row.plan_id or (plan.id if plan else None)
    row.stripe_customer_id = customer_id
    row.stripe_subscription_id = sub_id
    row.stripe_price_id = price_id
    row.interval = interval
    row.currency = currency
    row.unit_amount = unit_amount
    row.status = status
    row.cancel_at_period_end = stripe_sub.get("cancel_at_period_end", False)
    row.billing_cycle_anchor = datetime.utcfromtimestamp(stripe_sub["billing_cycle_anchor"]) if stripe_sub.get("billing_cycle_anchor") else row.billing_cycle_anchor
    row.current_period_start = datetime.utcfromtimestamp(stripe_sub["current_period_start"]) if stripe_sub.get("current_period_start") else row.current_period_start
    row.current_period_end = datetime.utcfromtimestamp(stripe_sub["current_period_end"]) if stripe_sub.get("current_period_end") else row.current_period_end
    row.updated_at = datetime.utcnow()

    db.session.commit()
    return row

@vps_blueprint.route("/webhook", methods=["POST"])
def vps_webhook():
    # 1) Read raw body and header
    payload = request.get_data(as_text=False)
    sig_header = request.headers.get("Stripe-Signature", "")

    # 2) Verify signature if secret is configured
    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(
                payload=payload,
                sig_header=sig_header,
                secret=STRIPE_WEBHOOK_SECRET
            )
            valid_sig = True
        else:
            # In dev you can omit the secret (not recommended for prod)
            event = json.loads(payload.decode("utf-8"))
            valid_sig = False
    except Exception as e:
        # signature invalid or bad payload
        return jsonify({"ok": False, "error": f"Webhook verification failed: {e}"}), 400

    # 3) Idempotent log
    row, is_new = _log_event(event, valid_sig)
    if not is_new and row.processed:
        return jsonify({"ok": True, "idempotent": True}), 200

    # 4) Handle selected event types
    etype = event["type"]
    try:
        if etype == "checkout.session.completed":
            # Retrieve the subscription to populate DB
            session = event["data"]["object"]
            sub_id = session.get("subscription")
            if sub_id:
                sub = stripe.Subscription.retrieve(sub_id, expand=["items.data.price.product"])
                _upsert_subscription_from_stripe(sub)

        elif etype in ("customer.subscription.created",
                       "customer.subscription.updated",
                       "customer.subscription.deleted"):
            sub = event["data"]["object"]
            # If event payload is not fully expanded, retrieve to normalize
            if isinstance(sub, dict) and "items" in sub and "data" in sub["items"] and sub["items"]["data"]:
                norm = sub
            else:
                norm = stripe.Subscription.retrieve(sub["id"], expand=["items.data.price.product"])
            _upsert_subscription_from_stripe(norm)

        elif etype in ("invoice.paid", "invoice.payment_succeeded"):
            # Optional: could mark subscription ACTIVE if relevant
            pass

        elif etype in ("invoice.payment_failed", "customer.subscription.paused"):
            # Optional: could flag as past_due or suspended
            pass

        # Mark processed
        row.processed = True
        row.processed_at = datetime.utcnow()
        db.session.commit()

    except Exception as e:
        # Keep the log row but don’t mark processed
        db.session.rollback()
        return jsonify({"ok": False, "error": str(e)}), 500

    return jsonify({"ok": True})
