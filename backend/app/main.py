from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import system

app = FastAPI(title="NeuroRead AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all modules
app.include_router(system.router)
