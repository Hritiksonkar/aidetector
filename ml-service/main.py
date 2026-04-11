from __future__ import annotations

import logging
from typing import Literal

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, AnyUrl, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ml-service")

app = FastAPI(title="Fake Content Detection ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class TextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50000)


class VideoRequest(BaseModel):
    videoUrl: AnyUrl


class DetectResponse(BaseModel):
    result: Literal["Real", "Fake"]
    confidence: float


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/text", response_model=DetectResponse)
async def detect_text(payload: TextRequest) -> DetectResponse:
    logger.info("/text request received (len=%s)", len(payload.text))
    return DetectResponse(result="Fake", confidence=0.87)


@app.post("/video", response_model=DetectResponse)
async def detect_video(payload: VideoRequest) -> DetectResponse:
    logger.info("/video request received (url=%s)", str(payload.videoUrl))
    return DetectResponse(result="Fake", confidence=0.81)


@app.post("/image", response_model=DetectResponse)
async def detect_image(file: UploadFile = File(...)) -> DetectResponse:
    logger.info("/image upload received (filename=%s, content_type=%s)", file.filename, file.content_type)
    # Read a small chunk to emulate processing without loading whole file
    _ = await file.read(1024)
    return DetectResponse(result="Fake", confidence=0.84)
