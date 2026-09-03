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
watch_history_collection = db["watch_history"]
watchlist_collection = db["watchlist"]
comments_collection = db["comments_collection"]
video_reactions_collection = db["video_reactions"]
comment_reactions_collection = db["comment_reactions"]
video_reviews_collection = db["video_reviews"]
cast_collection = db["cast"]
viewer_settings_collection = db["viewer_settings"]
notifications_collection = db["notifications"]

print(">>> database.py loaded, using PyMongo")