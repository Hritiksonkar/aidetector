# Backend (Express)

## Run

```bash
npm install
node server.js
```

## Endpoints

- POST `/api/detect/text` `{ "text": "..." }`
- POST `/api/detect/video` `{ "videoUrl": "https://..." }`
- POST `/api/detect/image` multipart field `image`
