import cv2
import os
import tempfile
from typing import List
import numpy as np

def extract_frames(video_bytes: bytes, max_frames: int = 10) -> List[np.ndarray]:
    """
    Extract a specified number of frames from a video byte stream.
    """
    # OpenCV requires a file path to read video, so we write to a temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    try:
        temp_file.write(video_bytes)
        temp_file.close()
        
        cap = cv2.VideoCapture(temp_file.name)
        if not cap.isOpened():
            return []
            
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames == 0:
            return []
            
        # Determine the step size to get max_frames evenly distributed
        step = max(1, total_frames // max_frames)
        
        frames = []
        frame_idx = 0
        while len(frames) < max_frames:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                break
            # Convert BGR to RGB (which PyTorch models typically expect)
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(frame_rgb)
            frame_idx += step
            
        cap.release()
        return frames
    finally:
        os.unlink(temp_file.name)
