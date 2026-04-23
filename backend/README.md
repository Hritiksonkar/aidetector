# Backend (Express)

## Run

```bash
npm install
node server.js
```

## Environment

- Backend loads environment variables from `backend/.env`.
- To configure, copy `backend/.env.example` to `backend/.env` and edit values.

Required only for image detection:
- `SIGHTENGINE_USER`
- `SIGHTENGINE_SECRET`

Make sure the ML service is running at `http://127.0.0.1:8000` (default).

## Endpoints

- POST `/api/detect/text` `{ "text": "..." }`
- POST `/api/detect/news` `{ "text": "..." }`
- POST `/api/detect/video` `{ "videoUrl": "https://..." }`
- POST `/api/detect/image` multipart field `image` (uses Sightengine)
