from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from typing import Dict, Any, Optional
import numpy as np
import requests
import time
import asyncio
from model.predict import predict_image, predict_frame
from utils.video import extract_frames
from utils.storage import upload_media
from utils.social import download_social_media
from database.db import log_prediction

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.mp4', '.mov')

@router.post("/detect")
async def detect(
    file: UploadFile = File(None),
    url: str = Form(None)
):
    print("File:", file)
    print("URL:", url)
    
    if not file and not url:
        raise HTTPException(status_code=400, detail="Please provide a file or a valid URL.")
    
    start_time = time.time()
    data = b""
    kind = None
    filename = "unknown.media"
    input_type = "file" if file else "url"
    original_url = url if url else "Local Upload"
    
    try:
        if file:
            filename = file.filename.lower()
            if not filename.endswith(ALLOWED_EXTENSIONS):
                raise HTTPException(status_code=400, detail=f"File extension not allowed. Use {ALLOWED_EXTENSIONS}")
            
            data = await file.read()
            if len(data) > MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB.")
            
            # Simplified kind detection based on extension
            if filename.endswith(('.mp4', '.mov')):
                kind = "video"
            else:
                kind = "image"

        elif url:
            filename = url.split("?")[0].split("/")[-1]
            if not filename:
                filename = "url_download.media"
                
            is_social = any(domain in url.lower() for domain in ["youtube.com", "youtu.be", "instagram.com", "tiktok.com", "twitter.com", "x.com", "fb.watch", "facebook.com"])
            
            if is_social:
                try:
                    data = await asyncio.to_thread(download_social_media, url)
                    kind = "video"
                    filename = "social_video.mp4"
                except Exception as e:
                    raise HTTPException(status_code=400, detail=f"Failed to extract video from social url: {str(e)}")
            else:
                try:
                    # Stream download for size checking
                    response = requests.get(url, stream=True, timeout=15)
                    response.raise_for_status()
                    
                    content_type = response.headers.get("Content-Type", "")
                    
                    if "video" in content_type:
                        kind = "video"
                    elif "image" in content_type:
                        kind = "image"
                    else:
                        url_clean = url.split("?")[0].lower()
                        if url_clean.endswith(('.mp4', '.mov')):
                            kind = "video"
                        elif url_clean.endswith(('.jpg', '.jpeg', '.png')):
                            kind = "image"
                        else:
                            raise HTTPException(status_code=400, detail="Invalid Content-Type from URL. Must be image or video.")
                    
                    downloaded_size = 0
                    chunks = []
                    for chunk in response.iter_content(chunk_size=1024*1024):
                        if chunk:
                            chunks.append(chunk)
                            downloaded_size += len(chunk)
                            if downloaded_size > MAX_FILE_SIZE:
                                raise HTTPException(status_code=400, detail="URL File too large. Maximum size is 50MB.")
                    
                    data = b"".join(chunks)

                except requests.exceptions.RequestException as e:
                    raise HTTPException(status_code=400, detail=f"Failed to fetch media from URL: {str(e)}")

        if not data:
            raise HTTPException(status_code=400, detail="Failed to read media data.")
            
        # Analysis
        if kind == "image":
            score, _ = predict_image(data)
        elif kind == "video":
            frames = extract_frames(data)
            if not frames:
                raise HTTPException(status_code=400, detail="Failed to extract frames from video")
            
            scores = [predict_frame(f) for f in frames]
            score = round(sum(scores) / len(scores), 1)
        else:
            raise HTTPException(status_code=400, detail="Unsupported media format.")
            
        # Decision
        if score <= 3.0:
            prediction = "AI Generated"
        elif score <= 6.0:
            prediction = "Suspicious"
        else:
            prediction = "Real"
        # Upload to Cloudinary (optional fallback if configured)
        cloud_url = upload_media(data, filename) if data else None

        # Log to MongoDB
        log_prediction(input_type, original_url, cloud_url, prediction, score)
        
        processing_time = round(time.time() - start_time, 2)
        
        response_payload = {
            "prediction": prediction,
            "confidence_score": score,
            "source_type": "URL" if input_type == "url" else "Uploaded",
            "processing_time": f"{processing_time}s",
            "message": "Analysis complete"
        }
        if cloud_url:
            response_payload["cloud_url"] = cloud_url
            
        return response_payload
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
