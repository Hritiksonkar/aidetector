import os
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

# Always load backend/.env (works even if you start uvicorn from repo root)
load_dotenv(dotenv_path=Path(__file__).with_name(".env"), override=True)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import detect

app = FastAPI(
    title="Truth Shield API",
    description="AI vs Real Detector Backend",
    version="1.0.0",
)

# CORS (minimal defaults + env overrides)
cors_allow_origins_env = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
cors_allow_origin_regex = os.getenv("CORS_ALLOW_ORIGIN_REGEX")


def _normalize_origin(origin: str) -> str | None:
    origin = (origin or "").strip()
    if not origin:
        return None
    # If someone accidentally pastes a full URL (with path/query), keep only scheme + host.
    parsed = urlparse(origin)
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return origin.rstrip("/")

allow_origins = (
    [o for o in (_normalize_origin(x) for x in cors_allow_origins_env.split(",")) if o]
    if cors_allow_origins_env
    else ["https://aidetector-sandy.vercel.app"]
)

# Dev-friendly: allow any localhost port unless explicitly overridden
if cors_allow_origin_regex is None:
    cors_allow_origin_regex = r"^http://(localhost|127\\.0\\.0\\.1):\\d+$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=cors_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint for health check
@app.get("/")
def read_root():
    return {"status": "ok", "message": "Truth Shield AI Detector Backend is running"}

# Register Detection Route
app.include_router(detect.router)

if __name__ == "__main__":
    import uvicorn
    # Make sure to run with uvicorn main:app --reload in dev environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
