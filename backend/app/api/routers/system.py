from fastapi import APIRouter
import time

router = APIRouter()
START_TIME = time.time()

@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "uptime": time.time() - START_TIME
    }

@router.get("/settings")
def get_settings():
    return {
        "base_font_size": "20px",
        "line_height": "1.8",
        "colors": {
            "background": "#FFFEF5",
            "text": "#1A1A1A",
            "highlight": "#6A0DAD",
            "accent": "#E67E00"
        }
    }
