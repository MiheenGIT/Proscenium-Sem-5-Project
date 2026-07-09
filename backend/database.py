import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")

client = MongoClient(MONGO_URL, tlsCAFile=certifi.where())
db = client["proscenium"]

viewers_collection = db["viewers_collection"]
creators_collection = db["creators_collection"]
admin_collection = db["admin_collection"]

print(">>> database.py loaded, using PyMongo")