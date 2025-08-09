# apps/VPS/stripe/api.py
import stripe
import os

# Set Stripe API key from env
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

def get_price_id_by_lookup_key(lookup_key: str) -> str:
    """
    Given a Stripe Price lookup key, return the active price ID.
    Raises ValueError if not found.
    """
    prices = stripe.Price.list(
        lookup_keys=[lookup_key],
        active=True,
        expand=["data.product"],
        limit=1
    )
    if not prices.data:
        raise ValueError(f"No active price found for lookup key '{lookup_key}'")
    return prices.data[0].id
