from fastapi import FastAPI

app = FastAPI(title="NeuroRead AI Backend")

@app.get("/")
def root():
    return {"message": "NeuroRead AI Backend is running."}
