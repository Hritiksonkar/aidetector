from pymongo import MongoClient
import os
import certifi

# Connect to MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://hritiksonkar355_db_user:Hritik123@cluster0.poqpsw7.mongodb.net/aidetector")
try:
    client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = client.get_database()
    logs_collection = db["upload_logs"]
except Exception as e:
    print(f"MongoDB connection warning: {e}")
    logs_collection = None

from datetime import datetime

def log_prediction(input_type: str, original_url: str, cloud_url: str, prediction: str, score: float):
    if logs_collection is not None:
        try:
            document = {
                "input_type": input_type,
                "original_url": original_url,
                "prediction": prediction,
                "score": score,
                "timestamp": datetime.now().isoformat()
            }
            if cloud_url:
                document["cloud_url"] = cloud_url
                
            logs_collection.insert_one(document)
        except Exception as e:
            print(f"Failed to log to MongoDB: {e}")
