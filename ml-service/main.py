from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

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
VIDEO_MAX_HEIGHT = _env_int("VIDEO_MAX_HEIGHT", 480)
VIDEO_FRAME_MAX_SIDE = _env_int("VIDEO_FRAME_MAX_SIDE", 720)

# Deepfake video detection (frame-based)
VIDEO_DEEPFAKE_MODEL_ID = _env("VIDEO_DEEPFAKE_MODEL_ID", "dima806/deepfake_vs_real_image_detection")
VIDEO_DEEPFAKE_THRESHOLD = _env_float("VIDEO_DEEPFAKE_THRESHOLD", 0.50)
VIDEO_AGGREGATION = _env("VIDEO_AGGREGATION", "topk")  # mean | max | topk
VIDEO_TOPK_FRACTION = _env_float("VIDEO_TOPK_FRACTION", 0.33)

TEXT_MODEL_ID = _env("TEXT_MODEL_ID", "openai-community/roberta-large-openai-detector")
TEXT_THRESHOLD = _env_float("TEXT_THRESHOLD", 0.50)
TEXT_MAX_LENGTH = _env_int("TEXT_MAX_LENGTH", 512)
TEXT_STRIDE = _env_int("TEXT_STRIDE", 128)
TEXT_BATCH_SIZE = _env_int("TEXT_BATCH_SIZE", 8)
TEXT_AGGREGATION = _env("TEXT_AGGREGATION", "topk")  # mean | max | topk
TEXT_TOPK_FRACTION = _env_float("TEXT_TOPK_FRACTION", 0.30)

NEWS_MODEL_ID = _env("NEWS_MODEL_ID", "facebook/bart-large-mnli")
NEWS_THRESHOLD = _env_float("NEWS_THRESHOLD", 0.50)
NEWS_MAX_LENGTH = _env_int("NEWS_MAX_LENGTH", 1024)
NEWS_PREMISE_MAX_TOKENS = _env_int("NEWS_PREMISE_MAX_TOKENS", 768)
NEWS_STRIDE = _env_int("NEWS_STRIDE", 128)
NEWS_BATCH_SIZE = _env_int("NEWS_BATCH_SIZE", 4)
NEWS_LOGIT_SCALE = _env_float("NEWS_LOGIT_SCALE", 5.0)
NEWS_AGGREGATION = _env("NEWS_AGGREGATION", "topk")  # mean | max | topk
NEWS_TOPK_FRACTION = _env_float("NEWS_TOPK_FRACTION", 0.33)


app = FastAPI(title="Fake Content Detection ML Service", version="1.2.0")

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
    videoUrl: str = Field(min_length=3, max_length=2000)

    @field_validator("videoUrl")
    @classmethod
    def _normalize_video_url(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("videoUrl is required")
        if s.startswith("//"):
            s = f"https:{s}"
        if not re.match(r"^https?://", s, flags=re.IGNORECASE):
            s = f"https://{s}"
        return s


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


def _aggregate_probs(probs: list[float], mode: str, topk_fraction: float) -> float:
    if not probs:
        return 0.5

    # Normalize and clamp.
    clamped = [max(0.0, min(1.0, float(p))) for p in probs]
    m = (mode or "mean").strip().lower()

    if m == "max":
        return float(max(clamped))

    if m == "topk":
        frac = max(0.05, min(1.0, float(topk_fraction)))
        k = max(1, int(round(len(clamped) * frac)))
        # Average the strongest fake signals.
        top = sorted(clamped, reverse=True)[:k]
        return float(sum(top) / max(1, len(top)))

    # default: mean
    return float(sum(clamped) / max(1, len(clamped)))


async def _ensure_text_model_loaded() -> None:
    global _text_model, _text_tokenizer, _text_fake_index

    if _text_model is not None and _text_tokenizer is not None and _text_fake_index is not None:
        return

    async with _text_lock:
        if _text_model is not None and _text_tokenizer is not None and _text_fake_index is not None:
            return

        model_id = TEXT_MODEL_ID

        logger.info("Loading text detector model: %s", model_id)

        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
        except Exception as e:  # pragma: no cover
            raise RuntimeError(
                "Missing ML dependencies. Install requirements.txt (transformers/torch)."
            ) from e

        def _load():
            try:
                tok = AutoTokenizer.from_pretrained(model_id, local_files_only=True)
                model = AutoModelForSequenceClassification.from_pretrained(model_id, local_files_only=True)
            except Exception:
                tok = AutoTokenizer.from_pretrained(model_id)
                model = AutoModelForSequenceClassification.from_pretrained(model_id)

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

    fake_prob = _aggregate_probs(probs, TEXT_AGGREGATION, TEXT_TOPK_FRACTION)
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


def _normalize_news_text(text: str) -> str:
    if not text:
        return ""

    # Light cleanup to reduce boilerplate effects from pasted web pages.
    t = text.strip()
    t = re.sub(r"\s+", " ", t)
    # Remove long runs of URLs which can confuse NLI heuristics.
    t = re.sub(r"https?://\S+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _sigmoid(x: float) -> float:
    import math

    try:
        return 1.0 / (1.0 + math.exp(-float(x)))
    except OverflowError:
        return 0.0 if x < 0 else 1.0


def _score_news_chunk_fake_prob(premise: str) -> float:
    """Score a single premise chunk using the MNLI model.

    Uses multiple hypotheses and takes the strongest signal.
    """

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

    premise = (premise or "").strip()
    if not premise:
        return 0.5

    # IMPORTANT: MNLI is not a fact-checker. This is a heuristic NLI model.
    # We try to reduce false "Real" by using several fake-news-like hypotheses
    # and aggregating via max/top-k over chunks.
    real_hypotheses = [
        "This text is factual and verified news reporting.",
        "This text accurately reports real events.",
    ]
    fake_hypotheses = [
        "This text contains misinformation or false claims.",
        "This text is a hoax or fake news.",
        "This text is propaganda designed to mislead.",
        "This text is sensational clickbait that exaggerates facts.",
        "This text is satire or parody and not factual.",
        "This text presents conspiracy theories as facts.",
    ]

    entail_idx = int(_news_entailment_index)
    contra_idx = int(_news_contradiction_index)

    all_h = real_hypotheses + fake_hypotheses
    premises = [premise] * len(all_h)
    batch = _news_tokenizer(
        premises,
        all_h,
        padding=True,
        truncation=True,
        max_length=max(16, int(NEWS_MAX_LENGTH)),
        return_tensors="pt",
    )

    with torch.no_grad():
        outputs = _news_model(**batch)
        logits = outputs.logits
        p = torch.softmax(logits, dim=-1)

    if entail_idx < 0 or entail_idx >= int(p.shape[-1]):
        entail_idx = min(2, int(p.shape[-1]) - 1)
    if contra_idx < 0 or contra_idx >= int(p.shape[-1]):
        contra_idx = 0

    # Stable heuristic per hypothesis: score = P(entailment) - P(contradiction)
    scores = (p[:, entail_idx] - p[:, contra_idx]).detach().cpu().tolist()
    scores = [float(s) for s in scores]

    real_scores = scores[: len(real_hypotheses)]
    fake_scores = scores[len(real_hypotheses) :]

    s_real = max(real_scores) if real_scores else 0.0
    s_fake = max(fake_scores) if fake_scores else 0.0
    diff = (s_fake - s_real) * float(NEWS_LOGIT_SCALE)
    return max(0.0, min(1.0, float(_sigmoid(diff))))


def _score_news_fake_prob(text: str) -> float:
    clean = _normalize_news_text(text)
    premise_chunks = _chunk_text(
        _news_tokenizer,
        clean,
        max_tokens=NEWS_PREMISE_MAX_TOKENS,
        stride=NEWS_STRIDE,
    )

    probs: list[float] = []
    for premise in premise_chunks:
        probs.append(_score_news_chunk_fake_prob(premise))

    fake_prob = _aggregate_probs(probs, NEWS_AGGREGATION, NEWS_TOPK_FRACTION)
    return max(0.0, min(1.0, float(fake_prob)))


async def _download_video_direct(url: str, tmp_dir: str) -> str | None:
    """Direct-download video if the URL is already a video file.

    This avoids yt-dlp and reduces failures on plain .mp4 links.
    """

    try:
        import httpx
    except Exception:
        return None

    u = (url or "").strip()
    if not u:
        return None

    def _looks_like_video_url() -> bool:
        lower = u.lower()
        return any(x in lower for x in [".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi"])

    headers = {"User-Agent": "aidetector/1.2"}
    timeout = httpx.Timeout(30.0, connect=30.0)

    async with httpx.AsyncClient(follow_redirects=True, timeout=timeout, headers=headers) as client:
        head = None
        try:
            head = await client.head(u)
        except Exception:
            head = None

        if head is not None:
            try:
                sc = int(head.status_code)
            except Exception:
                sc = 0
            if sc in {401, 403}:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Video download blocked (private / login required). "
                        "Please provide a public, direct video file URL (e.g. .mp4)."
                    ),
                )

        content_type = ""
        content_length = 0
        if head is not None and hasattr(head, "headers"):
            content_type = str(head.headers.get("content-type", ""))
            try:
                content_length = int(head.headers.get("content-length") or 0)
            except Exception:
                content_length = 0

        if content_length and content_length > int(MAX_DOWNLOAD_BYTES):
            raise HTTPException(status_code=413, detail="Video too large")

        if not (
            _looks_like_video_url()
            or (content_type and content_type.lower().startswith("video/"))
            or (content_type and "application/octet-stream" in content_type.lower())
        ):
            return None

        out_path = os.path.join(tmp_dir, "direct.mp4")
        total = 0
        try:
            async with client.stream("GET", u) as resp:
                if int(resp.status_code) in {401, 403}:
                    raise HTTPException(
                        status_code=403,
                        detail=(
                            "Video download blocked (private / login required). "
                            "Please provide a public, direct video file URL (e.g. .mp4)."
                        ),
                    )
                resp.raise_for_status()
                with open(out_path, "wb") as f:
                    async for chunk in resp.aiter_bytes():
                        if not chunk:
                            continue
                        total += len(chunk)
                        if total > int(MAX_DOWNLOAD_BYTES):
                            raise HTTPException(status_code=413, detail="Video too large")
                        f.write(chunk)
        except HTTPException:
            raise
        except Exception:
            return None

        return out_path if os.path.isfile(out_path) else None


def _find_ffmpeg() -> str | None:
    return shutil.which("ffmpeg")


def _transcode_to_mp4_with_ffmpeg(input_path: str, output_path: str) -> None:
    ffmpeg = _find_ffmpeg()
    if not ffmpeg:
        raise RuntimeError("ffmpeg not found")

    # Re-encode video-only to maximize OpenCV compatibility.
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        input_path,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "28",
        "-movflags",
        "+faststart",
        output_path,
    ]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        stderr = (p.stderr or "").strip()
        raise RuntimeError(f"ffmpeg transcode failed: {stderr[-800:]}")


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
    """Download a remote video URL to a local temp file.

    Uses yt-dlp so that common "share" URLs (YouTube/Instagram/etc.) work.
    Returns the downloaded file path.
    """

    logger.info("Downloading video via yt-dlp: %s", url)

    tmp_dir = tempfile.mkdtemp(prefix="aidetector-video-")
    outtmpl = os.path.join(tmp_dir, "%(id)s.%(ext)s")

    try:
        try:
            from yt_dlp import YoutubeDL
        except Exception as e:  # pragma: no cover
            raise HTTPException(status_code=500, detail="yt-dlp is required to download video URLs") from e

        direct = await _download_video_direct(url, tmp_dir)
        if direct:
            return direct

        ffmpeg = _find_ffmpeg()

        def _download() -> str:
            def _strip_ansi(s: str) -> str:
                return re.sub(r"\x1b\[[0-9;]*m", "", s)

            def _is_private_or_login_error(msg: str) -> bool:
                m = (msg or "").lower()
                return any(
                    s in m
                    for s in [
                        "private video",
                        "this video is private",
                        "members-only",
                        "login required",
                        "sign in to confirm",
                        "sign in to view",
                        "please sign in",
                        "account is private",
                        "requested content is not available",
                        "http error 403",
                        "403 forbidden",
                        "status code: 403",
                        "status 403",
                        "authentication",
                    ]
                )

            def _find_downloaded_file(download_root: str) -> str | None:
                candidates: list[str] = []
                for root, _, filenames in os.walk(download_root):
                    for name in filenames:
                        lower = name.lower()
                        if lower.endswith(('.part', '.ytdl', '.json', '.webp', '.jpg', '.png')):
                            continue
                        full = os.path.join(root, name)
                        if os.path.isfile(full):
                            candidates.append(full)

                if not candidates:
                    return None

                # Pick the largest file (usually the actual media output).
                candidates.sort(key=lambda p: os.path.getsize(p), reverse=True)
                return candidates[0]

            base_opts = {
                "outtmpl": outtmpl,
                "noplaylist": True,
                "quiet": True,
                "no_warnings": True,
                "retries": 3,
                "socket_timeout": 30,
                "max_filesize": MAX_DOWNLOAD_BYTES,
            }

            if ffmpeg:
                # If ffmpeg is present, allow merging (video+audio) and force mp4 output.
                base_opts = {
                    **base_opts,
                    "merge_output_format": "mp4",
                }

            # Try a couple of format selectors.
            # For YouTube/Insta we only need VIDEO frames, so prefer a VIDEO-ONLY stream.
            # Prefer mp4 first, but allow other formats; we'll transcode later if needed.
            # If ffmpeg is available, try bestvideo+bestaudio to maximize availability.
            format_candidates: list[str] = []
            if ffmpeg:
                format_candidates.extend(
                    [
                        f"bestvideo[height<={VIDEO_MAX_HEIGHT}]+bestaudio/best[height<={VIDEO_MAX_HEIGHT}]",
                        "bestvideo+bestaudio/best",
                    ]
                )
            format_candidates.extend(
                [
                    f"bestvideo[ext=mp4][height<={VIDEO_MAX_HEIGHT}]/bestvideo[ext=mp4]/bestvideo",
                    f"bv*[ext=mp4][height<={VIDEO_MAX_HEIGHT}]/bv*[ext=mp4]/bv*",
                    "best[ext=mp4]/bestvideo[ext=mp4]/best",
                    "best",
                ]
            )

            last_error: Exception | None = None
            for fmt in format_candidates:
                ydl_opts = {**base_opts, "format": fmt}
                try:
                    with YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(url, download=True)
                        if isinstance(info, dict) and "entries" in info and info.get("entries"):
                            # Safety fallback if a playlist slips through.
                            info = info["entries"][0]

                        if isinstance(info, dict):
                            req = info.get("requested_downloads")
                            if isinstance(req, list) and len(req) > 0:
                                fp = req[0].get("filepath")
                                if fp and os.path.isfile(fp):
                                    return str(fp)

                            # Sometimes yt-dlp doesn't report a stable final path (e.g., HLS/native downloads).
                            prepared = str(ydl.prepare_filename(info))
                            if prepared and os.path.isfile(prepared):
                                return prepared

                            found = _find_downloaded_file(tmp_dir)
                            if found:
                                return found

                            raise RuntimeError("yt-dlp finished but no output media file was found")

                        raise RuntimeError("yt-dlp did not return a downloadable item")
                except Exception as e:
                    last_error = e
                    msg = _strip_ansi(str(e)).lower()
                    if _is_private_or_login_error(msg):
                        raise HTTPException(
                            status_code=403,
                            detail=(
                                "Video is private / login required, so it cannot be downloaded. "
                                "Please provide a public, direct video file URL (e.g. .mp4)."
                            ),
                        )
                    if "max-filesize" in msg or "larger than max-filesize" in msg:
                        raise HTTPException(status_code=413, detail="Video too large")
                    # If the requested format isn't available, retry with the next candidate.
                    if "requested format is not available" in msg or "format is not available" in msg:
                        continue
                    raise

            if last_error is not None:
                raise RuntimeError(_strip_ansi(str(last_error)))
            raise RuntimeError("yt-dlp failed to download")

        video_path = await asyncio.to_thread(_download)
        if not os.path.isfile(video_path):
            raise HTTPException(status_code=400, detail="yt-dlp did not produce a video file")

        return video_path

    except HTTPException:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Failed to download video: {str(e)}") from e


def _sample_frames(video_path: str, max_frames: int) -> list:
    import cv2

    try:
        import numpy as np
    except Exception:
        np = None

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Unable to open video")

    frames: list = []

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if total > 0 and np is not None:
        # Evenly sample across the full duration.
        count = min(int(max_frames), total)
        idxs = np.linspace(0, total - 1, num=count, dtype=int).tolist()
        # Ensure unique, sorted indices.
        idxs = sorted(set(int(i) for i in idxs if i is not None))
        for idx in idxs:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ok, frame_bgr = cap.read()
            if ok:
                frames.append(frame_bgr)
    else:
        fps = cap.get(cv2.CAP_PROP_FPS)
        stride = VIDEO_FRAME_STRIDE
        if fps and fps > 0:
            # approx 1 fps sampling
            stride = max(1, int(round(fps)))

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

    if VIDEO_FRAME_MAX_SIDE and VIDEO_FRAME_MAX_SIDE > 0:
        h, w = frame_bgr.shape[:2]
        max_side = max(h, w)
        if max_side > int(VIDEO_FRAME_MAX_SIDE):
            scale = float(VIDEO_FRAME_MAX_SIDE) / float(max_side)
            new_w = max(1, int(round(w * scale)))
            new_h = max(1, int(round(h * scale)))
            frame_bgr = cv2.resize(frame_bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)

    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "mediaMode": MEDIA_MODE,
        "mediaModelId": MEDIA_MODEL_ID,
        "videoDeepfakeModelId": VIDEO_DEEPFAKE_MODEL_ID,
        "videoAggregation": VIDEO_AGGREGATION,
        "textModelId": TEXT_MODEL_ID,
        "textAggregation": TEXT_AGGREGATION,
        "newsModelId": NEWS_MODEL_ID,
        "newsAggregation": NEWS_AGGREGATION,
        "newsTopkFraction": NEWS_TOPK_FRACTION,
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

    real_prob = float(max(0.0, min(1.0, 1.0 - float(fake_prob))))
    fake_prob = float(max(0.0, min(1.0, float(fake_prob))))

    # Choose the label with the higher probability (argmax).
    if fake_prob >= real_prob:
        return DetectResponse(result="Fake", confidence=fake_prob)
    return DetectResponse(result="Real", confidence=real_prob)


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

    real_prob = float(max(0.0, min(1.0, 1.0 - float(fake_prob))))
    fake_prob = float(max(0.0, min(1.0, float(fake_prob))))

    if fake_prob >= real_prob:
        return DetectResponse(result="Fake", confidence=fake_prob)
    return DetectResponse(result="Real", confidence=real_prob)


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
    video_dir = os.path.dirname(video_path)
    try:
        try:
            frames = await asyncio.to_thread(_sample_frames, video_path, VIDEO_MAX_FRAMES)
        except HTTPException:
            raise
        except Exception as e:
            # Retry once by transcoding to mp4 if ffmpeg is available (helps with webm/mkv codecs).
            ffmpeg = _find_ffmpeg()
            if ffmpeg:
                try:
                    transcoded = os.path.join(video_dir, "transcoded.mp4")
                    await asyncio.to_thread(_transcode_to_mp4_with_ffmpeg, video_path, transcoded)
                    frames = await asyncio.to_thread(_sample_frames, transcoded, VIDEO_MAX_FRAMES)
                    video_path = transcoded
                except Exception:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "Unable to read video frames from the provided URL (codec/container issue). "
                            "Please provide a direct, publicly accessible .mp4 file URL."
                        ),
                    ) from e
            else:
                # Common case: user provides a non-video URL (e.g., YouTube page) or an unsupported format/codec.
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Unable to read video frames from the provided URL. "
                        "Please provide a direct, publicly accessible .mp4 file URL. "
                        "(Tip: installing ffmpeg can improve compatibility for non-mp4 formats.)"
                    ),
                ) from e
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

        fake_prob = _aggregate_probs([float(p) for p in probs], VIDEO_AGGREGATION, VIDEO_TOPK_FRACTION)
        if fake_prob >= VIDEO_DEEPFAKE_THRESHOLD:
            return DetectResponse(result="Fake", confidence=fake_prob)
        return DetectResponse(result="Real", confidence=1.0 - fake_prob)
    finally:
        try:
            os.unlink(video_path)
        except OSError:
            pass
        try:
            shutil.rmtree(video_dir, ignore_errors=True)
        except OSError:
            pass


# Needed for image bytes parsing
import io
