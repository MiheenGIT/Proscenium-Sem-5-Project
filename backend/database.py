import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")

client = MongoClient(MONGO_URL, tlsCAFile=certifi.where())
db = client["proscenium"]

viewers_collection = db["viewers_collection"]
directors_collection = db["directors_collection"]
admin_collection = db["admin_collection"]
film_collection = db["film_collection"]
video_views_collection = db["video_views"]
watch_sessions_collection = db["watch_sessions"]
comments_collection = db["comments_collection"]

print(">>> database.py loaded, using PyMongo")