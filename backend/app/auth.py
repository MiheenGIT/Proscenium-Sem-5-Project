from models.schemas import RegisterUser, ViewerRegister, CreatorRegister, AdminRegister
from fastapi import FastAPI, HTTPException, APIRouter, Depends
from database import creators_collection, viewers_collection, admin_collection
from utils.security import hash_password
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Auth"])


# ---------- shared helpers ----------

def _validate_dob(dob_date):
    dob = datetime.combine(dob_date, datetime.min.time())
    if dob > datetime.now():
        raise HTTPException(status_code=400, detail="Date of birth cannot be in the future")
    return dob


def _check_email_unique(email: str):
    # checked across ALL role collections, not just the one being registered
    existing_viewer = viewers_collection.find_one({"email": email})
    existing_creator = creators_collection.find_one({"email": email})
    existing_admin = admin_collection.find_one({"email": email})
    if existing_viewer or existing_creator or existing_admin:
        raise HTTPException(status_code=400, detail="Email already registered")


# ---------- Viewer ----------

@router.post("/register/viewer")
def register_viewer(user: ViewerRegister):
    user_data = user.dict()
    dob = _validate_dob(user_data["date_of_birth"])
    email = user_data["email"]
    _check_email_unique(email)

    password_hash = hash_password(user_data.pop("password"))
    now = datetime.now()

    viewer_doc = {
        "username": user_data["username"],
        "email": email,
        "passwordHash": password_hash,
        "date_of_birth": dob,
        "role": "viewer",
        "avatarUrl": None,
        "bio": None,
        "isBanned": False,
        "banReason": None,
        "bannedAt": None,
        "bannedBy": None,
        "isVerifiedEmail": False,
        "resetToken": None,
        "resetTokenExpiry": None,
        "loginCount": 1,
        "genrePreferences": user_data.get("genrePreferences", []),
        "maturitySetting": user_data.get("maturitySetting", "all"),
        "createdAt": now,
        "updatedAt": now,
    }
    result = viewers_collection.insert_one(viewer_doc)

    return {"message": "Viewer registered successfully", "userId": str(result.inserted_id)}


# ---------- Creator / Director ----------

@router.post("/register/creator")
def register_creator(user: CreatorRegister):
    user_data = user.dict()
    dob = _validate_dob(user_data["date_of_birth"])
    email = user_data["email"]
    _check_email_unique(email)

    password_hash = hash_password(user_data.pop("password"))
    now = datetime.now()

    creator_doc = {
        "username": user_data["username"],
        "email": email,
        "passwordHash": password_hash,
        "date_of_birth": dob,
        "role": "director",
        "avatarUrl": None,
        "bio": user_data.get("bio", None),
        "isBanned": False,
        "banReason": None,
        "bannedAt": None,
        "bannedBy": None,
        "isVerifiedEmail": False,
        "resetToken": None,
        "resetTokenExpiry": None,
        "loginCount": 1,
        "studioName": user_data.get("studioName", None),
        "portfolioUrl": user_data.get("portfolioUrl", None),
        "verificationStatus": "pending",
        "uploadsCount": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    result = creators_collection.insert_one(creator_doc)

    return {"message": "Creator registered successfully", "userId": str(result.inserted_id)}


# ---------- Admin ----------

@router.post("/register/admin")
def register_admin(user: AdminRegister):
    user_data = user.dict()
    dob = _validate_dob(user_data["date_of_birth"])
    email = user_data["email"]
    _check_email_unique(email)

    password_hash = hash_password(user_data.pop("password"))
    now = datetime.now()

    admin_doc = {
        "username": user_data["username"],
        "email": email,
        "passwordHash": password_hash,
        "date_of_birth": dob,
        "role": "admin",
        "avatarUrl": None,
        "bio": None,
        "isBanned": False,
        "banReason": None,
        "bannedAt": None,
        "bannedBy": None,
        "isVerifiedEmail": False,
        "resetToken": None,
        "resetTokenExpiry": None,
        "loginCount": 1,
        "adminLevel": user_data.get("adminLevel", "moderator"),
        "createdAt": now,
        "updatedAt": now,
    }
    result = admin_collection.insert_one(admin_doc)

    return {"message": "Admin registered successfully", "userId": str(result.inserted_id)}