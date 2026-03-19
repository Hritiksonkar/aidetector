import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
import io

# Initialize a pre-trained model for feature extraction. For a real deepfake system,
# you'd load a specialized model (e.g., efficientnet specifically trained on FaceForensics++).
# For the demo, we use MobileNetV2 and map its features deterministically to a score.
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = models.mobilenet_v2(pretrained=True)
model.eval()
model.to(device)

preprocess = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

def predict_image(image_bytes: bytes) -> tuple[float, str]:
    """
    Analyzes an image and returns a probability score (0-10) and prediction class.
    Score: 0 - 3  → AI Generated
    Score: 4 - 6  → Suspicious
    Score: 7 - 10 → Real
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    input_tensor = preprocess(img).unsqueeze(0).to(device)
    
    with torch.no_grad():
        output = model(input_tensor)
        
        # Simulate AI vs Real detection by pseudo-hashing the output tensor
        # This guarantees the same image gets the same score (deterministic).
        # We simulate that the model has learned deepfake patterns.
        val = torch.mean(output).item() * 1000
        pseudo_prob = (np.sin(val) + 1) / 2  # value between 0 and 1
        
        # We skew the distribution based on edge variance (blurriness is suspicious)
        # Calculate image variance
        img_arr = np.array(img) / 255.0
        variance = np.var(img_arr)
        
        # Adjust simulated probability 
        # Low variance (too smooth/generated-looking) -> lower score (AI)
        # High natural variance -> higher score (Real)
        var_factor = np.clip(variance * 10, 0, 1)
        final_score = (pseudo_prob * 0.4 + var_factor * 0.6) * 10

        score = max(0.0, min(10.0, float(final_score)))
        
        # Determine strict category class
        if score <= 3:
            prediction = "AI Generated"
        elif score <= 6:
            prediction = "Suspicious"
        else:
            prediction = "Real"
            
    return round(score, 1), prediction

def predict_frame(frame: np.ndarray) -> float:
    img = Image.fromarray(frame)
    input_tensor = preprocess(img).unsqueeze(0).to(device)
    with torch.no_grad():
        output = model(input_tensor)
        val = torch.mean(output).item() * 1000
        pseudo_prob = (np.sin(val) + 1) / 2
        var_factor = np.clip(np.var(frame/255.0) * 10, 0, 1)
        final_score = (pseudo_prob * 0.4 + var_factor * 0.6) * 10
    return max(0.0, min(10.0, float(final_score)))
