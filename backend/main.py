from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import detect

app = FastAPI(
    title="Truth Shield API",
    description="AI vs Real Detector Backend",
    version="1.0.0",
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "https://aidetector-sandy.vercel.app"
    ],
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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
