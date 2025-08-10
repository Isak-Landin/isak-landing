from flask import jsonify, render_template
from apps.VPS.models import VPSPlan
from apps.VPS.vps import vps_blueprint


@vps_blueprint.route("/", methods=["GET"])
def vps_list_page():
    plans = (
        VPSPlan.query
        .filter_by(is_active=True)
        .order_by(VPSPlan.cpu_cores.asc())
        .all()
    )
    view_plans = []
    for p in plans:
        view_plans.append({
            "plan_code": p.plan_code,
            "name": p.name,
            "description": p.description,
            "vcpu": p.cpu_cores,
            "ram_gb": int(p.ram_mb / 1024) if p.ram_mb else None,
            "ssd_gb": p.disk_gb,
            "bandwidth_tb": p.bandwidth_tb,
            "lookup_monthly": p.stripe_lookup_key_monthly,
            "lookup_yearly": p.stripe_lookup_key_yearly,
        })
    return render_template("vps/list.html", plans=view_plans)

@vps_blueprint.route("/plans.json", methods=["GET"])
def vps_list_plans():
    plans = (
        VPSPlan.query
        .filter_by(is_active=True)
        .order_by(VPSPlan.cpu_cores.asc())
        .all()
    )
    out = []
    for p in plans:
        out.append({
            "plan_code": p.plan_code,
            "name": p.name,
            "description": p.description,
            "specs": {
                "vCPU": p.cpu_cores,
                "RAM_GB": int(p.ram_mb / 1024) if p.ram_mb else None,
                "SSD_GB": p.disk_gb,
                "Bandwidth_TB": p.bandwidth_tb,
            },
            "stripe_lookup_keys": {
                "monthly": p.stripe_lookup_key_monthly,
                "yearly": p.stripe_lookup_key_yearly,
            },
            "provider": {
                "name": p.provider,
                "plan_code": p.provider_plan_code,
                "default_region": p.default_region,
            },
        })
    return jsonify({"ok": True, "plans": out})
