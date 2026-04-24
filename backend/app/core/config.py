"""
NeuroRead AI — config.py
Central configuration for all backend modules.
Manages API keys and model assignments.
"""

import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from groq import Groq

load_dotenv()

# ─── API Key ─────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# ─── LLM Parameters ──────────────────────────────────────────
TEMPERATURES = {
    "dom_mapper":       0.3,
    "text_simplifier":  0.3,
    "focus_mapper":     0.3,
    "voice_intent":     0.3,
}

# ─── Rate Limit / Retry Config ────────────────────────────────
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 10


def get_llm(task: str, model: str = "llama-3.1-70b-versatile") -> ChatGroq:
    """Returns a ChatGroq LLM instance for the given task."""
    return ChatGroq(
        api_key=GROQ_API_KEY,
        model=model,
        temperature=TEMPERATURES.get(task, 0.1),
        timeout=30,
    )


def get_groq_client() -> Groq:
    """Returns a raw Groq SDK client (used for Whisper audio transcription)."""
    return Groq(api_key=GROQ_API_KEY)
