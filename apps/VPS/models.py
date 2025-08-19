# VPS/models.py

from extensions import db
from datetime import datetime


class VPS(db.Model):
    __tablename__ = 'vps'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    # NEW: 1:1 link to the billing record (subscription)
    subscription_id = db.Column(
        db.Integer,
        db.ForeignKey('vps_subscriptions.id', ondelete='SET NULL'),
        unique=True,            # enforce one VPS per subscription (MVP rule)
        nullable=True,
        index=True
    )

    # Runtime / identity
    hostname = db.Column(db.String(64), nullable=False)
    ip_address = db.Column(db.String(45), nullable=False)  # IPv4/IPv6 safe
    status = db.Column(db.String(20), default='active')    # e.g. active, suspended, terminated
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Optional extras
    os = db.Column(db.String(64))                          # e.g. 'Ubuntu 24.04'
    location = db.Column(db.String(64))                    # e.g. 'DE - Frankfurt'
    cpu_cores = db.Column(db.Integer)
    ram_mb = db.Column(db.Integer)
    disk_gb = db.Column(db.Integer)
    is_ready = db.Column(db.Boolean, default=False)

    # Provider / provisioning
    provider = db.Column(db.String(40), nullable=False, default='hostup')
    provider_order_id = db.Column(db.String(120))
    provider_vm_id = db.Column(db.String(120))
    region = db.Column(db.String(60))
    image = db.Column(db.String(120))
    ssh_key_id = db.Column(db.String(120))
    provisioning_status = db.Column(db.String(20), nullable=False, default='pending')
    notes = db.Column(db.String(1000))

    # Relationships
    user = db.relationship('User', backref=db.backref('vps_list', lazy=True))
    subscription = db.relationship('VpsSubscription', backref=db.backref('vps', uselist=False))


class VPSPlan(db.Model):
    __tablename__ = 'vps_plan'

    id = db.Column(db.Integer, primary_key=True)

    # Human branding
    name = db.Column(db.String(64), nullable=False, unique=True)  # e.g. 'Nebula One'
    plan_code = db.Column(db.String(80), nullable=False, unique=True)  # slug e.g. 'nebula_one'

    # Specs (aligned with Hostup)
    cpu_cores = db.Column(db.Integer, nullable=False)
    ram_mb = db.Column(db.Integer, nullable=False)
    disk_gb = db.Column(db.Integer, nullable=False)
    bandwidth_tb = db.Column(db.Integer, nullable=False, default=0)

    # Pricing (plan-level legacy; actual price captured on subscription later)
    price_per_month = db.Column(db.Numeric(10, 2), nullable=True)

    # Descriptions / flags
    description = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # Stripe (Phase 0 lookup keys; safer than hardcoding price IDs)
    stripe_lookup_key_monthly = db.Column(db.String(120), unique=True, nullable=False)
    stripe_lookup_key_yearly = db.Column(db.String(120), unique=True, nullable=False)

    # Backwards-compat with old code (kept but not authoritative)
    stripe_price_id = db.Column(db.String(128))

    # Provider mapping
    provider = db.Column(db.String(40), nullable=False, default='hostup')
    provider_plan_code = db.Column(db.String(120))  # Hostup SKU/slug if/when needed
    default_region = db.Column(db.String(60))

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<VPSPlan {self.name} - {self.cpu_cores} cores, {self.ram_mb}MB RAM, {self.disk_gb}GB Disk>"


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


class VpsSubscription(db.Model):
    __tablename__ = 'vps_subscriptions'

    id = db.Column(db.Integer, primary_key=True)

    # Relationships
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    plan_id = db.Column(db.Integer, db.ForeignKey('vps_plan.id'), nullable=False)

    # Stripe identifiers
    stripe_customer_id = db.Column(db.String(120), nullable=False)
    stripe_subscription_id = db.Column(db.String(120), unique=True, index=True)
    stripe_price_id = db.Column(db.String(120), index=True)  # actual Stripe price ID used
    price_lookup_key = db.Column(db.String(120), index=True)  # matches VPSPlan.lookup_key at purchase time

    # Billing snapshot
    interval = db.Column(db.String(10), nullable=False)  # 'month' or 'year'
    currency = db.Column(db.String(10), nullable=False, default='eur')
    unit_amount = db.Column(db.Numeric(10, 2), nullable=True)  # price per interval at purchase
    tax_inclusive = db.Column(db.Boolean, nullable=False, default=True)

    # Lifecycle
    status = db.Column(db.String(30), nullable=False, default='incomplete')
    cancel_at_period_end = db.Column(db.Boolean, nullable=False, default=False)
    billing_cycle_anchor = db.Column(db.DateTime, nullable=True)
    current_period_start = db.Column(db.DateTime, nullable=True)
    current_period_end = db.Column(db.DateTime, nullable=True)
    canceled_at = db.Column(db.DateTime, nullable=True)
    ended_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships backrefs
    user = db.relationship('User', backref=db.backref('vps_subscriptions', lazy=True))
    plan = db.relationship('VPSPlan')

    def __repr__(self):
        return f"<VpsSubscription user_id={self.user_id} plan_id={self.plan_id} status={self.status}>"


class StripeEventLog(db.Model):
    __tablename__ = 'stripe_event_logs'

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(120), unique=True, nullable=False)  # Stripe's event ID
    type = db.Column(db.String(120), nullable=False)  # e.g. 'checkout.session.completed'
    payload = db.Column(db.JSON, nullable=False)  # raw JSON payload (verified body)
    valid_sig = db.Column(db.Boolean, nullable=False, default=False)  # signature verified
    processed = db.Column(db.Boolean, nullable=False, default=False)  # whether our app handled it
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    processed_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f"<StripeEventLog event_id={self.event_id} type={self.type} processed={self.processed}>"