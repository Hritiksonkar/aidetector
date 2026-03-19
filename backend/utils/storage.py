import os
import io
import cloudinary
import cloudinary.uploader
from fastapi import HTTPException

# Configure cloudinary using env vars. This expects CLOUDINARY_URL in your .env
# CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
cloudinary.config(secure=True)

def upload_media(data_bytes: bytes, file_name: str) -> str:
    """
    Upload raw bytes to Cloudinary and return the secure url.
    """
    if not os.getenv("CLOUDINARY_URL"):
        print("Warning: CLOUDINARY_URL not set in .env. Skipping cloud storage.")
        return None
        
    try:
        # Use a BytesIO object so cloudinary can stream it as a file block
        file_obj = io.BytesIO(data_bytes)
        file_obj.name = file_name  # Give it a name with extension for correct mime type parsing
        
        result = cloudinary.uploader.upload(
            file_obj, 
            resource_type="auto", 
            folder="truth_shield_uploads"
        )
        return result.get("secure_url")
    except Exception as e:
        print(f"Cloudinary upload failed: {e}")
        return None
