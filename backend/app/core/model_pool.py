from collections import deque
from app.core.rate_limit_monitor import rate_limit_monitor
from typing import Optional

POOLS = {
    "text_pool": deque(["llama-3.1-8b-instant", "mixtral-8x7b-32768", "llama-3.1-70b-versatile"]),
    "vision_pool": deque(["llama-3.2-11b-vision-preview"]),
    "audio_pool": deque(["whisper-large-v3-turbo", "whisper-large-v3"])
}

class ModelPoolManager:
    def __init__(self):
        self.pools = POOLS

    def get_current_model(self, pool_name: str) -> Optional[str]:
        if pool_name not in self.pools:
            raise ValueError(f"Pool {pool_name} doesn\'t exist.")
            
        pool = self.pools[pool_name]
        for _ in range(len(pool)):
            candidate = pool[0]
            if rate_limit_monitor.check_can_use_model(candidate):
                return candidate
            else:
                pool.rotate(-1)
                
        print(f"🛑 CRITICAL: Entire pool \'{pool_name}\' is rate-limited!")
        return None

    def rotate_failed_model(self, pool_name: str):
        pool = self.pools.get(pool_name)
        if pool:
            model = pool[0]
            print(f"🔄 Rotating pool \'{pool_name}\': {model} is Rate-Limited! Throwing to back.")
            pool.rotate(-1)

model_pool_manager = ModelPoolManager()
