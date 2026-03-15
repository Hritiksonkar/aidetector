# Truth Shield - AI Content Detector

A full-stack application for detecting AI-generated images and videos using Node.js, React, and a Python-based AI service.

## 🚀 Getting Started

To run the entire application (Frontend, Backend, and Python Service) with a single command, use:

```bash
npm run dev
```

> **Note:** This requires `npx` (comes with Node.js) and assumes the Python virtual environment is located at `./.venv`.

### Individual Services

If you prefer to start them separately:

1. **Backend (Node.js)**: `cd backend && npm run dev` (Port 5000)
2. **Frontend (Vite/React)**: `cd frontend && npm run dev` (Port 5173)
3. **Python AI Service**: `cd backend/python_service && ..\..\.venv\Scripts\uvicorn main:app --host 127.0.0.1 --port 8001 --reload`

## 🛠 Project Structure

- `/frontend`: React application (Vite, TailwindCSS, Framer Motion)
- `/backend`: Node.js/Express API (Auth, File Management, AI Proxy)
- `/backend/python_service`: FastAPI service for AI analysis (Gemini & Heuristics)
- `/.venv`: Python virtual environment with necessary dependencies
