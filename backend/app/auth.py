from models.schemas import RegisterUser 
from fastapi import FastAPI, HTTPException, APIRouter, Depends
from database import users_collection
from utils.security import hash_password
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register")
async def register_user(user: RegisterUser):
    user_data = user.dict()
    user_data["date_of_birth"] = datetime.combine(user_data["date_of_birth"], datetime.min.time())
    existing_user = await users_collection.find_one({"email": user_data["email"]})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_data["passwordHash"] = hash_password(user_data.pop("password"))

    if user_data["date_of_birth"] > datetime.now():
        raise HTTPException(status_code=400, detail="Date of birth cannot be in the future")
    
    user_data["avatarUrl"] = None
    user_data["bio"] = None
    user_data["isBanned"] = False
    user_data["banReason"] = None
    user_data["bannedAt"] = None
    user_data["bannedBy"] = None
    user_data["isVerifiedEmail"] = False
    user_data["resetToken"] = None
    user_data["resetTokenExpiry"] = None
    user_data["loginCount"] = 1
    user_data["genrePreferences"] = []
    user_data["maturitySetting"] = "all"
    user_data["createdAt"] = datetime.now()
    user_data["updatedAt"] = datetime.now()

    await users_collection.insert_one(user_data)

    return {"message": "User registered successfully"}
    