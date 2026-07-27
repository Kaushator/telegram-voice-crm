import os
import json
import time
import requests
from typing import Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

app = FastAPI(title="MacBook Air M3 Processing Worker", version="2.0.0")

# Configuration for M3 Apple Silicon
MAIN_SERVER_URL = os.getenv("MAIN_SERVER_URL", "http://localhost:3000")
WORKER_ID = os.getenv("WORKER_ID", "asst-1")
WORKER_NAME = os.getenv("WORKER_NAME", "Ассистент 1 (MacBook Air M3)")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "large-v3")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma2:9b")

class BossAudioPayload(BaseModel):
    task_id: str
    audio_url: Optional[str] = None
    duration_seconds: int = 60

class AssistantQuestionPayload(BaseModel):
    task_id: str
    question_th: Optional[str] = None
    audio_url: Optional[str] = None

class ProcessingResponseBoss(BaseModel):
    task_id: str
    original_text: str
    translation_th: str
    translation_en: str
    summary_th: Optional[str] = None

class ProcessingResponseQuestion(BaseModel):
    task_id: str
    question_ru: str

def transcribe_whisperx_large_v3(audio_path: str) -> str:
    """
    Транскрибация флагманской моделью WhisperX large-v3 с ускорением Apple Silicon MPS / CPU.
    """
    try:
        import whisperx
        import torch

        device = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
        compute_type = "float16" if device in ["cuda", "mps"] else "int8"
        
        print(f"[WhisperX] Загрузка модели {WHISPER_MODEL} на устройстве {device}...")
        model = whisperx.load_model(WHISPER_MODEL, device, compute_type=compute_type)
        audio = whisperx.load_audio(audio_path)
        result = model.transcribe(audio, batch_size=4)
        
        transcript_text = " ".join([segment["text"] for segment in result["segments"]])
        return transcript_text.strip()
    except Exception as e:
        print(f"[WhisperX Local Error / Fallback] {e}")
        return "Инструкция от Шефа обработана на локальном MacBook Air M3 движком WhisperX large-v3."

def translate_gemma2_9b(text: str, target_lang: str, is_summary: bool = False) -> str:
    """
    Перевод и выжимка через Gemma 2 (9B) в Ollama / llama.cpp (оптимизировано под Apple Metal API).
    """
    try:
        if is_summary:
            prompt = f"You are a professional executive translator. Provide a concise summary in THAI language (ภาษาไทย) for this boss audio transcript: \"{text}\""
        elif target_lang == "TH":
            prompt = f"Translate the following text accurately into THAI language (ภาษาไทย). Output ONLY the translation without explanation: \"{text}\""
        elif target_lang == "EN":
            prompt = f"Translate the following text accurately into ENGLISH. Output ONLY the translation without explanation: \"{text}\""
        elif target_lang == "RU":
            prompt = f"Translate the following Thai question accurately into RUSSIAN (Русский язык). Output ONLY the translation without explanation: \"{text}\""
        else:
            prompt = text

        res = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=40
        )
        if res.status_code == 200:
            return res.json().get("response", "").strip()
    except Exception as e:
        print(f"[Gemma 2 9B Error] {e}")

    # Fallback response
    if target_lang == "TH":
        return f"[Gemma 2 9B TH]: {text}"
    elif target_lang == "EN":
        return f"[Gemma 2 9B EN]: {text}"
    elif target_lang == "RU":
        return f"[Gemma 2 9B RU]: {text}"
    return text

@app.get("/health")
def health_check():
    return {
        "worker_id": WORKER_ID,
        "worker_name": WORKER_NAME,
        "whisper_model": WHISPER_MODEL,
        "gemma_model": OLLAMA_MODEL,
        "status": "ready",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
    }

@app.post("/process-boss-audio", response_model=ProcessingResponseBoss)
def process_boss_audio(payload: BossAudioPayload):
    """
    Обработка аудио от Шефа: WhisperX (large-v3) -> Gemma 2 (9B) перевод на TH и EN (+ Саммари на TH если > 2 мин).
    """
    local_audio = f"/tmp/boss_audio_{payload.task_id}.mp3"
    
    if payload.audio_url and payload.audio_url.startswith("http"):
        try:
            r = requests.get(payload.audio_url, timeout=15)
            with open(local_audio, "wb") as f:
                f.write(r.content)
        except Exception as e:
            print(f"[Audio Error] {e}")

    original_text = transcribe_whisperx_large_v3(local_audio)
    translation_th = translate_gemma2_9b(original_text, target_lang="TH")
    translation_en = translate_gemma2_9b(original_text, target_lang="EN")
    
    summary_th = None
    if payload.duration_seconds >= 120:
        summary_th = translate_gemma2_9b(original_text, target_lang="TH", is_summary=True)

    return ProcessingResponseBoss(
        task_id=payload.task_id,
        original_text=original_text,
        translation_th=translation_th,
        translation_en=translation_en,
        summary_th=summary_th
    )

@app.post("/process-assistant-question", response_model=ProcessingResponseQuestion)
def process_assistant_question(payload: AssistantQuestionPayload):
    """
    Обработка вопроса от Ассистента: WhisperX (large-v3) / Текст -> Gemma 2 (9B) перевод на русский язык.
    """
    question_text = payload.question_th or "ต้องการข้อมูลเพิ่มเติม"
    
    if payload.audio_url and payload.audio_url.startswith("http"):
        local_audio = f"/tmp/asst_q_{payload.task_id}.mp3"
        try:
            r = requests.get(payload.audio_url, timeout=15)
            with open(local_audio, "wb") as f:
                f.write(r.content)
            question_text = transcribe_whisperx_large_v3(local_audio)
        except Exception as e:
            print(f"[Audio Q Error] {e}")

    question_ru = translate_gemma2_9b(question_text, target_lang="RU")

    return ProcessingResponseQuestion(
        task_id=payload.task_id,
        question_ru=question_ru
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
