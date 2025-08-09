# apps/VPS/stripe/catalog.py
"""
Builds a mapping from our DB plans (VPSPlan) to Stripe Price IDs
by resolving the monthly/yearly lookup keys created in Phase 0.

Example return shape:
{
  "nebula_one":  {"month": "price_...", "year": "price_..."},
  "nebula_two":  {"month": "price_...", "year": "price_..."},
  ...
}
"""

import time
import logging
from typing import Dict

from apps.VPS.models import VPSPlan
from apps.VPS.stripe.api import get_price_id_by_lookup_key

log = logging.getLogger(__name__)

# simple in-process cache (MVP)
_PRICE_MAP_CACHE = {"data": None, "expires_at": 0}

def _now() -> float:
    return time.time()

def get_price_map(ttl_seconds: int = 60) -> Dict[str, Dict[str, str]]:
    """
    Returns a dict mapping plan_code -> {"month": price_id, "year": price_id}.
    Caches for `ttl_seconds` to avoid repeated Stripe calls during traffic spikes.
    """
    global _PRICE_MAP_CACHE

    if _PRICE_MAP_CACHE["data"] is not None and _now() < _PRICE_MAP_CACHE["expires_at"]:
        return _PRICE_MAP_CACHE["data"]

    data: Dict[str, Dict[str, str]] = {}
    plans = VPSPlan.query.filter_by(is_active=True).all()

    for p in plans:
        try:
            month_id = get_price_id_by_lookup_key(p.stripe_lookup_key_monthly)
        except Exception as e:
            log.error(f"Stripe price not found for monthly lookup '{p.stripe_lookup_key_monthly}' (plan={p.plan_code}): {e}")
            month_id = None

        try:
            year_id = get_price_id_by_lookup_key(p.stripe_lookup_key_yearly)
        except Exception as e:
            log.error(f"Stripe price not found for yearly lookup '{p.stripe_lookup_key_yearly}' (plan={p.plan_code}): {e}")
            year_id = None

        # Only include plans that resolve at least one interval
        if month_id or year_id:
            data[p.plan_code] = {"month": month_id, "year": year_id}
        else:
            log.warning(f"Skipping plan '{p.plan_code}' — no Stripe prices resolved.")

    _PRICE_MAP_CACHE = {"data": data, "expires_at": _now() + ttl_seconds}
    return data

def get_price_id(plan_code: str, interval: str) -> str:
    """
    Convenience accessor for a single plan/interval.
    interval must be 'month' or 'year'.
    Raises KeyError/ValueError if not found.
    """
    interval = interval.strip().lower()
    if interval not in ("month", "year"):
        raise ValueError("interval must be 'month' or 'year'")

    price_map = get_price_map()
    if plan_code not in price_map:
        raise KeyError(f"Unknown plan_code '{plan_code}' (not in price map)")

    price_id = price_map[plan_code].get(interval)
    if not price_id:
        raise KeyError(f"No Stripe price ID for plan '{plan_code}' interval '{interval}'")
    return price_id

def bust_cache():
    """Force cache refresh on next call."""
    global _PRICE_MAP_CACHE
    _PRICE_MAP_CACHE = {"data": None, "expires_at": 0}
