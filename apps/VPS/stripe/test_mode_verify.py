import os, stripe
stripe.api_key = "sk_test_YCyV7XZxehnH1Sx3wKK0oZ2o"

def get_price_by_lookup(lk):
    res = stripe.Price.list(lookup_keys=[lk], active=True, limit=1, expand=["data.product"])
    return None if not res.data else {"price_id": res.data[0].id, "interval": res.data[0].recurring.interval, "product": res.data[0].product.name}

print("nebula_one monthly:", get_price_by_lookup("nebula_one_monthly"))
print("nebula_one yearly :", get_price_by_lookup("nebula_one_yearly"))
