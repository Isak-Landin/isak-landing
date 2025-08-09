# apps/vps/seed.py
from extensions import db
from apps.VPS.models import VPSPlan
from apps.VPS.vps_catalog import VPS_PLANS


def seed_vps_plans():
    """
    Seed the VPSPlan table from vps_catalog.VPS_PLANS.
    Idempotent: updates existing plans by plan_code, inserts missing ones.
    """
    for plan_data in VPS_PLANS:
        existing = VPSPlan.query.filter_by(plan_code=plan_data["plan_code"]).first()
        if existing:
            # Update existing fields in case specs/pricing changed
            existing.name = plan_data["name"]
            existing.cpu_cores = plan_data["vcpu"]
            existing.ram_mb = plan_data["ram_gb"] * 1024  # Convert GB → MB
            existing.disk_gb = plan_data["storage_gb"]
            existing.bandwidth_tb = plan_data["bandwidth_tb"]
            existing.stripe_lookup_key_monthly = plan_data["stripe_lookup_key_monthly"]
            existing.stripe_lookup_key_yearly = plan_data["stripe_lookup_key_yearly"]
            existing.price_per_month = plan_data["monthly_price"]
            existing.provider = plan_data["provider"]
            existing.provider_plan_code = plan_data["provider_plan_code"]
            existing.default_region = plan_data["default_region"]
            existing.description = plan_data["description"]
        else:
            # Create new row
            new_plan = VPSPlan(
                plan_code=plan_data["plan_code"],
                name=plan_data["name"],
                cpu_cores=plan_data["vcpu"],
                ram_mb=plan_data["ram_gb"] * 1024,  # GB → MB
                disk_gb=plan_data["storage_gb"],
                bandwidth_tb=plan_data["bandwidth_tb"],
                stripe_lookup_key_monthly=plan_data["stripe_lookup_key_monthly"],
                stripe_lookup_key_yearly=plan_data["stripe_lookup_key_yearly"],
                price_per_month=plan_data["monthly_price"],
                provider=plan_data["provider"],
                provider_plan_code=plan_data["provider_plan_code"],
                default_region=plan_data["default_region"],
                description=plan_data["description"],
                is_active=True
            )
            db.session.add(new_plan)

    db.session.commit()
    print("✅ VPSPlan table seeded/updated from vps_catalog.")
