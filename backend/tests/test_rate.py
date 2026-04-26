import time
from rate_limit_monitor import rate_limit_monitor
from model_pool import model_pool_manager

print("1. Available text pool models:", list(model_pool_manager.pools['text_pool']))

print("\n2. Getting first available model...")
m = model_pool_manager.get_available_model("text_pool")
print(f"Model selected: {m}")

print(f"\n3. Simulating 429 Rate Limit hit on {m}...")
rate_limit_monitor.mark_rate_limited(m, reset_time_seconds=60)

print("\n4. Getting available model AGAIN (should rotate!)...")
m2 = model_pool_manager.get_available_model("text_pool")
print(f"Model selected: {m2} 🎉")

print("\n5. Current Rotation Order:", list(model_pool_manager.pools['text_pool']))
