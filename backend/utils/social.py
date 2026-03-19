import yt_dlp
import tempfile
import os

def download_social_media(url: str) -> bytes:
    """
    Uses yt-dlp to download media from social platforms (youtube, instagram, etc.)
    Returns the raw bytes of the video and cleans up the temporary file.
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
        temp_name = temp_file.name
        
    ydl_opts = {
        'format': 'best[ext=mp4]/bestaudio/best',
        'outtmpl': temp_name,
        'quiet': True,
        'no_warnings': True,
        'max_filesize': 50 * 1024 * 1024, # 50MB limit
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
        if not os.path.exists(temp_name) or os.path.getsize(temp_name) == 0:
            raise Exception("Download failed or file is empty")
            
        with open(temp_name, 'rb') as f:
            data = f.read()
        return data
    finally:
        if os.path.exists(temp_name):
            try:
                os.remove(temp_name)
            except:
                pass
