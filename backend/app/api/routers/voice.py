import asyncio
from fastapi import APIRouter, File, UploadFile, HTTPException
from app.services.voice_transcriber import transcribe_audio
from app.services.voice_intent import parse_intent

router = APIRouter()

@router.post("/voice")
async def voice_transcribe(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")
    
    transcription = await asyncio.to_thread(transcribe_audio, audio_bytes, audio.filename or "recording.webm")
    
    if not transcription:
        return {"success": False, "error": "No audible transcription"}

    intent = await asyncio.to_thread(parse_intent, transcription)
    
    return {
        "success": True,
        "transcription": transcription,
        "intent": intent
    }
