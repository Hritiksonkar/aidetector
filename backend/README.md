# Truth Shield Backend

Node.js + Express + MongoDB backend for Truth Shield.

## Setup

1. Create an env file:

- Copy `.env.example` to `.env`
- Set `MONGO_URI`, `JWT_SECRET`, `PYTHON_AI_SERVICE_URL`

2. Install and run:

```bash
npm install
npm run dev
```

Backend runs on `http://localhost:5000` by default.

## Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/detect/upload` (auth, multipart field name: `file`)
- `POST /api/detect/url` (auth, JSON body: `{ "url": "https://..." }`)
- `GET /api/detect/history` (auth)

Uploads are served from `GET /uploads/<filename>`.

## Video link scanning

`POST /api/detect/url` supports:

- Direct video file URLs (e.g. `https://.../video.mp4`, `video.webm`)
- Platform page links (YouTube/Instagram/Facebook) by downloading the video server-side via `yt-dlp`

Notes:

- Some platforms require login/cookies for certain videos; public links work best.
- The server blocks localhost/private-network URLs to reduce SSRF risk.

## Python AI service

This backend expects a FastAPI service with `POST /detect` returning `{ "score": <0..10> }`.

See `python_service/`.
