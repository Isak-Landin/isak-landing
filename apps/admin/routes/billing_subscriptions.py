# apps/admin/routes/billing_subscriptions.py
from flask import request, render_template, abort
from flask_login import login_required, current_user
from sqlalchemy import or_

from extensions import db
from apps.admin.admin import admin_blueprint
from apps.VPS.models import BillingRecord
from apps.Users.models import User
from decorators import admin_required, admin_2fa_required


@admin_blueprint.route("/billing/subscriptions", methods=["GET"])
@login_required
@admin_required
@admin_2fa_required
def admin_billing_subscriptions():
    """
    Billing view: ALL subscriptions across users (from BillingRecord).
    Filters: q, mode=all|live|test, status, page/per
    """
    q_text = (request.args.get("q") or "").strip()
    mode = (request.args.get("mode") or "all").lower()
    status = (request.args.get("status") or "").strip().lower()
    page = max(int(request.args.get("page", 1)), 1)
    per = min(max(int(request.args.get("per", 25)), 1), 200)

    q = (
        db.session.query(BillingRecord, User)
        .join(User, BillingRecord.user_id == User.id)
        .filter(BillingRecord.type == "subscription")
        .order_by(BillingRecord.created_at.desc())
    )

    if mode == "live":
        q = q.filter(BillingRecord.livemode.is_(True))
    elif mode == "test":
        q = q.filter(BillingRecord.livemode.is_(False))

    if status:
        q = q.filter(BillingRecord.status.ilike(status + "%"))

    if q_text:
        like = f"%{q_text}%"
        q = q.filter(
            or_(
                User.email.ilike(like),
                BillingRecord.subscription_id.ilike(like),
                BillingRecord.stripe_id.ilike(like),
                BillingRecord.description.ilike(like),
            )
        )

    items = q.paginate(page=page, per_page=per, error_out=False)

    return render_template(
        "admin/billing_subscriptions.html",
        items=items,
        mode=mode,
        q=q_text,
        status=status,
        page=page,
        per=per,
    )
