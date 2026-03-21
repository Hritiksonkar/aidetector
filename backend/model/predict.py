import io
import math
from typing import Any

import cv2
import numpy as np
from PIL import Image


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def _entropy_from_hist(hist: np.ndarray) -> float:
    # hist: counts, shape (bins,)
    total = float(np.sum(hist))
    if total <= 0:
        return 0.0
    p = hist.astype(np.float64) / total
    p = p[p > 0]
    return float(-np.sum(p * np.log2(p)))


def _compute_metrics(rgb: np.ndarray) -> dict[str, float]:
    """Compute lightweight metrics from an RGB uint8 image."""
    if rgb.dtype != np.uint8:
        rgb = rgb.astype(np.uint8)

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)

    # Sharpness: Laplacian variance
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    lap_var = float(lap.var())

    # High-frequency residual "noise" estimate
    blur = cv2.GaussianBlur(gray, (0, 0), sigmaX=1.2)
    resid = cv2.absdiff(gray, blur)
    noise_std = float(np.std(resid))

    # Edge density
    edges = cv2.Canny(gray, 60, 160)
    edge_density = float(np.mean(edges > 0))

    # Grayscale entropy (texture variety)
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
    entropy = _entropy_from_hist(hist)

    return {
        "lap_var": lap_var,
        "noise_std": noise_std,
        "edge_density": edge_density,
        "entropy": entropy,
    }


def _realness_from_metrics(m: dict[str, float]) -> float:
    """Return a realness score in [0, 1] (heuristic).

    Note: This is NOT a trained detector; it's a lightweight heuristic intended
    for demo scoring and relative comparisons.
    """
    # Normalize with soft/log scaling to avoid extreme sensitivity.
    sharp = _clamp01((math.log1p(m["lap_var"]) - math.log1p(15.0)) / (math.log1p(350.0) - math.log1p(15.0)))
    noise = _clamp01((m["noise_std"] - 1.2) / 6.0)
    edges = _clamp01((m["edge_density"] - 0.01) / 0.10)
    ent = _clamp01((m["entropy"] - 4.2) / 2.2)

    # Weighted blend. Bias slightly toward conservative scoring on compressed media.
    realness = 0.30 * noise + 0.25 * ent + 0.25 * sharp + 0.20 * edges
    return _clamp01(realness)


def _score_0_to_10_from_rgb(rgb: np.ndarray) -> float:
    m = _compute_metrics(rgb)
    realness = _realness_from_metrics(m)
    return float(round(realness * 10.0, 1))

def predict_image(image_bytes: bytes) -> tuple[float, str]:
    """
    Analyzes an image and returns a probability score (0-10) and prediction class.
    Score: 0 - 3  → AI Generated
    Score: 4 - 6  → Suspicious
    Score: 7 - 10 → Real
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    rgb = np.array(img)
    score = _score_0_to_10_from_rgb(rgb)

    if score <= 3:
        prediction = "AI Generated"
    elif score <= 6:
        prediction = "Suspicious"
    else:
        prediction = "Real"

    return score, prediction

def predict_frame(frame: np.ndarray) -> float:
    # `frame` is expected RGB uint8
    return max(0.0, min(10.0, _score_0_to_10_from_rgb(frame)))
