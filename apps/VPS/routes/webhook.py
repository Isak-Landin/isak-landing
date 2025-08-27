# VPS/routes/webhook.py

import os, json
import stripe
from flask import request, jsonify
from datetime import datetime
from extensions import db
from apps.VPS.vps import vps_blueprint
from apps.VPS.models import VpsSubscription, StripeEventLog, VPSPlan, VPS
from apps.Users.models import User                # map customer -> user
from apps.VPS.models import BillingRecord         # new model


def _find_or_bind_user(customer_id: str | None,
                       client_reference_id: str | int | None = None,
                       subscription_obj: dict | None = None):
    """
    Resolve the local User for a Stripe customer. If it's the user's first purchase,
    bind stripe_customer_id to the user using either client_reference_id or subscription metadata.
    """
    user = None
    if customer_id:
        user = User.query.filter_by(stripe_customer_id=customer_id).first()

    # Fallback: subscription metadata.user_id or client_reference_id
    fallback_user_id = None
    if not user:
        md = (subscription_obj or {}).get("metadata") or {}
        if md.get("user_id"):
            try:
                fallback_user_id = int(md["user_id"])
            except Exception:
                pass
        if not fallback_user_id and client_reference_id:
            try:
                fallback_user_id = int(client_reference_id)
            except Exception:
                pass
        if fallback_user_id:
            user = User.query.get(fallback_user_id)
            if user and customer_id:
                # Bind customer to user for future events
                user.stripe_customer_id = customer_id
                db.session.add(user)
                db.session.commit()
    return user


def _find_user_by_customer(customer_id: str):
    if not customer_id:
        return None
    return User.query.filter_by(stripe_customer_id=customer_id).first()



def _upsert_invoice_record(inv: dict, livemode: bool):
    # Try to resolve via invoice.customer. If unknown, try retrieving the subscription once
    sub_obj = None
    if not _find_user_by_customer(inv.get('customer')):
        # Safe, single retrieval to get metadata.user_id
        try:
            if inv.get('subscription'):
                sub_obj = stripe.Subscription.retrieve(inv['subscription'], expand=["items.data.price.product"])
        except Exception:
            sub_obj = None

    user = _find_or_bind_user(
        inv.get('customer'),
        client_reference_id=None,
        subscription_obj=sub_obj
    )
    if not user:
        return None

    rec = BillingRecord.query.filter_by(stripe_id=inv['id']).first()
    if not rec:
        rec = BillingRecord(
            user_id=user.id,
            stripe_customer_id=inv['customer'],
            type='invoice',
            stripe_id=inv['id'],
        )
        db.session.add(rec)

    from datetime import datetime as _dt
    rec.invoice_id = inv.get('id')
    rec.subscription_id = inv.get('subscription')
    rec.payment_intent_id = inv.get('payment_intent')
    rec.amount_cents = inv.get('amount_paid') or inv.get('amount_due') or inv.get('amount_remaining')
    rec.currency = (inv.get('currency') or '').lower() or None
    rec.status = inv.get('status')
    rec.livemode = livemode
    rec.hosted_invoice_url = inv.get('hosted_invoice_url')
    rec.invoice_pdf = inv.get('invoice_pdf')

    # description/period from first line if present
    try:
        line0 = (inv.get('lines') or {}).get('data', [])[0]
        rec.description = line0.get('description') or inv.get('description')
        period = line0.get('period') or {}
        if period.get('start'): rec.period_start = _dt.utcfromtimestamp(period['start'])
        if period.get('end'):   rec.period_end   = _dt.utcfromtimestamp(period['end'])
    except Exception:
        rec.description = inv.get('description')

    # created_at from invoice if available (keeps order list stable)
    try:
        if inv.get('created'):
            rec.created_at = _dt.utcfromtimestamp(inv['created'])
    except Exception:
        pass

    rec.data = inv
    db.session.commit()
    return rec


def _upsert_checkout_session(sess: dict, livemode: bool):
    user = _find_or_bind_user(
        sess.get('customer'),
        client_reference_id=sess.get('client_reference_id'),
        subscription_obj=None
    )
    if not user:
        return None

    rec = BillingRecord.query.filter_by(stripe_id=sess['id']).first()
    if not rec:
        rec = BillingRecord(
            user_id=user.id,
            stripe_customer_id=sess.get('customer'),
            type='checkout_session',
            stripe_id=sess['id'],
        )
        db.session.add(rec)

    rec.subscription_id = sess.get('subscription')
    rec.payment_intent_id = sess.get('payment_intent')
    rec.amount_cents = sess.get('amount_total')  # can be None for subscriptions
    rec.currency = (sess.get('currency') or '').lower() or None
    rec.status = sess.get('status')
    rec.livemode = livemode
    rec.description = 'Checkout session'
    rec.data = sess
    db.session.commit()
    return rec

def _upsert_subscription_record(sub: dict, livemode: bool):
    """Keep a lightweight subscription record (informational in history)."""
    user = _find_user_by_customer(sub.get('customer'))
    if not user:
        return None

    rec = BillingRecord.query.filter_by(stripe_id=sub['id']).first()
    if not rec:
        rec = BillingRecord(
            user_id=user.id,
            stripe_customer_id=sub.get('customer'),
            type='subscription',
            stripe_id=sub['id'],
        )
        db.session.add(rec)

    rec.subscription_id = sub.get('id')
    rec.status = sub.get('status')
    rec.livemode = livemode
    # best-effort amount/currency from first item (invoice shows actual charges)
    try:
        price = sub['items']['data'][0]['price']
        rec.amount_cents = price.get('unit_amount')
        rec.currency = price.get('currency')
        rec.description = price.get('nickname') or price.get('id')
    except Exception:
        pass
    rec.data = sub
    db.session.commit()
    return rec


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
        return jsonify({"ok": False, "error": f"Webhook verification failed: {e}"}), 400

    # 3) Idempotent log
    row, is_new = _log_event(event, valid_sig)
    if not is_new and getattr(row, "processed", False):
        return jsonify({"ok": True, "idempotent": True}), 200

    # 4) Handle selected event types (now also persisting billing records)
    etype = event["type"]
    livemode = bool(event.get("livemode"))

    try:
        if etype == "checkout.session.completed":
            session = event["data"]["object"]
            _upsert_checkout_session(session, livemode)

            sub_id = session.get("subscription")
            if sub_id:
                sub = stripe.Subscription.retrieve(sub_id, expand=["items.data.price.product"])
                _upsert_subscription_from_stripe(sub)
                _upsert_subscription_record(sub, livemode)

        elif etype in ("customer.subscription.created", "customer.subscription.updated",
                       "customer.subscription.deleted"):
            sub_obj = event["data"]["object"]
            if not (isinstance(sub_obj, dict) and sub_obj.get("items", {}).get("data")):
                sub = stripe.Subscription.retrieve(sub_obj["id"], expand=["items.data.price.product"])
            else:
                sub = sub_obj
            _upsert_subscription_from_stripe(sub)
            _upsert_subscription_record(sub, livemode)

        elif etype in ("invoice.finalized", "invoice.payment_succeeded", "invoice.paid", "invoice.voided",
                       "invoice.marked_uncollectible"):
            inv = event["data"]["object"]
            _upsert_invoice_record(inv, livemode)


        elif etype in ("invoice.payment_failed", "customer.subscription.paused"):
            # Optional: flag subscription state or notify user
            pass

        # 5) Mark processed in the event log
        row.processed = True
        row.processed_at = datetime.utcnow()
        db.session.commit()

    except Exception as e:
        # Keep the log row but don’t mark processed
        db.session.rollback()
        return jsonify({"ok": False, "error": str(e)}), 500

    return jsonify({"ok": True}), 200

