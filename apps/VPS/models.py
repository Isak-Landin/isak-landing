# apps/VPS/models.py
# Secure for python -3.9
from __future__ import annotations

import re
import random
import secrets
from typing import Optional
from datetime import datetime

from extensions import db

# JSON type (Postgres JSONB if available, otherwise generic JSON)
try:
    from sqlalchemy.dialects.postgresql import JSONB as JSONType  # type: ignore
except Exception:  # pragma: no cover
    JSONType = db.JSON  # fallback for non-Postgres


# -----------------------------
# Small utilities (optional use)
# -----------------------------
def _slugify(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s


def _short_user_token(user) -> str:
    """
    Derive a short, readable token from the user; fallback to random.
    Prefers first/last name; falls back to email localpart; trims to 12 chars.
    """
    if not user:
        return secrets.token_hex(2)
    first = getattr(user, "first_name", "") or ""
    last  = getattr(user, "last_name", "") or ""
    if first or last:
        token = "-".join([p for p in (first, last) if p])
    else:
        token = (getattr(user, "email", "") or "").split("@", 1)[0]
    token = _slugify(token)[:12] or secrets.token_hex(2)
    return token


# ======================
#   BillingRecord
# ======================
class BillingRecord(db.Model):
    __tablename__ = "billing_records"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    stripe_customer_id = db.Column(db.String(120), nullable=False, index=True)

    # What this row represents
    type = db.Column(db.String(40), nullable=False)                  # 'invoice' | 'checkout_session' | 'subscription'
    stripe_id = db.Column(db.String(120), unique=True, nullable=False)  # invoice.id / cs.id / sub.id

    # Optional foreign keys for convenience
    invoice_id = db.Column(db.String(120), index=True)
    subscription_id = db.Column(db.String(120), index=True)
    payment_intent_id = db.Column(db.String(120), index=True)

    # Money snapshot (minor units)
    amount_cents = db.Column(db.Integer)
    currency = db.Column(db.String(10))

    # Period (for invoices)
    period_start = db.Column(db.DateTime)
    period_end = db.Column(db.DateTime)

    # Status / mode
    status = db.Column(db.String(32))
    livemode = db.Column(db.Boolean, default=False, index=True)

    # Helpful links/labels
    description = db.Column(db.String(255))
    hosted_invoice_url = db.Column(db.String(512))
    invoice_pdf = db.Column(db.String(512))

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Raw snapshot
    data = db.Column(JSONType)

    user = db.relationship("User", backref=db.backref("billing_records", lazy=True))


# ======================
#   VPS
# ======================
class VPS(db.Model):
    __tablename__ = "vps"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    # One VPS per subscription (MVP rule)
    subscription_id = db.Column(
        db.Integer,
        db.ForeignKey("vps_subscriptions.id", ondelete="SET NULL"),
        unique=True,
        nullable=True,
        index=True,
    )

    # Identity / runtime
    hostname = db.Column(db.String(64), nullable=False)         # REQUIRED (no auto-assign in the model)
    ip_address = db.Column(db.String(45), nullable=False)       # set 'pending' if unknown
    status = db.Column(db.String(20), nullable=False, default="active")  # e.g. active, pending, suspended, etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Specs
    os = db.Column(db.String(64))            # e.g. 'Ubuntu 24.04'
    location = db.Column(db.String(64))      # e.g. 'DE - Frankfurt'
    cpu_cores = db.Column(db.Integer)
    ram_mb = db.Column(db.Integer)
    disk_gb = db.Column(db.Integer)
    is_ready = db.Column(db.Boolean, default=False)

    # Provider / provisioning
    provider = db.Column(db.String(40), nullable=False, default="hostup")
    provider_order_id = db.Column(db.String(120))
    provider_vm_id = db.Column(db.String(120))
    region = db.Column(db.String(60))
    image = db.Column(db.String(120))
    ssh_key_id = db.Column(db.String(120))
    provisioning_status = db.Column(db.String(20), nullable=False, default="pending")
    notes = db.Column(db.String(1000))

    # Relationships
    user = db.relationship("User", backref=db.backref("vps_list", lazy=True))
    subscription = db.relationship("VpsSubscription", backref=db.backref("vps", uselist=False))

    # ------- Optional helpers (not auto-called) -------
    _HNX_ADJ = ["swift", "nova", "orbit", "steady", "brisk", "aurora", "ember", "granite", "lumen", "vivid"]
    _HNX_NOUN = ["atlas", "phoenix", "comet", "lynx", "vertex", "nebula", "falcon", "quartz", "drift", "echo"]

    @classmethod
    def generate_hostname(
        cls,
        user=None,
        region: Optional[str] = None,
        plan_name: Optional[str] = None,
        prefix: str = "hnx",
    ) -> str:
        """
        Random, readable suggestion (not auto-applied): hnx-eu-nova-lynx-7f3a
        """
        reg = _slugify((region or "")[:5])
        _ = _slugify((plan_name or "")[:8])  # plan slug (unused in this random variant)

        def _base() -> str:
            a = random.choice(cls._HNX_ADJ)
            n = random.choice(cls._HNX_NOUN)
            parts = [prefix]
            if reg:
                parts.append(reg)
            parts.extend([a, n])
            return "-".join([p for p in parts if p])

        # keep length reasonable
        for _i in range(24):
            token = secrets.token_hex(2)
            candidate = f"{_base()}-{token}"
            if len(candidate) > 32:
                candidate = candidate[:32].rstrip("-")
            if not cls.query.filter_by(hostname=candidate).first():
                return candidate
        return f"{prefix}-{secrets.token_hex(3)}"

    @staticmethod
    def suggest_hostname(*, user=None, plan=None, region: Optional[str] = None, session=None) -> str:
        """
        Human-friendly suggestion based on plan + user. Not auto-applied.
        Examples: 'nebula-one-jacob', 'nebula-one-jacob-2'
        """
        q = session or db.session
        plan_name = getattr(plan, "name", None) or getattr(plan, "plan_name", None) or "vps"
        plan_slug = _slugify(plan_name)
        if plan_slug.endswith("-vps"):
            plan_slug = plan_slug[:-4] or "vps"
        user_tok = _short_user_token(user)
        reg = _slugify(region or getattr(plan, "region", "") or "")
        base = f"{plan_slug}-{user_tok}" + (f"-{reg}" if reg else "")
        base = base[:50] or "vps"

        if not q.query(VPS.id).filter_by(hostname=base).first():
            return base
        for i in range(2, 50):
            cand = f"{base}-{i}"
            if not q.query(VPS.id).filter_by(hostname=cand).first():
                return cand
        return f"{base}-{secrets.token_hex(2)}"

    def __repr__(self) -> str:  # pragma: no cover
        return f"<VPS id={self.id} hostname={self.hostname} user_id={self.user_id} status={self.status}>"


# ======================
#   VPSPlan
# ======================
class VPSPlan(db.Model):
    __tablename__ = "vps_plan"

    id = db.Column(db.Integer, primary_key=True)

    # Human branding
    name = db.Column(db.String(64), nullable=False, unique=True)        # e.g. 'Nebula One'
    plan_code = db.Column(db.String(80), nullable=False, unique=True)   # e.g. 'nebula_one'

    # Specs
    cpu_cores = db.Column(db.Integer, nullable=False)
    ram_mb = db.Column(db.Integer, nullable=False)
    disk_gb = db.Column(db.Integer, nullable=False)
    bandwidth_tb = db.Column(db.Integer, nullable=False, default=0)

    # Pricing (plan-level; snapshot lives on subscription)
    price_per_month = db.Column(db.Numeric(10, 2), nullable=True)

    # Descriptions / flags
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # Stripe lookup keys
    stripe_lookup_key_monthly = db.Column(db.String(120), unique=True, nullable=False)
    stripe_lookup_key_yearly = db.Column(db.String(120), unique=True, nullable=False)

    # Legacy
    stripe_price_id = db.Column(db.String(128))

    # Provider mapping
    provider = db.Column(db.String(40), nullable=False, default="hostup")
    provider_plan_code = db.Column(db.String(120))
    default_region = db.Column(db.String(60))

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<VPSPlan {self.name} {self.cpu_cores}c/{self.ram_mb}MB/{self.disk_gb}GB>"


# ======================
#   VpsOrder
# ======================
class VpsOrder(db.Model):
    __tablename__ = "vps_orders"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, index=True)
    plan_id = db.Column(db.String(50), nullable=False)
    price_cents = db.Column(db.Integer, nullable=False)
    currency = db.Column(db.String(10), nullable=False, default="eur")
    stripe_session_id = db.Column(db.String(255), index=True)
    status = db.Column(db.String(20), nullable=False, default="created")  # created|paid|failed|canceled
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ======================
#   VpsSubscription
# ======================
class VpsSubscription(db.Model):
    __tablename__ = "vps_subscriptions"

    id = db.Column(db.Integer, primary_key=True)

    # Relationships
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    plan_id = db.Column(db.Integer, db.ForeignKey("vps_plan.id"), nullable=False)

    # Stripe identifiers
    stripe_customer_id = db.Column(db.String(120), nullable=False)
    stripe_subscription_id = db.Column(db.String(120), unique=True, index=True)
    stripe_price_id = db.Column(db.String(120), index=True)      # actual Stripe price ID used
    price_lookup_key = db.Column(db.String(120), index=True)     # matches VPSPlan.lookup_key at purchase time

    # Billing snapshot
    interval = db.Column(db.String(10), nullable=False)          # 'month' or 'year'
    currency = db.Column(db.String(10), nullable=False, default="eur")
    unit_amount = db.Column(db.Numeric(10, 2), nullable=True)    # price per interval at purchase
    tax_inclusive = db.Column(db.Boolean, nullable=False, default=True)

    # Lifecycle
    status = db.Column(db.String(30), nullable=False, default="incomplete")
    cancel_at_period_end = db.Column(db.Boolean, nullable=False, default=False)
    billing_cycle_anchor = db.Column(db.DateTime, nullable=True)
    current_period_start = db.Column(db.DateTime, nullable=True)
    current_period_end = db.Column(db.DateTime, nullable=True)
    canceled_at = db.Column(db.DateTime, nullable=True)
    ended_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships backrefs
    user = db.relationship("User", backref=db.backref("vps_subscriptions", lazy=True))
    plan = db.relationship("VPSPlan")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<VpsSubscription user_id={self.user_id} plan_id={self.plan_id} status={self.status}>"


# ======================
#   StripeEventLog
# ======================
class StripeEventLog(db.Model):
    __tablename__ = "stripe_event_logs"

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(120), unique=True, nullable=False)  # Stripe's event ID
    type = db.Column(db.String(120), nullable=False)                   # e.g. 'checkout.session.completed'
    payload = db.Column(JSONType, nullable=False)                      # raw JSON payload (verified body)
    valid_sig = db.Column(db.Boolean, nullable=False, default=False)   # signature verified
    processed = db.Column(db.Boolean, nullable=False, default=False)   # whether our app handled it
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    processed_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover
        return f"<StripeEventLog event_id={self.event_id} type={self.type} processed={self.processed}>"
