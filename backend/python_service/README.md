# Truth Shield Python AI Service

FastAPI microservice that exposes `POST /detect` and returns a score in the range `0..10`.

Response shape:

```json
{ "score": 3.2, "source": "heuristic" }
```

If Gemini is enabled (images only), the response may include:

```json
{ "score": 4.7, "source": "gemini", "explanation": "..." }
```

## Run (local)

```bash
cd python_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

## Enable Gemini (optional)

Set an environment variable and restart `uvicorn`:

```powershell
$env:GEMINI_API_KEY = "<your key>"
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

Notes:
- Gemini scoring is only attempted for images; videos fall back to the heuristic.
- If `GEMINI_API_KEY` is not set (or a Gemini request fails), the service automatically falls back to the heuristic.

This implementation is a lightweight heuristic placeholder. Replace `_score_from_image_bytes` / `_score_from_video_bytes` with real model inference (PyTorch, etc.) when ready.
