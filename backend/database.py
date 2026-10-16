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
review_reactions_collection = db["review_reactions"]
cast_collection = db["cast"]
viewer_settings_collection = db["viewer_settings"]
notifications_collection = db["notifications"]
account_deletions_collection = db["account_deletions"]

print(">>> database.py loaded, using PyMongo")
# Anonymous, privacy-conscious website engagement events used by analytics dashboards.
analytics_events_collection = db["analytics_events"]
# Append-only log: one document per play, keeps accumulating watch time after the view is counted.
watch_log_collection = db["watch_session_log"]
