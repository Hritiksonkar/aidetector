import io
import math
import os
import tempfile
import base64
import json
import re
from typing import Literal, Optional

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

try:
    import httpx
except Exception:  # pragma: no cover
    httpx = None

try:
    from PIL import Image
except Exception:  # pragma: no cover
    Image = None

try:
    import cv2  # type: ignore
except Exception:  # pragma: no cover
    cv2 = None

app = FastAPI(title="Truth Shield AI Detector", version="1.0.0")

# Keep permissive for local dev; lock down in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _clamp_0_10(x: float) -> float:
    if math.isnan(x) or math.isinf(x):
        return 0.0
    return float(max(0.0, min(10.0, x)))


def _clamp_0_1(x: float) -> float:
    if math.isnan(x) or math.isinf(x):
        return 0.0
    return float(max(0.0, min(1.0, x)))


def _sigmoid(x: float) -> float:
    # Stable sigmoid for moderate x.
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


def _estimate_edge_energy(gray01: np.ndarray) -> float:
    # gray01 in [0,1], shape (H,W)
    if gray01.size == 0:
        return 0.0
    dx = np.abs(np.diff(gray01, axis=1))
    dy = np.abs(np.diff(gray01, axis=0))
    # mean absolute gradient magnitude (cheap proxy for sharpness/detail)
    return float(dx.mean() + dy.mean()) / 2.0


def _heuristic_image_score(img) -> float:
    arr = np.asarray(img, dtype=np.float32) / 255.0
    variance = float(arr.var())
    gray = arr.mean(axis=2) if arr.ndim == 3 else arr
    edge_energy = _estimate_edge_energy(gray)

    # These are heuristic thresholds tuned to be conservative:
    # - Most natural photos have variance well above ~0.02 (on 0..1 pixels)
    # - Extremely smooth / low-detail images can look synthetic.
    v_component = _sigmoid((0.018 - variance) / 0.004)  # low variance => higher
    e_component = _sigmoid((0.010 - edge_energy) / 0.003)  # low edges => higher

    # Reduce confidence for tiny images
    w, h = getattr(img, "size", (0, 0))
    small_penalty = 0.7 if min(w, h) and min(w, h) < 128 else 1.0

    score = 10.0 * (0.65 * v_component + 0.35 * e_component) * small_penalty
    return _clamp_0_10(score)


async def _score_with_gemini_image(data: bytes, mime_type: str) -> Optional[tuple[float, str]]:
    """Return (score, explanation) or None if not configured/failed."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    if httpx is None:
        return None

    # Gemini supports images as inline data. For videos we fall back to heuristic.
    b64 = base64.b64encode(data).decode("utf-8")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-1.5-flash:generateContent"
    )

    prompt = (
        "You are a media forensics assistant. Estimate how likely the given image is AI-generated. "
        "Return ONLY a JSON object with keys: score (number 0..10) and explanation (string). "
        "Score 0 means very likely real; score 10 means very likely AI-generated."
    )

    body = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {"inlineData": {"mimeType": mime_type, "data": b64}},
                ],
            }
        ],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 256},
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(url, params={"key": api_key}, json=body)
            resp.raise_for_status()
            payload = resp.json()

        text = (
            payload.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )

        # Extract JSON if the model adds extra formatting.
        m = re.search(r"\{[\s\S]*\}", text)
        raw_json = m.group(0) if m else text
        obj = json.loads(raw_json)

        score = _clamp_0_10(float(obj.get("score", 0.0)))
        explanation = str(obj.get("explanation", "")).strip()
        return score, explanation
    except Exception:
        return None


def _score_from_image_bytes(data: bytes) -> float:
    # Lightweight heuristic placeholder.
    # A real implementation would run a forensic/deepfake model here.
    if Image is None:
        # Fall back to size-only heuristic.
        return _clamp_0_10((len(data) / 2_000_000.0) * 3.0)

    img = Image.open(io.BytesIO(data)).convert("RGB")
    return _heuristic_image_score(img)


def _suffix_from_upload(filename: str | None, mime: str | None) -> str:
    name = (filename or "").strip()
    if name:
        _, ext = os.path.splitext(name)
        if ext and len(ext) <= 10:
            return ext

    m = (mime or "").lower().strip()
    if m == "video/webm":
        return ".webm"
    if m in ("video/quicktime", "video/mov"):
        return ".mov"
    if m in ("video/x-matroska", "video/mkv"):
        return ".mkv"
    if m in ("video/x-msvideo", "video/avi"):
        return ".avi"
    return ".mp4"


def _score_from_video_bytes(data: bytes, *, suffix: str = ".mp4") -> float:
    # Lightweight heuristic placeholder.
    # If OpenCV is available, try to decode a few frames from an in-memory buffer.
    if cv2 is None:
        return _clamp_0_10((len(data) / 20_000_000.0) * 5.0)

    # OpenCV can't reliably decode from raw bytes without a file.
    # Write to a unique temp file for decoding, then clean up.
    tmp_dir = os.environ.get("TMPDIR") or os.environ.get("TEMP") or None
    tmp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="wb", suffix=suffix or ".mp4", delete=False, dir=tmp_dir
        ) as f:
            tmp_path = f.name
            f.write(data)

        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return 5.0

        frames = []
        for _ in range(5):
            ok, frame = cap.read()
            if not ok:
                break
            # Downscale for speed
            frame = cv2.resize(frame, (256, 256))
            frames.append(frame)

        cap.release()

        if not frames:
            return 5.0

        stack = np.stack(frames, axis=0).astype(np.float32) / 255.0

        # Heuristic: low temporal change + low detail might indicate synthetic.
        temporal_diff = float(np.abs(np.diff(stack, axis=0)).mean())
        spatial_var = float(stack.var())

        t_component = _sigmoid((0.020 - temporal_diff) / 0.006)
        v_component = _sigmoid((0.020 - spatial_var) / 0.006)

        score = 10.0 * (0.55 * t_component + 0.45 * v_component)
        return _clamp_0_10(score)
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except OSError:
                pass


def _infer_kind(mime: str) -> Optional[Literal["image", "video"]]:
    if mime.startswith("image/"):
        return "image"
    if mime.startswith("video/"):
        return "video"
    return None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    kind = _infer_kind(file.content_type or "")
    if kind not in ("image", "video"):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    source = "heuristic"
    explanation = None

    if kind == "image":
        gem = await _score_with_gemini_image(data, file.content_type or "image/png")
        if gem is not None:
            score, explanation = gem
            source = "gemini"
        else:
            score = _score_from_image_bytes(data)
    else:
        suffix = _suffix_from_upload(getattr(file, "filename", None), file.content_type)
        score = _score_from_video_bytes(data, suffix=suffix)

    resp = {"score": round(float(score), 2), "source": source}
    if explanation:
        resp["explanation"] = explanation
    return resp
