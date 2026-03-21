from pymongo import MongoClient
import os
import certifi

# Connect to MongoDB
MONGO_URI = os.getenv("MONGO_URI")
if MONGO_URI is not None:
    MONGO_URI = MONGO_URI.strip()

MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")
if MONGO_DB_NAME is not None:
    MONGO_DB_NAME = MONGO_DB_NAME.strip()

logs_collection = None

if not MONGO_URI:
    print("MongoDB not configured (MONGO_URI not set). Prediction logging disabled.")
else:
    try:
        mongo_client_kwargs = {}
        if MONGO_URI.startswith("mongodb+srv://"):
            mongo_client_kwargs["tlsCAFile"] = certifi.where()

        client = MongoClient(MONGO_URI, **mongo_client_kwargs)

        if MONGO_DB_NAME:
            db = client[MONGO_DB_NAME]
        else:
            try:
                db = client.get_default_database()
            except Exception:
                db = None

        if db is None:
            raise Exception(
                "No database name configured. Set MONGO_DB_NAME or include a database in MONGO_URI."
            )

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
