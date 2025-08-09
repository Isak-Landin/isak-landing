# apps/vps/vps_catalog.py
# Source of truth for VPS plan seeding into VPSPlan
# Based on Phase 0 Stripe setup & Hostup specs

VPS_PLANS = [
    {
        "plan_code": "nebula_one",
        "name": "Nebula One",
        "vcpu": 2,
        "ram_gb": 4,
        "storage_gb": 50,
        "bandwidth_tb": 2,
        "stripe_lookup_key_monthly": "nebula_one_monthly",
        "stripe_lookup_key_yearly": "nebula_one_yearly",
        "currency": "eur",
        "monthly_price": 8.65,
        "yearly_price": 93.00,
        "provider": "hostup",
        "provider_plan_code": None,   # Hostup SKU or ID if known
        "default_region": None,
        "description": "2 vCPU, 4 GB RAM, 50 GB NVMe SSD, 2 TB bandwidth"
    },
    {
        "plan_code": "nebula_two",
        "name": "Nebula Two",
        "vcpu": 2,
        "ram_gb": 8,
        "storage_gb": 100,
        "bandwidth_tb": 5,
        "stripe_lookup_key_monthly": "nebula_two_monthly",
        "stripe_lookup_key_yearly": "nebula_two_yearly",
        "currency": "eur",
        "monthly_price": 16.70,
        "yearly_price": 180.00,
        "provider": "hostup",
        "provider_plan_code": None,
        "default_region": None,
        "description": "2 vCPU, 8 GB RAM, 100 GB NVMe SSD, 5 TB bandwidth"
    },
    {
        "plan_code": "nebula_four",
        "name": "Nebula Four",
        "vcpu": 4,
        "ram_gb": 16,
        "storage_gb": 200,
        "bandwidth_tb": 10,
        "stripe_lookup_key_monthly": "nebula_four_monthly",
        "stripe_lookup_key_yearly": "nebula_four_yearly",
        "currency": "eur",
        "monthly_price": 33.93,
        "yearly_price": 366.00,
        "provider": "hostup",
        "provider_plan_code": None,
        "default_region": None,
        "description": "4 vCPU, 16 GB RAM, 200 GB NVMe SSD, 10 TB bandwidth"
    },
    {
        "plan_code": "nebula_eight",
        "name": "Nebula Eight",
        "vcpu": 8,
        "ram_gb": 32,
        "storage_gb": 400,
        "bandwidth_tb": 20,
        "stripe_lookup_key_monthly": "nebula_eight_monthly",
        "stripe_lookup_key_yearly": "nebula_eight_yearly",
        "currency": "eur",
        "monthly_price": 68.43,
        "yearly_price": 739.00,
        "provider": "hostup",
        "provider_plan_code": None,
        "default_region": None,
        "description": "8 vCPU, 32 GB RAM, 400 GB NVMe SSD, 20 TB bandwidth"
    },
    {
        "plan_code": "nebula_sixteen",
        "name": "Nebula Sixteen",
        "vcpu": 16,
        "ram_gb": 64,
        "storage_gb": 800,
        "bandwidth_tb": 32,
        "stripe_lookup_key_monthly": "nebula_sixteen_monthly",
        "stripe_lookup_key_yearly": "nebula_sixteen_yearly",
        "currency": "eur",
        "monthly_price": 136.85,
        "yearly_price": 1478.00,
        "provider": "hostup",
        "provider_plan_code": None,
        "default_region": None,
        "description": "16 vCPU, 64 GB RAM, 800 GB NVMe SSD, 32 TB bandwidth"
    },
    {
        "plan_code": "nebula_thirtytwo",
        "name": "Nebula Thirty-Two",
        "vcpu": 32,
        "ram_gb": 128,
        "storage_gb": 1600,
        "bandwidth_tb": 32,
        "stripe_lookup_key_monthly": "nebula_thirtytwo_monthly",
        "stripe_lookup_key_yearly": "nebula_thirtytwo_yearly",
        "currency": "eur",
        "monthly_price": 274.85,
        "yearly_price": 2968.00,
        "provider": "hostup",
        "provider_plan_code": None,
        "default_region": None,
        "description": "32 vCPU, 128 GB RAM, 1600 GB NVMe SSD, 32 TB bandwidth"
    }
]

def get_plan_by_code(plan_code):
    """Return plan dict by plan_code."""
    return next((p for p in VPS_PLANS if p["plan_code"] == plan_code), None)
