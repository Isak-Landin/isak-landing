# VPS/routes/success.py

import stripe
from flask import request, render_template, redirect, url_for, jsonify
from flask_login import current_user
from apps.VPS.vps import vps_blueprint
from apps.VPS.models import BillingRecord

from extensions import csrf


@vps_blueprint.route("/success", methods=["GET"])
@csrf.exempt
def vps_success():
    """
    Show real success only if the initial invoice is actually paid.
    Otherwise show a short 'processing' screen that polls, or a failure page.
    """
    session_id = request.args.get("session_id")
    if not session_id:
        # No session to inspect → bounce back to plans
        return redirect(url_for("vps_blueprint.vps_list_page"))

    # Retrieve session with expansions so we can decide immediately when possible
    try:
        sess = stripe.checkout.Session.retrieve(
            session_id,
            expand=[
                "payment_intent",
                "subscription.latest_invoice.payment_intent",
                "invoice.payment_intent",
            ],
        )
    except Exception:
        # If Stripe fetch fails momentarily, treat as pending
        return render_template("vps/success_pending.html", session_id=session_id, invoice_id=None)

    state, invoice_id = _decide_checkout_state(sess)

    if state == "paid":
        return render_template("vps/success.html", session_id=session_id)
    if state == "failed":
        return render_template("vps/cancel.html", reason="Initial payment failed. No charge was completed.")
    # pending
    return render_template("vps/success_pending.html", session_id=session_id, invoice_id=invoice_id)


@vps_blueprint.route("/checkout-status", methods=["GET"])
@csrf.exempt
def checkout_status():
    """
    Lightweight JSON endpoint for the pending page to poll.
    Returns: {"state": "paid" | "pending" | "failed"}
    Prefers our DB (webhook-processed) and falls back to live Stripe state.
    """
    session_id = request.args.get("session_id")
    if not session_id:
        return jsonify({"state": "failed", "reason": "missing_session"}), 400

    try:
        sess = stripe.checkout.Session.retrieve(
            session_id,
            expand=[
                "payment_intent",
                "subscription.latest_invoice.payment_intent",
                "invoice.payment_intent",
            ],
        )
    except Exception:
        return jsonify({"state": "pending"})

    state, _ = _decide_checkout_state(sess)
    return jsonify({"state": state})


# ---------- helpers ----------

def _decide_checkout_state(session_obj):
    """
    Decide ('paid' | 'pending' | 'failed', invoice_id|None)
    Uses DB (BillingRecord) first when we have an invoice id; otherwise Stripe object.
    """
    mode = session_obj.get("mode")
    if mode == "payment":
        # Not your main path, but covered
        ps = session_obj.get("payment_status")
        if ps == "paid":
            return "paid", session_obj.get("invoice")
        return ("failed" if ps == "unpaid" else "pending"), session_obj.get("invoice")

    if mode == "subscription":
        sub = session_obj.get("subscription")
        inv = None

        if isinstance(sub, dict):
            inv = sub.get("latest_invoice")
        elif isinstance(sub, str) and sub:
            try:
                sub = stripe.Subscription.retrieve(sub, expand=["latest_invoice.payment_intent"])
                inv = sub.get("latest_invoice")
            except Exception:
                inv = None

        invoice_id = inv.get("id") if isinstance(inv, dict) else None

        # 1) If our DB already has it marked paid (webhook processed), trust that
        if invoice_id and current_user.is_authenticated:
            br = BillingRecord.query.filter_by(user_id=current_user.id, invoice_id=invoice_id).first()
            if br and (br.status or "").lower() == "paid":
                return "paid", invoice_id

        # 2) Otherwise, decide from Stripe object live
        if isinstance(inv, dict):
            # Paid via invoice.status or PI status
            pi = inv.get("payment_intent") or {}
            if inv.get("status") == "paid" or (isinstance(pi, dict) and pi.get("status") == "succeeded"):
                return "paid", invoice_id

            pi_status = (pi.get("status") if isinstance(pi, dict) else None)
            if pi_status in ("requires_payment_method", "requires_action", "processing", "requires_confirmation"):
                return "pending", invoice_id

            # Not paid and not clearly pending → failed
            return "failed", invoice_id

        # No invoice yet (rare timing) → pending
        return "pending", invoice_id

    # Unknown mode → safest to fail
    return "failed", None
