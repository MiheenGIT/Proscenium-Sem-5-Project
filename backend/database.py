import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
print(">>> database.py loaded, using Motor")

client = AsyncIOMotorClient(os.getenv("MONGO_URL"),
    tlsCAFile=certifi.where())
db = client['proscenium']
users_collection = db["users"] 
admin_collection = db["admin"]
videos_collection = db['videos']

