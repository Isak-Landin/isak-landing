# apps/vps/vps_catalog.py
VPS_PLANS = [
    {
        "id": "starter-1",
        "name": "Starter 1",
        "price_cents": 500,   # €5.00
        "currency": "eur",
        "specs": {"vCPU": 1, "RAM_GB": 1, "SSD_GB": 25, "Bandwidth_TB": 1},
        "badge": "Great for small apps",
    },
    {
        "id": "basic-2",
        "name": "Basic 2",
        "price_cents": 900,   # €9.00
        "currency": "eur",
        "specs": {"vCPU": 1, "RAM_GB": 2, "SSD_GB": 40, "Bandwidth_TB": 2},
        "badge": "Perfect personal server",
    },
    {
        "id": "dev-4",
        "name": "Dev 4",
        "price_cents": 1500,  # €15.00
        "currency": "eur",
        "specs": {"vCPU": 2, "RAM_GB": 4, "SSD_GB": 80, "Bandwidth_TB": 3},
        "badge": "Dev/staging ready",
    },
    {
        "id": "pro-8",
        "name": "Pro 8",
        "price_cents": 3000,  # €30.00
        "currency": "eur",
        "specs": {"vCPU": 4, "RAM_GB": 8, "SSD_GB": 160, "Bandwidth_TB": 4},
        "badge": "Production workloads",
    },
    {
        "id": "power-16",
        "name": "Power 16",
        "price_cents": 6200,  # €62.00
        "currency": "eur",
        "specs": {"vCPU": 8, "RAM_GB": 16, "SSD_GB": 320, "Bandwidth_TB": 5},
        "badge": "High traffic apps",
    },
]

def get_plan(plan_id):
    return next((p for p in VPS_PLANS if p["id"] == plan_id), None)
