from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from dataclasses import dataclass
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import AnyUrl, BaseModel, Field

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ml-service")


def _env(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value not in (None, "") else default


def _env_int(name: str, default: int) -> int:
    try:
        return int(_env(name, str(default)))
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    try:
        return float(_env(name, str(default)))
    except ValueError:
        return default


MEDIA_MODE = _env("MEDIA_MODE", "general-manipulated")  # deepfake-face | general-manipulated
MEDIA_MODEL_ID = _env("MEDIA_MODEL_ID", "openai/clip-vit-base-patch32")
MEDIA_THRESHOLD = _env_float("MEDIA_THRESHOLD", 0.50)
VIDEO_MAX_FRAMES = _env_int("VIDEO_MAX_FRAMES", 12)
VIDEO_FRAME_STRIDE = _env_int("VIDEO_FRAME_STRIDE", 15)  # sample every N frames if fps unknown
MAX_DOWNLOAD_BYTES = _env_int("VIDEO_MAX_DOWNLOAD_BYTES", 50 * 1024 * 1024)  # 50MB

# Deepfake video detection (frame-based)
VIDEO_DEEPFAKE_MODEL_ID = _env("VIDEO_DEEPFAKE_MODEL_ID", "dima806/deepfake_vs_real_image_detection")
VIDEO_DEEPFAKE_THRESHOLD = _env_float("VIDEO_DEEPFAKE_THRESHOLD", 0.50)

TEXT_MODEL_ID = _env("TEXT_MODEL_ID", "openai-community/roberta-base-openai-detector")
TEXT_THRESHOLD = _env_float("TEXT_THRESHOLD", 0.50)
TEXT_MAX_LENGTH = _env_int("TEXT_MAX_LENGTH", 512)
TEXT_STRIDE = _env_int("TEXT_STRIDE", 128)
TEXT_BATCH_SIZE = _env_int("TEXT_BATCH_SIZE", 8)

NEWS_MODEL_ID = _env("NEWS_MODEL_ID", "facebook/bart-large-mnli")
NEWS_THRESHOLD = _env_float("NEWS_THRESHOLD", 0.50)
NEWS_MAX_LENGTH = _env_int("NEWS_MAX_LENGTH", 1024)
NEWS_PREMISE_MAX_TOKENS = _env_int("NEWS_PREMISE_MAX_TOKENS", 768)
NEWS_STRIDE = _env_int("NEWS_STRIDE", 128)
NEWS_BATCH_SIZE = _env_int("NEWS_BATCH_SIZE", 4)
NEWS_LOGIT_SCALE = _env_float("NEWS_LOGIT_SCALE", 5.0)


app = FastAPI(title="Fake Content Detection ML Service", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50000)


class VideoRequest(BaseModel):
    videoUrl: AnyUrl


class DetectResponse(BaseModel):
    result: Literal["Real", "Fake"]
    confidence: float


@dataclass(frozen=True)
class MediaPrompts:
    real: list[str]
    fake: list[str]


def _get_prompts(mode: str) -> MediaPrompts:
    if mode == "deepfake-face":
        return MediaPrompts(
            real=[
                "a real portrait photograph of a person",
                "a natural human face photo",
                "a genuine camera photo of a human face",
            ],
            fake=[
                "a deepfake face",
                "a face swapped deepfake",
                "an AI-generated human face",
                "a synthetic portrait",
            ],
        )

    # general-manipulated
    return MediaPrompts(
        real=[
            "a real photograph",
            "a genuine photo taken by a camera",
            "an unedited natural photo",
        ],
        fake=[
            "an AI-generated image",
            "a synthetic image",
            "a manipulated photo",
            "a deepfake image",
        ],
    )


_clip_lock = asyncio.Lock()
_clip_model = None
_clip_processor = None
_face_detector = None

_video_df_lock = asyncio.Lock()
_video_df_model = None
_video_df_processor = None
_video_df_fake_index = None

_text_lock = asyncio.Lock()
_text_model = None
_text_tokenizer = None
_text_fake_index = None

_news_lock = asyncio.Lock()
_news_model = None
_news_tokenizer = None
_news_entailment_index = None
_news_contradiction_index = None


def _pick_fake_index(id2label: dict | None) -> int:
    # Prefer explicit labels when present.
    if isinstance(id2label, dict) and len(id2label) > 0:
        norm = {int(k): str(v) for k, v in id2label.items()}
        for idx, label in norm.items():
            if label.strip().lower() in {"fake", "ai", "generated"}:
                return idx
        for idx, label in norm.items():
            if "fake" in label.strip().lower() or "ai" in label.strip().lower() or "generated" in label.strip().lower():
                return idx

        if len(norm) == 2:
            # Common convention is 0=Real, 1=Fake, but not guaranteed.
            return 1

    # Safe fallback.
    return 1


async def _ensure_text_model_loaded() -> None:
    global _text_model, _text_tokenizer, _text_fake_index

    if _text_model is not None and _text_tokenizer is not None and _text_fake_index is not None:
        return

    async with _text_lock:
        if _text_model is not None and _text_tokenizer is not None and _text_fake_index is not None:
            return

        logger.info("Loading text detector model: %s", TEXT_MODEL_ID)

        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "Missing ML dependencies. Install requirements.txt (transformers/torch)."
            ) from e

        def _load():
            try:
                tok = AutoTokenizer.from_pretrained(TEXT_MODEL_ID, local_files_only=True)
                model = AutoModelForSequenceClassification.from_pretrained(TEXT_MODEL_ID, local_files_only=True)
            except Exception:
                tok = AutoTokenizer.from_pretrained(TEXT_MODEL_ID)
                model = AutoModelForSequenceClassification.from_pretrained(TEXT_MODEL_ID)
            model.eval()
            fake_index = _pick_fake_index(getattr(model.config, "id2label", None))
            return model, tok, fake_index

        _text_model, _text_tokenizer, _text_fake_index = await asyncio.to_thread(_load)


def _pick_entailment_index(label2id: dict | None) -> int:
    if isinstance(label2id, dict) and len(label2id) > 0:
        lowered = {str(k).strip().lower(): int(v) for k, v in label2id.items()}
        if "entailment" in lowered:
            return int(lowered["entailment"])
    return 2


def _pick_contradiction_index(label2id: dict | None) -> int:
    if isinstance(label2id, dict) and len(label2id) > 0:
        lowered = {str(k).strip().lower(): int(v) for k, v in label2id.items()}
        if "contradiction" in lowered:
            return int(lowered["contradiction"])
    return 0


async def _ensure_news_model_loaded() -> None:
    global _news_model, _news_tokenizer, _news_entailment_index, _news_contradiction_index

    if (
        _news_model is not None
        and _news_tokenizer is not None
        and _news_entailment_index is not None
        and _news_contradiction_index is not None
    ):
        return

    async with _news_lock:
        if (
            _news_model is not None
            and _news_tokenizer is not None
            and _news_entailment_index is not None
            and _news_contradiction_index is not None
        ):
            return

        logger.info("Loading news detector model: %s", NEWS_MODEL_ID)
        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "Missing ML dependencies. Install requirements.txt (transformers/torch)."
            ) from e

        def _load():
            try:
                tok = AutoTokenizer.from_pretrained(NEWS_MODEL_ID, local_files_only=True)
                model = AutoModelForSequenceClassification.from_pretrained(
                    NEWS_MODEL_ID,
                    local_files_only=True,
                    low_cpu_mem_usage=True,
                )
            except Exception:
                tok = AutoTokenizer.from_pretrained(NEWS_MODEL_ID)
                model = AutoModelForSequenceClassification.from_pretrained(
                    NEWS_MODEL_ID,
                    low_cpu_mem_usage=True,
                )
            model.eval()
            label2id = getattr(model.config, "label2id", None)
            entailment_idx = _pick_entailment_index(label2id)
            contradiction_idx = _pick_contradiction_index(label2id)
            return model, tok, entailment_idx, contradiction_idx

        _news_model, _news_tokenizer, _news_entailment_index, _news_contradiction_index = await asyncio.to_thread(_load)


def _score_text_fake_prob(text: str) -> float:
    if _text_model is None or _text_tokenizer is None or _text_fake_index is None:
        raise RuntimeError("Text model not loaded")

    try:
        import torch
    except Exception as e:  # pragma: no cover
        raise RuntimeError("torch is required for inference") from e

    if not text or not text.strip():
        return 0.5

    # Chunk long inputs to stay within the model context window.
    enc = _text_tokenizer(
        text,
        truncation=True,
        max_length=TEXT_MAX_LENGTH,
        stride=max(0, min(TEXT_STRIDE, TEXT_MAX_LENGTH - 1)),
        return_overflowing_tokens=True,
        return_attention_mask=True,
        return_tensors="pt",
    )

    input_ids = enc.get("input_ids")
    attention_mask = enc.get("attention_mask")
    if input_ids is None or attention_mask is None:
        raise RuntimeError("Tokenizer did not return required tensors")

    num_chunks = int(input_ids.shape[0])
    if num_chunks <= 0:
        return 0.5

    probs: list[float] = []
    with torch.no_grad():
        for start in range(0, num_chunks, max(1, TEXT_BATCH_SIZE)):
            end = min(num_chunks, start + max(1, TEXT_BATCH_SIZE))
            batch = {
                "input_ids": input_ids[start:end],
                "attention_mask": attention_mask[start:end],
            }
            outputs = _text_model(**batch)
            logits = outputs.logits
            p = torch.softmax(logits, dim=-1)

            fake_idx = int(_text_fake_index)
            if fake_idx < 0 or fake_idx >= int(p.shape[-1]):
                fake_idx = min(1, int(p.shape[-1]) - 1)

            chunk_fake = p[:, fake_idx].detach().cpu().tolist()
            probs.extend([float(x) for x in chunk_fake])

    fake_prob = float(sum(probs) / max(1, len(probs)))
    return max(0.0, min(1.0, fake_prob))


def _chunk_text(tokenizer, text: str, max_tokens: int, stride: int) -> list[str]:
    if not text or not text.strip():
        return [""]

    # Convert long text into overlapping chunks by token count.
    enc = tokenizer(
        text,
        truncation=True,
        max_length=max(8, int(max_tokens)),
        stride=max(0, min(int(stride), max(0, int(max_tokens) - 1))),
        return_overflowing_tokens=True,
        return_attention_mask=False,
        return_tensors="pt",
    )

    input_ids = enc.get("input_ids")
    if input_ids is None:
        return [text]

    chunks: list[str] = []
    for i in range(int(input_ids.shape[0])):
        chunks.append(tokenizer.decode(input_ids[i], skip_special_tokens=True))

    return chunks or [text]


def _score_news_fake_prob(text: str) -> float:
    if (
        _news_model is None
        or _news_tokenizer is None
        or _news_entailment_index is None
        or _news_contradiction_index is None
    ):
        raise RuntimeError("News model not loaded")

    try:
        import torch
    except Exception as e:  # pragma: no cover
        raise RuntimeError("torch is required for inference") from e

    import math

    premise_chunks = _chunk_text(
        _news_tokenizer,
        text,
        max_tokens=NEWS_PREMISE_MAX_TOKENS,
        stride=NEWS_STRIDE,
    )

    # IMPORTANT: MNLI is not a fact-checker. This is a heuristic classifier that
    # tends to pick up on *mismatch* between the writing and the hypothesis.
    hypotheses = [
        "This text is factual and verified news.",
        "This text is misinformation, a hoax, or fake news.",
    ]
    entail_idx = int(_news_entailment_index)
    contra_idx = int(_news_contradiction_index)

    probs: list[float] = []
    with torch.no_grad():
        for premise in premise_chunks:
            premises = [premise, premise]
            # Tokenize as sequence pairs (premise, hypothesis)
            batch = _news_tokenizer(
                premises,
                hypotheses,
                padding=True,
                truncation=True,
                max_length=max(16, int(NEWS_MAX_LENGTH)),
                return_tensors="pt",
            )

            outputs = _news_model(**batch)
            logits = outputs.logits
            p = torch.softmax(logits, dim=-1)
            if entail_idx < 0 or entail_idx >= int(p.shape[-1]):
                entail_idx = min(2, int(p.shape[-1]) - 1)
            if contra_idx < 0 or contra_idx >= int(p.shape[-1]):
                contra_idx = 0

            # Use a more stable NLI heuristic:
            # score(label) = P(entailment) - P(contradiction)
            s_real = float((p[0, entail_idx] - p[0, contra_idx]).item())
            s_fake = float((p[1, entail_idx] - p[1, contra_idx]).item())
            diff = (s_fake - s_real) * float(NEWS_LOGIT_SCALE)
            fake_prob = 1.0 / (1.0 + math.exp(-diff))
            probs.append(max(0.0, min(1.0, float(fake_prob))))

    fake_prob = float(sum(probs) / max(1, len(probs)))
    return max(0.0, min(1.0, fake_prob))


async def _ensure_clip_loaded() -> None:
    global _clip_model, _clip_processor, _face_detector

    if _clip_model is not None and _clip_processor is not None:
        return

    async with _clip_lock:
        if _clip_model is not None and _clip_processor is not None:
            return

        logger.info("Loading CLIP model: %s", MEDIA_MODEL_ID)

        try:
            from transformers import CLIPModel, CLIPProcessor
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "Missing ML dependencies. Install requirements.txt (transformers/torch/pillow/numpy/opencv/httpx)."
            ) from e

        def _load():
            model = CLIPModel.from_pretrained(MEDIA_MODEL_ID)
            processor = CLIPProcessor.from_pretrained(MEDIA_MODEL_ID)
            model.eval()
            return model, processor

        _clip_model, _clip_processor = await asyncio.to_thread(_load)

        await _ensure_face_detector_loaded()


async def _ensure_face_detector_loaded() -> None:
    global _face_detector
    if _face_detector is not None:
        return

    # Best-effort face detector used for both image (optional) and video (recommended).
    try:
        import cv2

        cascade_path = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
        detector = cv2.CascadeClassifier(cascade_path)
        if detector.empty():
            raise RuntimeError("OpenCV Haar cascade failed to load")
        _face_detector = detector
    except Exception as e:
        logger.warning("Face detector unavailable (opencv issue): %s", str(e))
        _face_detector = None


async def _ensure_video_deepfake_model_loaded() -> None:
    global _video_df_model, _video_df_processor, _video_df_fake_index

    if _video_df_model is not None and _video_df_processor is not None and _video_df_fake_index is not None:
        return

    async with _video_df_lock:
        if _video_df_model is not None and _video_df_processor is not None and _video_df_fake_index is not None:
            return

        logger.info("Loading video deepfake model: %s", VIDEO_DEEPFAKE_MODEL_ID)
        try:
            from transformers import AutoImageProcessor, AutoModelForImageClassification
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "Missing ML dependencies. Install requirements.txt (transformers/torch/pillow/numpy/opencv/httpx)."
            ) from e

        def _load():
            processor = AutoImageProcessor.from_pretrained(VIDEO_DEEPFAKE_MODEL_ID)
            model = AutoModelForImageClassification.from_pretrained(VIDEO_DEEPFAKE_MODEL_ID)
            model.eval()
            fake_index = _pick_fake_index(getattr(model.config, "id2label", None))
            return model, processor, fake_index

        _video_df_model, _video_df_processor, _video_df_fake_index = await asyncio.to_thread(_load)


def _clip_score_image_pil(image, mode: str) -> tuple[str, float]:
    prompts = _get_prompts(mode)
    all_prompts = prompts.real + prompts.fake

    from PIL import Image  # local import so service can start even if PIL missing

    if not isinstance(image, Image.Image):
        raise ValueError("Expected PIL.Image")

    inputs = _clip_processor(text=all_prompts, images=image, return_tensors="pt", padding=True)
    outputs = _clip_model(**inputs)

    try:
        import torch
    except Exception as e:  # pragma: no cover
        raise RuntimeError("torch is required for inference") from e

    # logits_per_image shape: (1, num_prompts)
    probs = torch.softmax(outputs.logits_per_image[0], dim=-1)
    fake_prob = float(probs[len(prompts.real) :].sum().item())
    fake_prob = max(0.0, min(1.0, fake_prob))

    if fake_prob >= MEDIA_THRESHOLD:
        return "Fake", fake_prob
    return "Real", 1.0 - fake_prob


def _maybe_crop_face(image_pil):
    if MEDIA_MODE != "deepfake-face" or _face_detector is None:
        return image_pil

    import cv2
    from PIL import Image

    try:
        import numpy as np
    except Exception as e:
        logger.warning("numpy missing; skipping face crop: %s", str(e))
        return image_pil

    img = np.array(image_pil.convert("RGB"))
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    faces = _face_detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    if faces is None or len(faces) == 0:
        return image_pil

    # pick largest face
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    pad = int(0.15 * max(w, h))
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(img.shape[1], x + w + pad)
    y1 = min(img.shape[0], y + h + pad)
    cropped = img[y0:y1, x0:x1]
    return Image.fromarray(cropped)


def _crop_largest_face(image_pil):
    """Crop the largest detected face; returns (image, found_face)."""
    if _face_detector is None:
        return image_pil, False

    import cv2
    from PIL import Image

    try:
        import numpy as np
    except Exception:
        return image_pil, False

    img = np.array(image_pil.convert("RGB"))
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    faces = _face_detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    if faces is None or len(faces) == 0:
        return image_pil, False

    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    pad = int(0.15 * max(w, h))
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(img.shape[1], x + w + pad)
    y1 = min(img.shape[0], y + h + pad)
    cropped = img[y0:y1, x0:x1]
    return Image.fromarray(cropped), True


def _score_deepfake_frame_fake_prob(image_pil) -> float:
    if _video_df_model is None or _video_df_processor is None or _video_df_fake_index is None:
        raise RuntimeError("Video deepfake model not loaded")

    try:
        import torch
    except Exception as e:  # pragma: no cover
        raise RuntimeError("torch is required for inference") from e

    inputs = _video_df_processor(images=image_pil, return_tensors="pt")
    with torch.no_grad():
        outputs = _video_df_model(**inputs)
        logits = outputs.logits
        probs = torch.softmax(logits, dim=-1)[0]

    fake_idx = int(_video_df_fake_index)
    if fake_idx < 0 or fake_idx >= int(probs.shape[-1]):
        fake_idx = min(1, int(probs.shape[-1]) - 1)

    fake_prob = float(probs[fake_idx].detach().cpu().item())
    return max(0.0, min(1.0, fake_prob))


async def _download_video(url: str) -> str:
    logger.info("Downloading video: %s", url)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    tmp_path = tmp.name
    tmp.close()

    downloaded = 0
    try:
        try:
            import httpx
        except Exception as e:  # pragma: no cover
            raise HTTPException(status_code=500, detail="httpx is required to download video URLs") from e

        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            async with client.stream("GET", url) as resp:
                resp.raise_for_status()
                with open(tmp_path, "wb") as f:
                    async for chunk in resp.aiter_bytes(chunk_size=1024 * 256):
                        if not chunk:
                            continue
                        downloaded += len(chunk)
                        if downloaded > MAX_DOWNLOAD_BYTES:
                            raise HTTPException(status_code=413, detail="Video too large")
                        f.write(chunk)

        return tmp_path
    except HTTPException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise
    except Exception as e:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise HTTPException(status_code=400, detail=f"Failed to download video: {str(e)}") from e


def _sample_frames(video_path: str, max_frames: int) -> list:
    import cv2

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Unable to open video")

    fps = cap.get(cv2.CAP_PROP_FPS)
    stride = VIDEO_FRAME_STRIDE
    if fps and fps > 0:
        # approx 1 fps sampling
        stride = max(1, int(round(fps)))

    frames: list = []
    frame_idx = 0
    while len(frames) < max_frames:
        ok, frame_bgr = cap.read()
        if not ok:
            break
        if frame_idx % stride == 0:
            frames.append(frame_bgr)
        frame_idx += 1

    cap.release()
    return frames


def _bgr_to_pil(frame_bgr):
    import cv2
    from PIL import Image

    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "mediaMode": MEDIA_MODE,
        "mediaModelId": MEDIA_MODEL_ID,
        "videoDeepfakeModelId": VIDEO_DEEPFAKE_MODEL_ID,
        "textModelId": TEXT_MODEL_ID,
        "newsModelId": NEWS_MODEL_ID,
    }


@app.post("/text", response_model=DetectResponse)
async def detect_text(payload: TextRequest) -> DetectResponse:
    logger.info("/text request received (len=%s)", len(payload.text))
    try:
        await _ensure_text_model_loaded()
    except Exception as e:
        logger.exception("Text model load failed")
        raise HTTPException(
            status_code=503,
            detail=(
                "Text model unavailable. Install ml-service requirements and restart uvicorn. "
                f"Error: {str(e)}"
            ),
        ) from e

    try:
        fake_prob = await asyncio.to_thread(_score_text_fake_prob, payload.text)
    except Exception as e:
        logger.exception("Text inference failed")
        raise HTTPException(status_code=500, detail=f"Text inference failed: {str(e)}") from e

    if fake_prob >= TEXT_THRESHOLD:
        return DetectResponse(result="Fake", confidence=float(fake_prob))
    return DetectResponse(result="Real", confidence=float(1.0 - fake_prob))


@app.post("/news", response_model=DetectResponse)
async def detect_news(payload: TextRequest) -> DetectResponse:
    logger.info("/news request received (len=%s)", len(payload.text))
    try:
        await _ensure_news_model_loaded()
    except Exception as e:
        logger.exception("News model load failed")
        raise HTTPException(
            status_code=503,
            detail=(
                "News model unavailable. Install ml-service requirements and restart uvicorn. "
                f"Error: {str(e)}"
            ),
        ) from e

    try:
        fake_prob = await asyncio.to_thread(_score_news_fake_prob, payload.text)
    except Exception as e:
        logger.exception("News inference failed")
        raise HTTPException(status_code=500, detail=f"News inference failed: {str(e)}") from e

    if fake_prob >= NEWS_THRESHOLD:
        return DetectResponse(result="Fake", confidence=float(fake_prob))
    return DetectResponse(result="Real", confidence=float(1.0 - fake_prob))


@app.post("/image", response_model=DetectResponse)
async def detect_image(file: UploadFile = File(...)) -> DetectResponse:
    logger.info("/image upload received (filename=%s, content_type=%s)", file.filename, file.content_type)
    try:
        await _ensure_clip_loaded()
    except Exception as e:
        logger.exception("CLIP load failed")
        raise HTTPException(
            status_code=503,
            detail=(
                "Media model unavailable. Install ml-service requirements and restart uvicorn. "
                f"Error: {str(e)}"
            ),
        ) from e

    try:
        from PIL import Image
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail="Pillow is required for image processing") from e

    try:
        data = await file.read()
        image = await asyncio.to_thread(lambda: Image.open(io.BytesIO(data)).convert("RGB"))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}") from e

    image = _maybe_crop_face(image)

    try:
        result, confidence = await asyncio.to_thread(_clip_score_image_pil, image, MEDIA_MODE)
    except Exception as e:
        logger.exception("Image inference failed")
        raise HTTPException(status_code=500, detail=f"Image inference failed: {str(e)}") from e

    return DetectResponse(result=result, confidence=float(confidence))


@app.post("/video", response_model=DetectResponse)
async def detect_video(payload: VideoRequest) -> DetectResponse:
    logger.info("/video request received (url=%s)", str(payload.videoUrl))
    try:
        await _ensure_video_deepfake_model_loaded()
        await _ensure_face_detector_loaded()
    except Exception as e:
        logger.exception("Video deepfake model load failed")
        raise HTTPException(
            status_code=503,
            detail=(
                "Video deepfake model unavailable. Install ml-service requirements and restart uvicorn. "
                f"Error: {str(e)}"
            ),
        ) from e

    video_path = await _download_video(str(payload.videoUrl))
    try:
        frames = await asyncio.to_thread(_sample_frames, video_path, VIDEO_MAX_FRAMES)
        if not frames:
            raise HTTPException(status_code=400, detail="No frames could be read from video")

        face_probs: list[float] = []
        nonface_probs: list[float] = []
        for frame in frames:
            pil_img = _bgr_to_pil(frame)
            cropped, found_face = _crop_largest_face(pil_img)
            p = await asyncio.to_thread(_score_deepfake_frame_fake_prob, cropped)
            if found_face:
                face_probs.append(float(p))
            else:
                nonface_probs.append(float(p))

        # Prefer frames where we actually detected a face.
        probs = face_probs if face_probs else nonface_probs
        if not probs:
            raise HTTPException(status_code=400, detail="No usable frames found for deepfake analysis")

        fake_prob = float(sum(probs) / max(1, len(probs)))
        fake_prob = max(0.0, min(1.0, fake_prob))
        if fake_prob >= VIDEO_DEEPFAKE_THRESHOLD:
            return DetectResponse(result="Fake", confidence=fake_prob)
        return DetectResponse(result="Real", confidence=1.0 - fake_prob)
    finally:
        try:
            os.unlink(video_path)
        except OSError:
            pass


# Needed for image bytes parsing
import io
